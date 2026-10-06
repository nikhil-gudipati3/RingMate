"""M11 — evaluation harness: 60 commands through the real Agent Core.

Two modes:
  oracle  python -m server.eval_harness oracle
          Uses an OracleLLM that returns each case's scripted decision.
          Proves the harness + Agent Core paths work (accuracy should be 100%).
  real    python -m server.eval_harness
          Uses the real LLMClient from .env — measures true tool-calling
          accuracy. Needs OMNIROUTE_* / GEMINI_* keys configured.

A fake laptop thread answers find_file/upload_file/read_file/list_files
instantly, and a fake email sink records sends — so the harness is self-contained.
"""
from __future__ import annotations

import json
import sys
import tempfile
import threading
import time
from pathlib import Path

EVAL_DIR = Path(__file__).resolve().parent.parent / "eval"
CASES_PATH = EVAL_DIR / "commands.json"
REPORT_PATH = EVAL_DIR / "last_report.json"


class OracleLLM:
    """Returns scripted decisions — the 'perfect model' for harness self-test."""

    def __init__(self, script):
        self.script = list(script)
        self.decisions: list[dict] = []

    def complete(self, messages, tools):
        decision = self.script.pop(0) if self.script else {"type": "text", "text": "Okay."}
        self.decisions.append(decision)
        return decision

    @property
    def last_provider(self) -> str:
        return "oracle"


class RecordingLLM:
    """Wraps any LLM and records its decisions for scoring."""

    def __init__(self, inner):
        self.inner = inner
        self.decisions: list[dict] = []

    def complete(self, messages, tools):
        decision = self.inner.complete(messages, tools)
        self.decisions.append(decision)
        return decision

    @property
    def last_provider(self) -> str:
        return self.inner.last_provider


class FakeEmail:
    def __init__(self):
        self.sent: list[dict] = []

    def __call__(self, to, subject, body, attachment_path=None):
        self.sent.append({"to": to, "subject": subject, "body": body,
                          "attachment_path": attachment_path})
        return {"ok": True}


def _fake_laptop(store, stop_event) -> None:
    """Instant laptop: answers queue commands with canned results."""
    while not stop_event.is_set():
        cmd = store.poll_next()
        if cmd is None:
            time.sleep(0.02)
            continue
        tool = cmd["tool"]
        args = cmd.get("args") or {}
        if tool == "find_file":
            q = str(args.get("query", ""))
            if q == "nothinghere":
                store.complete(cmd["command_id"], "not_found", {
                    "candidates": [],
                    "suggestions": [{"name": "nothing_here_draft.pdf",
                                     "path": "/tmp/eval_nothing_here_draft.pdf",
                                     "size": 100, "mtime": time.time()}]})
            elif q == "zzz_nope":
                store.complete(cmd["command_id"], "not_found",
                               {"candidates": [], "suggestions": []})
            elif q == "meeting":
                store.complete(cmd["command_id"], "found", {"candidates": [
                    {"name": "meeting_notes.txt",
                     "path": "/tmp/eval_meeting_notes.txt",
                     "size": 120, "mtime": time.time()}]})
            else:
                candidates = [
                    {"name": "resume_v3.pdf", "path": "/tmp/eval_resume_v3.pdf",
                     "size": 1024, "mtime": time.time()},
                    {"name": "resume_v2.pdf", "path": "/tmp/eval_resume_v2.pdf",
                     "size": 900, "mtime": time.time() - 86400},
                ]
                store.complete(cmd["command_id"], "found", {"candidates": candidates})
        elif tool == "upload_file":
            store.complete(cmd["command_id"], "done",
                           {"file_path": "/tmp/eval_resume_v3.pdf", "size": 1024})
        elif tool == "read_file":
            name = str(args.get("path", "")).rsplit("/", 1)[-1] or "file.txt"
            store.complete(cmd["command_id"], "done",
                           {"name": name,
                            "content": f"Contents of {name}. Team meeting on Friday at 3 PM.",
                            "truncated": False})
        elif tool == "list_files":
            store.complete(cmd["command_id"], "done", {"files": [
                {"name": "budget.xlsx", "mtime": time.time()},
                {"name": "todo.md", "mtime": time.time() - 3600}]})
        else:
            store.complete(cmd["command_id"], "error", {"reason": "unknown tool"})


def _score(case: dict, out: dict, llm: RecordingLLM, email: FakeEmail) -> list[str]:
    """Return a list of failed check descriptions (empty = case passed)."""
    exp = case.get("expect", {})
    fails: list[str] = []
    tool_calls = [d for d in llm.decisions if d.get("type") == "tool_call"]
    # Multi-turn cases score the final tool call (e.g. save_note -> read_notes).
    check_call = tool_calls[-1] if len(case.get("script", [])) > 1 and tool_calls else (tool_calls[0] if tool_calls else None)

    if "tool" in exp:
        if exp["tool"] is None and tool_calls:
            fails.append(f"expected no tool call, got {tool_calls[0]['name']}")
        elif exp["tool"] is not None:
            if not tool_calls:
                fails.append(f"expected tool {exp['tool']}, model made no tool call")
            elif check_call["name"] != exp["tool"]:
                fails.append(f"expected tool {exp['tool']}, got {check_call['name']}")
            elif "args" in exp:
                actual = check_call.get("arguments", {})
                for k, v in exp["args"].items():
                    if actual.get(k) != v:
                        fails.append(f"arg {k!r}: expected {v!r}, got {actual.get(k)!r}")

    if "action" in exp:
        want = exp["action"] if isinstance(exp["action"], list) else [exp["action"]]
        if out.get("action") not in want:
            fails.append(f"action: expected {want}, got {out.get('action')!r}")

    if "reply_contains" in exp:
        if exp["reply_contains"].lower() not in out.get("reply_text", "").lower():
            fails.append(f"reply missing {exp['reply_contains']!r}: {out.get('reply_text')!r}")

    if "email_to" in exp:
        if not any(s["to"] == exp["email_to"] for s in email.sent):
            fails.append(f"expected email to {exp['email_to']}, sent={email.sent}")

    if exp.get("no_email") and email.sent:
        fails.append(f"expected no email, but sent {email.sent}")

    return fails


def run_eval(make_core, cases: list[dict], verbose: bool = True) -> dict:
    """Run all cases. make_core(case) -> (AgentCore, RecordingLLM, FakeEmail)."""
    from server.queue_store import QueueStore  # noqa: F401  (ensures import works)

    results = []
    for case in cases:
        core, llm, email = make_core(case)
        stop = threading.Event()
        laptop = threading.Thread(target=_fake_laptop, args=(core.store, stop), daemon=True)
        laptop.start()
        call_id = f"eval-{case['id']}"
        out: dict = {"reply_text": "", "action": "error"}
        try:
            for turn in case["turns"]:
                out = core.handle_turn(call_id, turn)
        except Exception as exc:  # noqa: BLE001
            out = {"reply_text": f"HARNESS EXCEPTION: {exc}", "action": "error"}
        finally:
            stop.set()
            laptop.join(timeout=5)
            core.store.close()
        fails = _score(case, out, llm, email)
        results.append({"id": case["id"], "turns": case["turns"],
                        "passed": not fails, "fails": fails})
        if verbose:
            mark = "PASS" if not fails else "FAIL"
            print(f"[{mark}] #{case['id']:>2} {' | '.join(case['turns'])}"
                  + ("" if not fails else f"  -> {fails}"))

    passed = sum(1 for r in results if r["passed"])
    report = {
        "total": len(results),
        "passed": passed,
        "accuracy": round(passed / len(results) * 100, 1) if results else 0.0,
        "failures": [r for r in results if not r["passed"]],
    }
    return report


def _install_oracle_fakes():
    """Deterministic stand-ins for network tools (oracle mode only)."""
    from server import calendar_tool, websearch_tool

    real_check = calendar_tool.check_calendar
    real_search = websearch_tool.web_search

    def fake_check_calendar(ical_url, day="today"):
        if not ical_url:  # honors the "not configured" path
            return real_check("", day)
        return {"ok": True, "day": "2026-09-27",
                "events": [{"summary": "Dentist appointment", "start": "4:00 PM",
                            "all_day": False}]}

    def fake_web_search(query, timeout=8.0):
        if "japan" in (query or "").lower():
            return {"ok": True, "answer": "Tokyo is the capital of Japan.",
                    "source": "test", "related": []}
        return {"ok": False, "error": "no_results"}

    calendar_tool.check_calendar = fake_check_calendar
    websearch_tool.web_search = fake_web_search
    if not _ORACLE_ORIGINALS:
        _ORACLE_ORIGINALS.update({
            "calendar_tool.check_calendar": real_check,
            "websearch_tool.web_search": real_search,
        })


def _uninstall_oracle_fakes():
    """Restore the real network tools.

    The oracle fakes permanently replace module attributes; without this,
    any test running after the eval harness would silently use the fakes.
    The CLI never calls this — it wants the fakes for the whole run.
    """
    global _ORACLE_FAKES_INSTALLED
    if not _ORACLE_ORIGINALS:
        return
    from server import calendar_tool, websearch_tool

    modules = {"calendar_tool": calendar_tool, "websearch_tool": websearch_tool}
    for dotted, original in _ORACLE_ORIGINALS.items():
        mod_name, attr = dotted.split(".", 1)
        setattr(modules[mod_name], attr, original)
    _ORACLE_FAKES_INSTALLED = False


_ORACLE_FAKES_INSTALLED = False
_ORACLE_ORIGINALS: dict[str, object] = {}


def _make_oracle_core(case):
    """Core wired to the scripted OracleLLM + fake email + temp DB."""
    global _ORACLE_FAKES_INSTALLED
    from server.agent_core import AgentCore
    from server.queue_store import QueueStore

    if not _ORACLE_FAKES_INSTALLED:
        _install_oracle_fakes()
        _ORACLE_FAKES_INSTALLED = True

    tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    tmp.close()
    notes = tempfile.NamedTemporaryFile(suffix=".json", delete=False)
    notes.close()
    store = QueueStore(tmp.name, ttl_seconds=60)
    llm = RecordingLLM(OracleLLM(case.get("script", [])))
    email = FakeEmail()
    core = AgentCore(store, llm, email, user_email="me@example.com",
                     calendar_ical_url=case.get("calendar_url", "https://example.com/secret.ics"),
                     notes_path=notes.name,
                     wait_timeout=10, poll_interval=0.05)
    return core, llm, email


def _make_real_core(case):
    """Core wired to the real LLM client from .env (needs API keys)."""
    from server.agent_core import AgentCore
    from server.config import Settings
    from server.llm_client import LLMClient
    from server.queue_store import QueueStore

    settings = Settings.load()
    tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    tmp.close()
    store = QueueStore(tmp.name, ttl_seconds=120)
    llm = RecordingLLM(LLMClient(
        api_key=settings.omniroute_api_key,
        base_url=settings.omniroute_base_url,
        model=settings.omniroute_model,
        fallback_api_key=settings.gemini_api_key,
        timeout=30,
    ))
    email = FakeEmail()
    core = AgentCore(store, llm, email, user_email=settings.user_email,
                     wait_timeout=60, poll_interval=1.0)
    return core, llm, email


def main() -> None:
    mode = sys.argv[1] if len(sys.argv) > 1 else "real"
    cases = json.loads(CASES_PATH.read_text())
    print(f"RingMate eval — {len(cases)} cases — mode={mode}\n")
    make_core = _make_oracle_core if mode == "oracle" else _make_real_core
    report = run_eval(make_core, cases)
    REPORT_PATH.write_text(json.dumps(report, indent=2))
    print(f"\nAccuracy: {report['passed']}/{report['total']} = {report['accuracy']}%")
    print(f"Report written to {REPORT_PATH}")
    if mode == "real" and report["accuracy"] < 90:
        print("WARNING: below the 90% target — inspect failures and tune the prompt.")


if __name__ == "__main__":
    main()
