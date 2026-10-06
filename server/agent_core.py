"""Agent Core: the hand-written tool-calling loop. The brain of RingMate.

No agent frameworks. The loop:
  1. take the user's words + conversation history,
  2. ask the LLM which tool from the registry fits (strict JSON),
  3. validate the tool call against the registry,
  4. execute it (email/calendar/notes/math directly; file work via the laptop queue),
  5. manage multi-turn state — especially confirmations:
     a file is only emailed after the user confirms the exact file, EXCEPT the
     fast path: when the user asks to SEND a file and exactly one strong match
     is found, it is emailed immediately with no "is this the file?" round-trip.
     Ambiguous matches (several files) still ask the user to pick one.

File search is forgiving: the laptop matches on tokens with typo tolerance,
and when nothing matches strongly the agent asks "did you mean ...?" with
close suggestions instead of giving up.

The Core is input-agnostic: the browser call UI, the typed composer, and the
live console all feed it plain text through ``handle_turn``.
"""
from __future__ import annotations

import ast
import datetime
import logging
import math
import operator
import re
import time
from typing import Any, Callable

from server import tool_registry
from server.notes_tool import NotesStore
from server.memory_tool import MemoryStore
from server.queue_store import QueueStore

log = logging.getLogger("ringmate.agent")

# Actions returned by handle_turn (the voice layer speaks reply_text).
ACTION_NONE = "none"
ACTION_AWAITING_CONFIRMATION = "awaiting_confirmation"
ACTION_EMAIL_SENT = "email_sent"
ACTION_FILE_SENT = "file_sent"
ACTION_LAPTOP_UNREACHABLE = "laptop_unreachable"
ACTION_CLARIFY = "clarify"

SYSTEM_PROMPT = """You are RingMate, a voice-first personal AI assistant. The user talks to \
you in a voice call in their browser — keep every reply to one or two short \
sentences, plain words, no lists, no formatting.

LANGUAGE: The user may speak in English or a regional Indian language (Telugu, \
Hindi, Tamil, etc.). ALWAYS reply in the SAME language the user spoke in. If \
they speak Telugu, reply in Telugu. If they speak English, reply in English. \
Match their language naturally.

CRITICAL FOR NON-ENGLISH: When a tool returns English text (weather, calendar \
event names, file names, web search results), you MUST translate the \
descriptive parts into the user's language. Keep proper nouns (names, places) \
as-is, but translate everything else. Example: if the user speaks Telugu and \
the weather tool says "overcast, 28°C", reply in Telugu: "హైదరాబాద్‌లో ప్రస్తుతం \
మేఘావృతంగా ఉంది, 28 డిగ్రీలు." NEVER reply in English when the user spoke Telugu.

CRITICAL: Never claim you did something you didn't do. If you don't have a \
tool for an action, say you can't do it.
Your tools:
- find_file: search the laptop for a file. Pass 1-3 key words, e.g. \
"resume" — never a whole sentence. BUT if the user names a folder path \
(e.g. "D:\\Work" or "/home/nikhil/docs"), include the full path in the query \
so the laptop can check it. If the user wants the file SENT (e.g. \
"send me my resume"), pass purpose="send": I always ask the user to confirm \
which file before sending. If they name a \
recipient address (e.g. "send my resume to prasad@example.com"), pass it as \
to= — if they name a person with no address, ask for the email address \
instead of guessing. If they only want to know about the file, leave purpose \
as "find" and I will ask "Is this the file?" naming the match.
- send_file: NEVER call this yourself. I run it after the user confirms.
- read_file: read a text file's contents aloud as a short preview. Same keyword rule.
- list_files: the user's most recently modified files.
- send_email: send a plain email to ANY address the user names, immediately. \
E.g. "send hi to xyz@gmail.com" means to="xyz@gmail.com", subject="Hi", body="hi".
- check_calendar: their Google Calendar schedule (read-only lookup).
- create_event: schedule a new calendar event. E.g. "schedule lunch with \
Prasad tomorrow at 1 PM" -> summary="Lunch with Prasad", day="tomorrow", time="13:00".
- cancel_event: cancel a calendar event. ALWAYS confirm which event first — \
never cancel without the user saying yes to the specific event.
- reschedule_event: move an event to a new day/time. Confirm the event and \
new time first.
- search_drive: search Google Drive for files by name.
- web_search: LIVE or time-sensitive info ONLY — current weather, today's \
news, live scores, recent events, anything that changes day to day. For \
general facts (history, science, sports records, how things work, famous \
people) answer from your own knowledge — do NOT search. Pass the user's \
full question as "query" (never just a keyword); for follow-ups like \
"what about dallas?" write the complete standalone question, e.g. \
"what is the weather in dallas?".

KNOWLEDGE FIRST: You already know a great deal — history, science, sports,
how things work, famous people, general facts. Answer such questions
directly from your own knowledge; never guess or invent facts you don't
know. Use web_search only for live or time-sensitive information. If you
do search and the result does not actually answer the question (it never
mentions the key words of what was asked), IGNORE that result — answer
from your own knowledge if you can, or say honestly "I couldn't find
that." Never read an irrelevant search result aloud.
- get_datetime: current time and date — always use it for time questions.
- calculate: math. Convert phrases like "15% of 240" into an expression like \
"15 * 240 / 100" yourself.
- save_note, read_notes, delete_note: remember things, recall them, forget them.
- remember_fact, recall_facts: long-term memory about the user. When the user \
tells you something personal (their name, preferences, teammates, etc.), save \
it with remember_fact so you remember across calls. Use recall_facts when you \
need to remember.

If the user greets you or makes small talk, reply warmly without tools. If you \
cannot help with something, say so briefly and offer what you can do."""

_WORD_AFFIRM = {"yes", "yeah", "yep", "sure", "ok", "okay", "confirm", "confirmed"}
_WORD_NEG = {"no", "nope", "cancel", "stop"}
_PHRASE_AFFIRM = {"send it", "do it", "go ahead", "please do", "send the file", "that one"}
_PHRASE_NEG = {"dont", "do not", "never mind", "nevermind", "not that", "wrong file"}

# "the second one", "first", "last one" -> candidate index.
_ORDINALS = [
    (r"\b(first|1st)\b", 0),
    (r"\b(second|2nd)\b", 1),
    (r"\b(third|3rd)\b", 2),
    (r"\b(fourth|4th)\b", 3),
    (r"\b(fifth|5th)\b", 4),
    (r"\blast one\b", -1),
]


# Fillers spoken immediately when a tool call may take a while (laptop queue,
# network). Instant local tools get none — their answer follows at once.
# Language-aware via server.lang.t().
def _tool_filler(tool_name: str) -> str | None:
    from server.lang import t
    fillers = {
        "send_email": t("filler_on_it"),
        "find_file": t("filler_searching"),
        "send_file": t("filler_on_it"),
        "read_file": t("filler_on_it"),
        "list_files": t("filler_on_it"),
        "check_calendar": t("filler_checking_calendar"),
        "web_search": t("filler_let_me_check"),
    }
    return fillers.get(tool_name)

# Spoken at the very start of EVERY streaming turn (unless a pending-action
# filler above already covers it). The browser starts TTS on this while the
# LLM is still thinking, so the caller never hears dead air — this is what
# makes the call feel like a real phone call. Kept to 2-3 words so the audio
# is tiny; web_routes.warmup_tts_cache() pre-generates these at startup.
# Deterministic pick (no random state): indexed by the user's text length.
# Language-aware via server.lang.t().


def instant_filler(user_text: str) -> str:
    """Pick the turn-opening filler for this user text (deterministic)."""
    from server.lang import t
    fillers = (t("filler_on_it"), t("filler_one_moment"), t("filler_let_me_check"))
    return fillers[len(user_text) % len(fillers)]

_SENTENCE_END = re.compile(r"(?<=[.!?…])\s+")


def split_sentences(text: str) -> list[str]:
    """Split reply text into short speakable sentences for chunked TTS."""
    text = re.sub(r"\s+", " ", (text or "").strip())
    if not text:
        return []
    return [p.strip() for p in _SENTENCE_END.split(text) if p.strip()]


# Words too generic to prove a search result is relevant. The junk filter
# requires at least one REMAINING query word to appear in the answer.
_JUNK_STOPWORDS = frozenset(
    "what whats what's how how's why when where who which whom whose is are "
    "was were be been being do does did done can could will would shall should "
    "the a an and or for in of on to with from about at by as it its it's "
    "this that these those there here me my tell give know get got yesterday "
    "today tomorrow now then than so such very just".split()
)


def _is_junk_answer(query: str, answer: str) -> bool:
    """True when a search result is irrelevant to the question asked.

    The answer must mention at least one significant query word; otherwise
    it's an unrelated result (e.g. "what is cricket" for a Kohli score
    question) that must never be read aloud.
    """
    keywords = [w for w in re.findall(r"[a-z0-9]{3,}", (query or "").lower())
                if w not in _JUNK_STOPWORDS]
    if not keywords:
        return False
    haystack = (answer or "").lower()
    return not any(k in haystack for k in keywords)


def classify_confirmation(text: str) -> str:
    """Classify a reply to a confirmation prompt: 'yes', 'no', or 'unclear'."""
    t = re.sub(r"[^a-z ]", " ", text.lower().replace("'", ""))
    t = f" {re.sub(r'\\s+', ' ', t).strip()} "
    for phrase in _PHRASE_NEG:
        if phrase in t:
            return "no"
    words = set(t.split())
    if words & _WORD_NEG:
        return "no"
    for phrase in _PHRASE_AFFIRM:
        if phrase in t:
            return "yes"
    if words & _WORD_AFFIRM:
        return "yes"
    return "unclear"


def pick_ordinal(text: str) -> int | None:
    """Return a candidate index for 'the second one' style replies, else None."""
    t = f" {text.lower()} "
    for pattern, index in _ORDINALS:
        if re.search(pattern, t):
            return index
    return None


def format_mtime(ts: float) -> str:
    """Human-friendly 'edited ...' string for spoken confirmations."""
    from server.lang import get_lang
    dt = datetime.datetime.fromtimestamp(ts)
    now = datetime.datetime.now()
    # %-I (hour without leading zero) works on Linux/macOS but throws
    # ValueError on Windows. Use %I + lstrip which works everywhere.
    hm = dt.strftime("%I:%M %p").lstrip("0")
    lang = get_lang()
    if lang == "te":
        if dt.date() == now.date():
            return f"ఈరోజు {hm} కి"
        if dt.date() == (now.date() - datetime.timedelta(days=1)):
            return f"నిన్న {hm} కి"
        return f"{dt.strftime('%b %d')} న {hm} కి"
    if lang == "hi":
        if dt.date() == now.date():
            return f"आज {hm} बजे"
        if dt.date() == (now.date() - datetime.timedelta(days=1)):
            return f"कल {hm} बजे"
        return f"{dt.strftime('%b %d')} को {hm} बजे"
    if dt.date() == now.date():
        return f"today at {hm}"
    if dt.date() == (now.date() - datetime.timedelta(days=1)):
        return f"yesterday at {hm}"
    return f"on {dt.strftime('%b %d')} at {hm}"


# -- safe calculator -------------------------------------------------------
_CALC_BINOPS = {
    ast.Add: operator.add, ast.Sub: operator.sub,
    ast.Mult: operator.mul, ast.Div: operator.truediv,
    ast.FloorDiv: operator.floordiv, ast.Mod: operator.mod,
    ast.Pow: operator.pow,
}
_CALC_UNARY = {ast.UAdd: operator.pos, ast.USub: operator.neg}
_CALC_FUNCS = {
    "sqrt": math.sqrt, "abs": abs, "round": round,
    "min": min, "max": max,
}


def _eval_calc_node(node: ast.AST) -> float:
    if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)) \
            and not isinstance(node.value, bool):
        return node.value
    if isinstance(node, ast.BinOp) and type(node.op) in _CALC_BINOPS:
        return _CALC_BINOPS[type(node.op)](
            _eval_calc_node(node.left), _eval_calc_node(node.right))
    if isinstance(node, ast.UnaryOp) and type(node.op) in _CALC_UNARY:
        return _CALC_UNARY[type(node.op)](_eval_calc_node(node.operand))
    if (isinstance(node, ast.Call) and isinstance(node.func, ast.Name)
            and node.func.id in _CALC_FUNCS and not node.keywords):
        return _CALC_FUNCS[node.func.id](
            *[_eval_calc_node(a) for a in node.args])
    raise ValueError("unsupported expression")


def calculate_expression(expr: str) -> tuple[bool, Any]:
    """Safely evaluate a math expression. Returns (ok, value_or_error).

    Only numbers, + - * / // % **, parentheses, and sqrt/abs/round/min/max
    are allowed — no names, no attribute access, no imports. Anything else is
    rejected instead of executed.
    """
    try:
        tree = ast.parse(expr, mode="eval")
    except (SyntaxError, ValueError):
        return False, "bad expression"
    try:
        value = _eval_calc_node(tree.body)
    except (ValueError, ZeroDivisionError, OverflowError) as exc:
        return False, str(exc) or "could not evaluate"
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return False, "not a number"
    if isinstance(value, float):
        if value.is_integer():
            value = int(value)
        else:
            value = round(value, 4)
    return True, value


def _short_preview(text: str, limit: int = 280) -> str:
    """Trim text to a speakable preview, ending at a sentence boundary."""
    text = re.sub(r"\s+", " ", (text or "").strip())
    if len(text) <= limit:
        return text
    cut = text[:limit]
    for end in (". ", "! ", "? ", "\n"):
        idx = cut.rfind(end)
        if idx > limit // 2:
            return cut[:idx + 1].strip()
    return cut.rsplit(" ", 1)[0] + "…"


class AgentCore:
    """Turns user utterances into actions. One instance serves all calls."""

    def __init__(
        self,
        store: QueueStore,
        llm: Any,
        send_email_fn: Callable[..., dict],
        user_email: str,
        calendar_ical_url: str = "",
        notes_path: str = "notes.json",
        memory_path: str = "memory.json",
        wait_timeout: float = 45.0,
        poll_interval: float = 1.0,
    ):
        self.store = store
        self.llm = llm
        self.send_email_fn = send_email_fn
        self.user_email = user_email
        self.calendar_ical_url = calendar_ical_url or ""
        self.notes = NotesStore(notes_path)
        self.memory = MemoryStore(memory_path)
        self.wait_timeout = wait_timeout
        self.poll_interval = poll_interval
        # call_id -> {"history": [ {role, content} ], "pending": None | {...}}
        # pending = {"kind": "send"|"read", "candidates": [...], "command_id": int,
        #            "to": recipient email or None for the user's own inbox}
        self._conversations: dict[str, dict[str, Any]] = {}

    def _system_prompt_with_memory(self) -> str:
        """System prompt plus any long-term user memory."""
        mem_str = self.memory.get_context_string()
        if mem_str:
            return SYSTEM_PROMPT + "\n\n" + mem_str
        return SYSTEM_PROMPT

    # -- public API -------------------------------------------------------
    def handle_turn(self, call_id: str, user_text: str) -> dict[str, str]:
        """Process one user utterance. Returns {reply_text, action}."""
        conv = self._conversations.setdefault(call_id, {"history": [], "pending": None})
        conv["history"].append({"role": "user", "content": user_text})
        self.store.log(call_id, "user", "said", user_text)

        pending_out = self._handle_pending(call_id, conv, user_text)
        if pending_out is not None:
            return {"reply_text": pending_out["reply_text"],
                    "action": pending_out["action"]}

        # --- LLM decides --------------------------------------------------
        messages = [{"role": "system", "content": self._system_prompt_with_memory()}]
        messages += conv["history"][-10:]
        try:
            decision = self.llm.complete(messages, tool_registry.list_tools())
        except Exception:  # noqa: BLE001 — LLM must never crash a call
            log.exception("LLM call failed")
            return self._respond(
                call_id, conv,
                "I'm having trouble thinking right now. Could you try again in a moment?",
                ACTION_NONE,
            )

        if decision.get("type") != "tool_call":
            return self._respond(call_id, conv, decision.get("text", "..."), ACTION_NONE)

        name, arguments = decision["name"], decision.get("arguments", {})
        ok, cleaned_or_err = tool_registry.validate_tool_call(name, arguments)
        if not ok:
            log.warning("LLM tool call failed validation: %s", cleaned_or_err)
            return self._respond(
                call_id, conv,
                "I didn't quite get that. Could you say it differently?",
                ACTION_CLARIFY,
            )
        args = cleaned_or_err
        self.store.log(call_id, "agent", "tool_call", f"{name} {args}")
        return self._dispatch_tool(call_id, conv, name, args)

    def _dispatch_tool(self, call_id: str, conv: dict, name: str, args: dict) -> dict[str, str]:
        """Run the validated tool and build the reply. Shared by both turn paths."""
        if name == "send_email":
            return self._do_send_email(call_id, conv, args)
        if name == "find_file":
            return self._do_find_file(call_id, conv, args)
        if name == "read_file":
            return self._do_read_file(call_id, conv, args)
        if name == "list_files":
            return self._do_list_files(call_id, conv, args)
        if name == "calculate":
            return self._do_calculate(call_id, conv, args)
        if name == "remember_fact":
            return self._do_remember_fact(call_id, conv, args)
        if name == "recall_facts":
            return self._do_recall_facts(call_id, conv, args)
        if name == "create_event":
            return self._do_create_event(call_id, conv, args)
        if name == "cancel_event":
            return self._do_cancel_event(call_id, conv, args)
        if name == "reschedule_event":
            return self._do_reschedule_event(call_id, conv, args)
        if name == "search_drive":
            return self._do_search_drive(call_id, conv, args)
        if name == "send_drive_file":
            return self._do_send_drive_file(call_id, conv, args)
        if name == "send_file":
            # No pending confirmation -> the model jumped the gun. Refuse safely.
            return self._respond(
                call_id, conv,
                "I don't have a file waiting for confirmation yet. Which file did you mean?",
                ACTION_CLARIFY,
            )
        if name == "check_calendar":
            return self._do_check_calendar(call_id, conv, args)
        if name == "web_search":
            return self._do_web_search(call_id, conv, args)
        if name == "get_datetime":
            return self._do_get_datetime(call_id, conv)
        if name == "save_note":
            return self._do_save_note(call_id, conv, args)
        if name == "read_notes":
            return self._do_read_notes(call_id, conv)
        if name == "delete_note":
            return self._do_delete_note(call_id, conv, args)
        return self._respond(call_id, conv, "I can't do that yet.", ACTION_NONE)

    # -- pending confirmations (shared by both turn paths) ------------------
    def _pending_filler(self, conv: dict, user_text: str) -> str | None:
        """Filler to speak BEFORE resolving a pending confirmation.

        Used by the streaming path so the user hears something immediately
        while the laptop upload/read runs. Returns None when the reply will
        be instant (no/unclear/ordinal-pick for sending).
        """
        pending = conv.get("pending")
        if not pending:
            return None
        kind = pending.get("kind", "send")
        if classify_confirmation(user_text) == "yes":
            return "Sending it now." if kind == "send" else "Reading it now."
        if kind == "read" and pick_ordinal(user_text) is not None:
            return "Reading it now."
        return None

    def _handle_pending(self, call_id: str, conv: dict,
                        user_text: str) -> dict[str, Any] | None:
        """Resolve a pending file confirmation. None when nothing is pending.

        Returns {"reply_text", "action"}.
        """
        pending = conv.get("pending")
        if pending is None:
            return None
        kind = pending.get("kind", "send")

        # Calendar event cancellation confirmation.
        if kind == "cancel_event":
            verdict = classify_confirmation(user_text)
            if verdict == "yes":
                from server import google_calendar
                event = pending.get("event", {})
                res = google_calendar.delete_event(event.get("id", ""))
                conv["pending"] = None
                if not res["ok"]:
                    return self._respond(call_id, conv,
                                         f"I couldn't cancel it: {res['error']}",
                                         ACTION_NONE)
                return self._respond(call_id, conv,
                                     f"Done — cancelled '{event.get('summary', 'the event')}'.",
                                     ACTION_NONE)
            if verdict == "no":
                conv["pending"] = None
                return self._respond(call_id, conv,
                                     "Okay, I won't cancel it. Anything else?",
                                     ACTION_NONE)
            return self._respond(call_id, conv,
                                 "Should I cancel it? Say yes or no.",
                                 ACTION_CLARIFY)

        # Drive file selection ("the first one", "send that to me").
        if kind == "drive_files":
            files = pending.get("files") or []
            if not files:
                conv["pending"] = None
                return self._respond(call_id, conv,
                                     "I lost track of which Drive file. Which one did you mean?",
                                     ACTION_CLARIFY)
            # "the first/second one" — pick by ordinal.
            idx = pick_ordinal(user_text)
            if idx is not None and -len(files) <= idx < len(files):
                chosen = files[idx]
                conv["pending"] = {"kind": "drive_send_confirm", "file": chosen}
                return self._respond(call_id, conv,
                                     f"Got it — '{chosen['name']}'. Should I send it to your email? "
                                     "Say yes, or name an address.",
                                     ACTION_CLARIFY)
            # "send that to me" / "yes, send it" — use the first file.
            verdict = classify_confirmation(user_text)
            lowered = user_text.lower()
            if verdict == "yes" or "send" in lowered:
                chosen = files[0]
                # Check for a recipient email in the text.
                import re
                email_match = re.search(r"[\w.+-]+@[\w-]+\.[\w.]+", user_text)
                to = email_match.group(0) if email_match else ""
                return self._do_send_drive_file(
                    call_id, conv,
                    {"file_id": chosen["id"], "file_name": chosen["name"], "to": to})
            return self._respond(call_id, conv,
                                 f"Which Drive file? Say 'the first one', or 'send that to me'.",
                                 ACTION_CLARIFY)

        # Drive send confirmation ("should I send it to your email?").
        if kind == "drive_send_confirm":
            f = pending.get("file", {})
            verdict = classify_confirmation(user_text)
            if verdict == "no":
                conv["pending"] = None
                return self._respond(call_id, conv,
                                     "Okay, I won't send it. Anything else?",
                                     ACTION_NONE)
            import re
            email_match = re.search(r"[\w.+-]+@[\w-]+\.[\w.]+", user_text)
            to = email_match.group(0) if email_match else ""
            # "yes" or an address both confirm.
            if verdict == "yes" or email_match or "send" in user_text.lower():
                conv["pending"] = None
                return self._do_send_drive_file(
                    call_id, conv,
                    {"file_id": f.get("id", ""), "file_name": f.get("name", "file"), "to": to})
            return self._respond(call_id, conv,
                                 "Should I send it? Say yes or give me an email address.",
                                 ACTION_CLARIFY)

        candidates = pending.get("candidates") or []

        # "the second one" — pick that candidate.
        idx = pick_ordinal(user_text)
        if idx is not None and -len(candidates) <= idx < len(candidates):
            chosen = candidates[idx]
            if kind == "read":
                return self._read_chosen(call_id, conv, chosen)
            conv["pending"] = {"kind": "send", "candidates": [chosen],
                               "command_id": pending.get("command_id"),
                               "to": pending.get("to")}
            reply = f"Got it — {chosen['name']}. Is this the file? Say yes to send it."
            out = self._respond(call_id, conv, reply, ACTION_AWAITING_CONFIRMATION)
            return out

        verdict = classify_confirmation(user_text)
        if verdict == "no":
            conv["pending"] = None
            from server.lang import t
            out = self._respond(call_id, conv,
                                t("wont_do"), ACTION_NONE)
            return out
        if verdict == "yes":
            chosen = candidates[0] if candidates else None
            if chosen is None:
                conv["pending"] = None
                out = self._respond(call_id, conv,
                                    "I lost track of which file we were talking about. "
                                    "Which file did you mean?", ACTION_CLARIFY)
                return out
            if kind == "read":
                return self._read_chosen(call_id, conv, chosen)
            return self._do_send_file(call_id, conv)

        name = candidates[0]["name"] if candidates else "that file"
        verb = "send" if kind == "send" else "read"
        from server.lang import t
        reply = t("confirm_send", name=name) if verb == "send" else t("confirm_send", name=name)
        out = self._respond(call_id, conv, reply, ACTION_AWAITING_CONFIRMATION)
        return out

    # -- tool executors ----------------------------------------------------
    def _do_send_email(self, call_id: str, conv: dict, args: dict) -> dict[str, str]:
        # Auto-generate a subject from the body if the LLM didn't provide one.
        subject = (args.get("subject") or "").strip()
        body = (args.get("body") or "").strip()
        if not subject and body:
            # Use first 6 words of the body as the subject.
            words = body.split()[:6]
            subject = " ".join(words)
            if len(body.split()) > 6:
                subject += "…"
            # Capitalize first letter.
            subject = subject[0].upper() + subject[1:] if subject else "Message"
        try:
            self.send_email_fn(to=args["to"], subject=subject, body=body)
        except Exception as exc:  # noqa: BLE001
            log.exception("send_email failed")
            return self._respond(call_id, conv,
                                 f"I couldn't send the email: {exc}", ACTION_NONE)
        reply = f"Email sent to {args['to']}."
        return self._respond(call_id, conv, reply, ACTION_EMAIL_SENT)

    def _find_candidates(self, call_id: str, conv: dict,
                         args: dict) -> tuple[dict | None, list, list, str | None]:
        """Enqueue a laptop file search.

        Returns (error_reply, candidates, suggestions, dir_path). ``dir_path``
        is set when the user named a folder outright and the laptop listed it;
        otherwise None.
        """
        command_id = self.store.enqueue(
            "find_file",
            {"query": args.get("query", ""), "file_type": args.get("file_type"),
             "sort": args.get("sort", "recent"), "max_results": 5},
            call_id=call_id,
        )
        result = self._wait_for_result(command_id)
        if result is None:
            return (self._respond(
                call_id, conv,
                "I'm not getting an answer from your laptop. Is it switched on and online?",
                ACTION_LAPTOP_UNREACHABLE), [], [], None)
        if result["status"] == "error":
            return (self._respond(
                call_id, conv,
                "Something went wrong searching your laptop. Let's try again.",
                ACTION_NONE), [], [], None)
        if result["status"] == "path_not_allowed":
            path = (result["result"] or {}).get("path", "that folder")
            return (self._respond(
                call_id, conv,
                f"That folder ({path}) isn't in my allowed folders on your laptop. "
                "Add it to allowed_folders in agent_config.json and restart the "
                "laptop agent, then ask me again.",
                ACTION_NONE), [], [], None)
        data = result["result"] or {}
        if result["status"] == "dir_listing":
            return None, data.get("files", []), [], data.get("path")
        return None, data.get("candidates", []), data.get("suggestions", []), None

    def _do_find_file(self, call_id: str, conv: dict, args: dict) -> dict[str, str]:
        err, candidates, suggestions, dir_path = self._find_candidates(call_id, conv, args)
        if err:
            return err
        query = args.get("query", "that")
        recipient = args.get("to") or None  # None -> user's own inbox
        if dir_path is not None:
            if not candidates:
                return self._respond(
                    call_id, conv,
                    f"I looked in {dir_path} and it's empty.",
                    ACTION_NONE)
            conv["pending"] = {"kind": "send", "candidates": candidates,
                               "command_id": None, "to": recipient}
            names = ", ".join(c["name"] for c in candidates[:5])
            reply = (f"In {dir_path} I found: {names}. "
                     f"Which one do you want?")
            return self._respond(call_id, conv, reply, ACTION_AWAITING_CONFIRMATION)
        if candidates:
            top = candidates[0]
            # Always ask for confirmation, even for a single match. The
            # "instant send" fast path was unreliable (threw exceptions on
            # the laptop upload); the ask flow is proven to work.
            conv["pending"] = {"kind": "send", "candidates": candidates,
                               "command_id": None, "to": recipient}
            when = format_mtime(top["mtime"]) if top.get("mtime") else "recently"
            from server.lang import t
            if len(candidates) == 1:
                reply = t("found_file", name=top['name'], date=when) + " " + t("is_this_the_file")
            else:
                names = ", ".join(c["name"] for c in candidates[:3])
                reply = (f"I found a few that could match: {names}. "
                         f"Is the first one — {top['name']} — the file you want? "
                         f"You can also say the second or third.")
            return self._respond(call_id, conv, reply, ACTION_AWAITING_CONFIRMATION)
        if suggestions:
            conv["pending"] = {"kind": "send", "candidates": suggestions,
                               "command_id": None, "to": recipient}
            names = ", ".join(s["name"] for s in suggestions)
            reply = (f"I couldn't find an exact match for {query}. "
                     f"Did you mean one of these: {names}?")
            return self._respond(call_id, conv, reply, ACTION_AWAITING_CONFIRMATION)
        return self._respond(
            call_id, conv,
            f"I looked through your folders and couldn't find anything like {query}. "
            f"Could you tell me a bit more about the file name?",
            ACTION_NONE,
        )

    def _do_send_file(self, call_id: str, conv: dict) -> dict[str, Any]:
        pending = conv["pending"]
        chosen = pending["candidates"][0]
        name = chosen["name"]
        to = pending.get("to") or self.user_email
        # Ask the laptop to upload the confirmed file's bytes.
        upload_id = self.store.enqueue(
            "upload_file",
            {"path": chosen.get("path", ""), "source_command_id": pending.get("command_id")},
            call_id=call_id,
        )
        result = self._wait_for_result(upload_id)
        if result is None or result["status"] != "done" or not result["result"].get("file_path"):
            conv["pending"] = None
            out = self._respond(
                call_id, conv,
                "The upload from your laptop didn't complete. Is it still online?",
                ACTION_LAPTOP_UNREACHABLE,
            )
            return out
        file_path = result["result"]["file_path"]
        try:
            self.send_email_fn(
                to=to,
                subject=f"Your file: {name}",
                body=f"As requested on your call with RingMate, here is {name}.",
                attachment_path=file_path,
            )
        except Exception as exc:  # noqa: BLE001
            log.exception("send_file email failed")
            conv["pending"] = None
            out = self._respond(call_id, conv,
                                f"The file is ready but I couldn't email it: {exc}",
                                ACTION_NONE)
            return out
        conv["pending"] = None
        dest = "your email" if to == self.user_email else to
        out = self._respond(call_id, conv,
                            f"Done — I sent {name} to {dest}.", ACTION_FILE_SENT)
        return out

    def _do_read_file(self, call_id: str, conv: dict, args: dict) -> dict[str, str]:
        err, candidates, suggestions, dir_path = self._find_candidates(call_id, conv, args)
        if err:
            return err
        query = args.get("query", "that")
        if dir_path is not None:
            if not candidates:
                return self._respond(
                    call_id, conv,
                    f"I looked in {dir_path} and it's empty.",
                    ACTION_NONE)
            conv["pending"] = {"kind": "read", "candidates": candidates,
                               "command_id": None}
            names = ", ".join(c["name"] for c in candidates[:5])
            reply = (f"In {dir_path} I found: {names}. "
                     f"Which one should I read?")
            return self._respond(call_id, conv, reply, ACTION_AWAITING_CONFIRMATION)
        if len(candidates) == 1:
            return self._read_chosen(call_id, conv, candidates[0])
        if candidates:
            conv["pending"] = {"kind": "read", "candidates": candidates,
                               "command_id": None}
            names = ", ".join(c["name"] for c in candidates[:3])
            reply = (f"I found a few that could match: {names}. "
                     f"Which one should I read — the first, second, or third?")
            return self._respond(call_id, conv, reply, ACTION_AWAITING_CONFIRMATION)
        if suggestions:
            conv["pending"] = {"kind": "read", "candidates": suggestions,
                               "command_id": None}
            names = ", ".join(s["name"] for s in suggestions)
            reply = (f"I couldn't find an exact match for {query}. "
                     f"Did you mean one of these: {names}?")
            return self._respond(call_id, conv, reply, ACTION_AWAITING_CONFIRMATION)
        return self._respond(
            call_id, conv,
            f"I looked through your folders and couldn't find anything like {query}.",
            ACTION_NONE,
        )

    def _read_chosen(self, call_id: str, conv: dict, chosen: dict) -> dict[str, Any]:
        """Read a confirmed file's text preview from the laptop and speak it."""
        conv["pending"] = None
        name = chosen["name"]
        read_id = self.store.enqueue(
            "read_file", {"path": chosen.get("path", "")}, call_id=call_id)
        result = self._wait_for_result(read_id)
        if result is None:
            out = self._respond(
                call_id, conv,
                f"I'm not getting an answer from your laptop. Is it switched on and online?",
                ACTION_LAPTOP_UNREACHABLE,
            )
            return out
        if result["status"] != "done" or not (result["result"] or {}).get("content"):
            out = self._respond(
                call_id, conv,
                f"I couldn't read {name} — it may not be a text file.",
                ACTION_NONE,
            )
            return out
        content = result["result"]["content"]
        preview = _short_preview(content)
        if not preview:
            out = self._respond(call_id, conv,
                                f"{name} looks empty.", ACTION_NONE)
        else:
            out = self._respond(call_id, conv,
                                f"Here's what's in {name}: {preview}", ACTION_NONE)
        return out

    def _do_list_files(self, call_id: str, conv: dict, args: dict) -> dict[str, str]:
        list_id = self.store.enqueue(
            "list_files", {"limit": args.get("limit", 5)}, call_id=call_id)
        result = self._wait_for_result(list_id)
        if result is None:
            return self._respond(
                call_id, conv,
                "I'm not getting an answer from your laptop. Is it switched on and online?",
                ACTION_LAPTOP_UNREACHABLE,
            )
        files = (result["result"] or {}).get("files", [])
        if not files:
            return self._respond(call_id, conv,
                                 "Your folders look empty — I didn't find any files.",
                                 ACTION_NONE)
        names = ", ".join(f["name"] for f in files[:5])
        return self._respond(call_id, conv,
                             f"Your most recent files are: {names}.", ACTION_NONE)

    def _do_calculate(self, call_id: str, conv: dict, args: dict) -> dict[str, str]:
        ok, value = calculate_expression(args.get("expression", ""))
        if not ok:
            return self._respond(
                call_id, conv,
                "I couldn't work that calculation out. Could you say it differently?",
                ACTION_CLARIFY,
            )
        return self._respond(call_id, conv, f"That's {value}.", ACTION_NONE)

    def _do_check_calendar(self, call_id: str, conv: dict, args: dict) -> dict[str, str]:
        # Prefer the Google Calendar API when connected (same source as
        # create/cancel/reschedule); fall back to the iCal feed otherwise.
        from server import google_calendar
        if google_calendar.google_oauth.is_authorized():
            res = google_calendar.list_events(args.get("day", "today"))
            if res["ok"]:
                events = res["events"]
                if not events:
                    return self._respond(call_id, conv,
                                         "Nothing on your calendar for that day. Enjoy the free time.",
                                         ACTION_NONE)
                parts = []
                for e in events[:5]:
                    start = e["start"]
                    # Format "2026-10-03T18:30:00+05:30" -> "6:30 PM".
                    try:
                        from datetime import datetime
                        dt = datetime.fromisoformat(start)
                        # Windows-safe: %I gives "06", lstrip the leading zero.
                        when = dt.strftime("%I:%M %p").lstrip("0")
                    except (ValueError, AttributeError):
                        when = start[11:16] if len(start) >= 16 else start
                    parts.append(f"{e['summary']}, {when}")
                from server.lang import t; reply = t("schedule_intro") + ". ".join(parts) + "."
                return self._respond(call_id, conv, reply, ACTION_NONE)
            # API failed — fall through to iCal.
        from server import calendar_tool
        res = calendar_tool.check_calendar(self.calendar_ical_url, args.get("day", "today"))
        if not res["ok"]:
            return self._respond(call_id, conv, res.get("message",
                                 "I couldn't check your calendar right now."), ACTION_NONE)
        events = res["events"]
        if not events:
            return self._respond(call_id, conv,
                                 "Nothing on your calendar for that day. Enjoy the free time.",
                                 ACTION_NONE)
        parts = []
        for e in events[:5]:
            when = "all day" if e["all_day"] else e["start"]
            parts.append(f"{e['summary']}, {when}")
        from server.lang import t; reply = t("schedule_intro") + ". ".join(parts) + "."
        return self._respond(call_id, conv, reply, ACTION_NONE)

    def _do_web_search(self, call_id: str, conv: dict, args: dict) -> dict[str, str]:
        from server import websearch_tool
        query = args.get("query", "")
        # The local model sometimes drops the place on follow-ups ("what about
        # dallas" -> query "weather"). The user's own words are the last user
        # message in history; use them to rebuild the query when needed.
        raw_text = ""
        history = conv.get("history") or []
        if history and history[-1].get("role") == "user":
            raw_text = history[-1].get("content", "")
        query = websearch_tool.repair_weather_query(query, raw_text)
        res = websearch_tool.web_search(query)
        if not res["ok"]:
            err = res.get("error", "")
            # Weather place mismatch: wttr.in resolved to somewhere that
            # clearly isn't what was asked (often a garbled STT transcript).
            # Clarify — offering the home city as the likely intent — instead
            # of answering confidently for a random place.
            if err in ("place_mismatch", "no_results") \
                    and websearch_tool.is_weather_query(query):
                import os
                requested = (res.get("requested")
                             or websearch_tool.requested_place(query)
                             or "that place")
                home = os.environ.get("USER_HOME_CITY", "Hyderabad").strip()
                if err == "place_mismatch" and home:
                    return self._respond(
                        call_id, conv,
                        f"I couldn't find '{requested}'. Did you mean {home}?",
                        ACTION_CLARIFY)
                return self._respond(
                    call_id, conv,
                    f"I couldn't find the weather for '{requested}'. "
                    "Which place did you mean?",
                    ACTION_CLARIFY)
            return self._respond(call_id, conv,
                                 "I couldn't search the web just now. Try again in a moment?",
                                 ACTION_NONE)
        answer = res["answer"] or (res["related"][0] if res["related"] else "")
        if not answer:
            return self._respond(call_id, conv,
                                 "I searched but didn't find a clear answer.", ACTION_NONE)
        # Junk filter: a LONG answer must mention at least one significant
        # query word, or it's an irrelevant result being read aloud (the
        # "what is cricket" embarrassment). Short answers pass through —
        # "42." for "meaning of life" is correct but shares no keywords.
        # Weather answers skip this — they carry their own place validation.
        if not websearch_tool.is_weather_query(query) \
                and len(answer) > 120 and _is_junk_answer(query, answer):
            log.warning("Dropping junk search result for query %r", query)
            return self._respond(call_id, conv,
                                 "I couldn't find a clear answer on that.",
                                 ACTION_NONE)
        short = ". ".join(answer.split(". ")[:2]).strip()
        if short and not short.endswith((".", "!", "?")):
            short += "."
        return self._respond(call_id, conv, short, ACTION_NONE)

    def _do_get_datetime(self, call_id: str, conv: dict) -> dict[str, str]:
        from server.lang import t, get_lang
        now = datetime.datetime.now()
        hour = now.strftime("%I").lstrip("0") or "12"
        if get_lang() == "te":
            # Telugu: "ఇప్పుడు సమయం 5:12 PM, శనివారం, అక్టోబర్ 03."
            reply = f"ఇప్పుడు సమయం {hour}:{now.strftime('%M %p')}."
        elif get_lang() == "hi":
            reply = f"अभी {hour}:{now.strftime('%M %p')} बजे हैं।"
        else:
            reply = f"It's {hour}:{now.strftime('%M %p')} on {now.strftime('%A, %B %d')}."
        return self._respond(call_id, conv, reply, ACTION_NONE)

    def _do_save_note(self, call_id: str, conv: dict, args: dict) -> dict[str, str]:
        res = self.notes.add(args.get("text", ""))
        if not res["ok"]:
            return self._respond(call_id, conv,
                                 "I didn't catch what to remember. Could you say it again?",
                                 ACTION_CLARIFY)
        return self._respond(call_id, conv, "Noted — I'll remember that.", ACTION_NONE)

    def _do_read_notes(self, call_id: str, conv: dict) -> dict[str, str]:
        notes = self.notes.list(limit=5)
        if not notes:
            return self._respond(call_id, conv,
                                 "You haven't asked me to remember anything yet.", ACTION_NONE)
        reply = ("Here's what you've asked me to remember: "
                 + "; ".join(n["text"] for n in notes) + ".")
        return self._respond(call_id, conv, reply, ACTION_NONE)

    def _do_remember_fact(self, call_id: str, conv: dict, args: dict) -> dict[str, str]:
        res = self.memory.remember(
            args.get("key", ""), args.get("value", ""), args.get("category", "general"))
        if not res["ok"]:
            return self._respond(call_id, conv,
                                 "I didn't catch what to remember. Could you say it again?",
                                 ACTION_CLARIFY)
        key = res["key"].replace("_", " ")
        return self._respond(call_id, conv,
                             f"Got it — I'll remember that your {key} is {args.get('value', '')}.",
                             ACTION_NONE)

    def _do_recall_facts(self, call_id: str, conv: dict, args: dict) -> dict[str, str]:
        key = args.get("key", "")
        if key:
            res = self.memory.recall(key)
            if not res["ok"]:
                return self._respond(call_id, conv,
                                     "I don't have that in my memory yet.", ACTION_NONE)
            fact = res["fact"]
            return self._respond(call_id, conv,
                                 f"Your {key.replace('_', ' ')} is {fact['value']}.",
                                 ACTION_NONE)
        res = self.memory.recall()
        facts = res.get("facts", {})
        if not facts:
            return self._respond(call_id, conv,
                                 "I don't have anything in my long-term memory yet. "
                                 "Tell me something about yourself and I'll remember it.",
                                 ACTION_NONE)
        items = [f"{k.replace('_', ' ')}: {v['value']}" for k, v in sorted(facts.items())]
        reply = "Here's what I remember about you: " + "; ".join(items) + "."
        return self._respond(call_id, conv, reply, ACTION_NONE)

    def _do_create_event(self, call_id: str, conv: dict, args: dict) -> dict[str, str]:
        from server import google_calendar
        if not google_calendar.google_oauth.is_authorized():
            return self._respond(call_id, conv,
                                 "Google Calendar isn't connected yet. "
                                 "Open /web/oauth/authorize in your browser to connect it.",
                                 ACTION_NONE)
        res = google_calendar.create_event(
            args.get("summary", ""),
            args.get("day", "today"),
            args.get("time", "09:00"),
            args.get("duration_min", 60),
        )
        if not res["ok"]:
            return self._respond(call_id, conv,
                                 f"I couldn't create the event: {res['error']}", ACTION_NONE)
        return self._respond(call_id, conv,
                             f"Done — '{res['summary']}' scheduled for {res['start'][:16].replace('T', ' at ')}.",
                             ACTION_NONE)

    def _do_cancel_event(self, call_id: str, conv: dict, args: dict) -> dict[str, str]:
        from server import google_calendar
        if not google_calendar.google_oauth.is_authorized():
            return self._respond(call_id, conv,
                                 "Google Calendar isn't connected yet. "
                                 "Open /web/oauth/authorize in your browser to connect it.",
                                 ACTION_NONE)
        query = args.get("query", "")
        day = args.get("day", "today")
        res = google_calendar.find_event(query, day)
        if not res["ok"]:
            return self._respond(call_id, conv,
                                 f"I couldn't search your calendar: {res['error']}", ACTION_NONE)
        matches = res["matches"]
        if not matches:
            return self._respond(call_id, conv,
                                 f"I couldn't find '{query}' on your calendar for {day}.",
                                 ACTION_NONE)
        if len(matches) > 1:
            names = "; ".join(f"'{m['summary']}' at {m['start'][11:16]}" for m in matches[:3])
            return self._respond(call_id, conv,
                                 f"I found several: {names}. Which one should I cancel?",
                                 ACTION_CLARIFY)
        # Single match — store pending confirmation (never cancel without explicit yes).
        conv["pending"] = {"kind": "cancel_event", "event": matches[0]}
        return self._respond(call_id, conv,
                             f"Found '{matches[0]['summary']}' at {matches[0]['start'][11:16]}. "
                             "Should I cancel it?",
                             ACTION_CLARIFY)

    def _do_reschedule_event(self, call_id: str, conv: dict, args: dict) -> dict[str, str]:
        from server import google_calendar
        if not google_calendar.google_oauth.is_authorized():
            return self._respond(call_id, conv,
                                 "Google Calendar isn't connected yet. "
                                 "Open /web/oauth/authorize in your browser to connect it.",
                                 ACTION_NONE)
        query = args.get("query", "")
        day = args.get("day", "today")
        res = google_calendar.find_event(query, day)
        if not res["ok"]:
            return self._respond(call_id, conv,
                                 f"I couldn't search your calendar: {res['error']}", ACTION_NONE)
        matches = res["matches"]
        if not matches:
            return self._respond(call_id, conv,
                                 f"I couldn't find '{query}' on your calendar for {day}.",
                                 ACTION_NONE)
        if len(matches) > 1:
            names = "; ".join(f"'{m['summary']}' at {m['start'][11:16]}" for m in matches[:3])
            return self._respond(call_id, conv,
                                 f"I found several: {names}. Which one should I move?",
                                 ACTION_CLARIFY)
        new_day = args.get("new_day", "")
        new_time = args.get("new_time", "")
        res = google_calendar.update_event(matches[0]["id"], summary="",
                                           day=new_day, time_str=new_time)
        if not res["ok"]:
            return self._respond(call_id, conv,
                                 f"I couldn't reschedule it: {res['error']}", ACTION_NONE)
        return self._respond(call_id, conv,
                             f"Done — moved '{res['summary']}' to {res['start'][:16].replace('T', ' at ')}.",
                             ACTION_NONE)

    def _do_search_drive(self, call_id: str, conv: dict, args: dict) -> dict[str, str]:
        from server import google_drive
        if not google_drive.google_oauth.is_authorized():
            return self._respond(call_id, conv,
                                 "Google Drive isn't connected yet. "
                                 "Open /web/oauth/authorize in your browser to connect it.",
                                 ACTION_NONE)
        res = google_drive.search(args.get("query", ""))
        if not res["ok"]:
            return self._respond(call_id, conv,
                                 f"I couldn't search Drive: {res['error']}", ACTION_NONE)
        files = res["files"]
        if not files:
            return self._respond(call_id, conv,
                                 f"I couldn't find '{args.get('query', '')}' on your Drive.",
                                 ACTION_NONE)
        # Store results so "the first one" / "send that" can resolve.
        conv["pending"] = {"kind": "drive_files", "files": files}
        if len(files) == 1:
            f = files[0]
            return self._respond(call_id, conv,
                                 f"Found '{f['name']}' on your Drive, modified {f['modifiedTime']}. "
                                 "Want me to send it somewhere?",
                                 ACTION_CLARIFY)
        names = "; ".join(f"'{f['name']}'" for f in files[:3])
        return self._respond(call_id, conv,
                             f"I found several on Drive: {names}. Which one?",
                             ACTION_CLARIFY)

    def _do_send_drive_file(self, call_id: str, conv: dict, args: dict) -> dict[str, str]:
        from server import google_drive
        file_id = args.get("file_id", "")
        file_name = args.get("file_name", "file")
        to = (args.get("to") or "").strip() or self.user_email
        # Download from Drive.
        dl = google_drive.download(file_id, file_name)
        if not dl["ok"]:
            return self._respond(call_id, conv,
                                 f"I couldn't download it from Drive: {dl['error']}",
                                 ACTION_NONE)
        # Email with attachment.
        try:
            self.send_email_fn(
                to=to,
                subject=f"File: {file_name}",
                body=f"Here's the file '{file_name}' from your Google Drive, sent via RingMate.",
                attachment_path=dl["path"],
            )
        except Exception as exc:  # noqa: BLE001
            log.exception("send_drive_file failed")
            return self._respond(call_id, conv,
                                 f"I couldn't send the email: {exc}", ACTION_NONE)
        finally:
            # Clean up the temp download.
            try:
                import os
                os.unlink(dl["path"])
            except OSError:
                pass
        return self._respond(call_id, conv,
                             f"Sent '{file_name}' to {to}.", ACTION_EMAIL_SENT)

    def _do_delete_note(self, call_id: str, conv: dict, args: dict) -> dict[str, str]:
        matches = self.notes.find(args.get("query", ""))
        if not matches:
            return self._respond(call_id, conv,
                                 "I couldn't find a note about that.", ACTION_NONE)
        if len(matches) == 1:
            self.notes.delete(matches[0]["id"])
            return self._respond(call_id, conv,
                                 "Done — I've forgotten that note.", ACTION_NONE)
        names = "; ".join(m["text"] for m in matches[:3])
        return self._respond(
            call_id, conv,
            f"I found a few matching notes: {names}. Which one should I forget?",
            ACTION_CLARIFY,
        )

    # -- streaming turn (low-latency voice path) ---------------------------
    def handle_turn_stream(self, call_id: str, user_text: str):
        """Yield {"type": "sentence", "text": ...} chunks, then {"type": "done"}.

        Latency strategy: an instant filler ("On it.") is spoken first so the
        caller hears something within ~1s while the LLM thinks; then the first
        real sentence starts playing while later ones are still produced.
        Tool calls (which may wait on the laptop or network) get their own
        specific filler sentence so the user hears progress, not silence.
        """
        conv = self._conversations.setdefault(call_id, {"history": [], "pending": None})
        conv["history"].append({"role": "user", "content": user_text})
        self.store.log(call_id, "user", "said", user_text)

        def _emit(text: str, action: str):
            for sentence in split_sentences(text):
                yield {"type": "sentence", "text": sentence}
            yield {"type": "done", "action": action}

        prefiller = self._pending_filler(conv, user_text)
        if prefiller:
            yield {"type": "sentence", "text": prefiller}
        else:
            # Instant filler BEFORE the LLM round trip: the browser starts
            # speaking this while the model is still thinking, so the first
            # audio lands in ~1s instead of after the full LLM + TTS wait.
            yield {"type": "sentence", "text": instant_filler(user_text)}
        pending_out = self._handle_pending(call_id, conv, user_text)
        if pending_out is not None:
            yield from _emit(pending_out["reply_text"], pending_out["action"])
            return

        messages = [{"role": "system", "content": self._system_prompt_with_memory()}]
        messages += conv["history"][-10:]
        try:
            decision = self.llm.complete(messages, tool_registry.list_tools())
        except Exception:  # noqa: BLE001
            log.exception("LLM call failed")
            yield {"type": "log", "text": "LLM request failed — using fallback reply."}
            reply = "I'm having trouble thinking right now. Could you try again in a moment?"
            self._respond(call_id, conv, reply, ACTION_NONE)
            yield from _emit(reply, ACTION_NONE)
            return

        if decision.get("type") != "tool_call":
            text = decision.get("text", "...")
            self._respond(call_id, conv, text, ACTION_NONE)
            yield from _emit(text, ACTION_NONE)
            return

        name, arguments = decision["name"], decision.get("arguments", {})
        ok, cleaned_or_err = tool_registry.validate_tool_call(name, arguments)
        if not ok:
            log.warning("LLM tool call failed validation: %s", cleaned_or_err)
            reply = "I didn't quite get that. Could you say it differently?"
            self._respond(call_id, conv, reply, ACTION_CLARIFY)
            yield from _emit(reply, ACTION_CLARIFY)
            return
        args = cleaned_or_err
        self.store.log(call_id, "agent", "tool_call", f"{name} {args}")
        arg_preview = str(args)
        if len(arg_preview) > 120:
            arg_preview = arg_preview[:120] + "…"
        # "log" events feed the on-page activity log (shown, never spoken),
        # so the user can see exactly what the agent did — e.g. which file
        # it found or why an email send failed.
        yield {"type": "log", "text": f"running tool: {name}({arg_preview})"}
        filler = _tool_filler(name)
        if filler:
            yield {"type": "sentence", "text": filler}
        out = self._dispatch_tool(call_id, conv, name, args)
        yield {"type": "log",
               "text": f"tool {name} finished → {out.get('action', '')}"}
        yield from _emit(out["reply_text"], out["action"])

    # -- helpers ------------------------------------------------------------
    def _wait_for_result(self, command_id: int) -> dict[str, Any] | None:
        """Block until the laptop reports back, or the command expires/times out."""
        deadline = time.time() + self.wait_timeout
        while time.time() < deadline:
            self.store.expire_sweep()
            res = self.store.get_result(command_id)
            if res is None:
                return None
            if res["status"] in ("found", "not_found", "error", "done",
                                 "path_not_allowed", "dir_listing"):
                return res
            if res["status"] == "expired":
                return None
            time.sleep(self.poll_interval)
        return None

    def _respond(self, call_id: str, conv: dict, reply_text: str, action: str) -> dict[str, str]:
        conv["history"].append({"role": "assistant", "content": reply_text})
        self.store.log(call_id, "agent", "replied", f"[{action}] {reply_text}")
        return {"reply_text": reply_text, "action": action}
