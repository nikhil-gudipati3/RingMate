"""The tool registry: the menu of actions the AI is allowed to choose from.

Each tool is described as an OpenAI-style function schema (name, description,
parameters). The Agent Core hands these schemas to the LLM; the LLM may ONLY
pick from this menu. ``validate_tool_call`` enforces the schemas on the way back.
"""
from __future__ import annotations

import re
from typing import Any

TOOLS: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "send_email",
            "description": (
                "Send a plain-text email to ANY address the user names. Use when the "
                "user asks to email, mail, or send a message to someone. "
                "E.g. 'send hi to xyz@gmail.com' -> to='xyz@gmail.com', subject='Hi', "
                "body='hi'. "
                "E.g. 'send an email to a@b.com saying the project works' -> "
                "to='a@b.com', subject='Project update', body='The project works'. "
                "If the user gives the message but no subject, invent a short "
                "subject from the message (do NOT ask for clarification). "
                "Sends immediately with no confirmation question."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "to": {"type": "string",
                           "description": "Recipient email address, e.g. prasad@example.com"},
                    "subject": {"type": "string",
                                "description": "Email subject line (optional; will be auto-generated from body if omitted)"},
                    "body": {"type": "string", "description": "Plain-text email body"},
                },
                "required": ["to", "body"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "find_file",
            "description": (
                "Search the user's laptop for a file by name. Use when the user asks "
                "for a file on their laptop (resume, assignment, document...). "
                "When the user wants the file SENT to them (e.g. 'send me my "
                "resume'), pass purpose='send': the user is always asked to confirm "
                "which file before it is emailed. Otherwise the file is never sent "
                "without the user confirming."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string",
                             "description": "What to search for, e.g. 'resume'"},
                    "file_type": {"type": "string",
                                  "description": "Optional extension without dot, e.g. 'pdf'"},
                    "sort": {"type": "string", "enum": ["recent", "name"],
                             "description": "Rank by most-recently-modified (default) or name"},
                    "purpose": {"type": "string", "enum": ["find", "send"],
                                "description": "'send' when the user asked for the file to be "
                                               "sent/emailed to them; 'find' otherwise. Default 'find'."},
                    "to": {"type": "string",
                           "description": "Recipient email address when the user wants the file "
                                          "sent to someone specific, e.g. 'send my resume to "
                                          "prasad@example.com'. Leave empty to send to the user's "
                                          "own email address."},
                },
                "required": ["query"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "send_file",
            "description": (
                "Email the file found by find_file as an attachment. NEVER call this "
                "yourself — it is handled automatically after the user confirms, or "
                "immediately when find_file was called with purpose='send' and "
                "returned exactly one match."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "command_id": {"type": "integer",
                                   "description": "The find_file command id the user confirmed"},
                },
                "required": ["command_id"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "check_calendar",
            "description": (
                "READ-ONLY lookup of the user's Google Calendar. Use when the user "
                "asks about their schedule, meetings, appointments, or what is on "
                "their calendar for a day. You CANNOT create, cancel, reschedule, "
                "move, or modify events in any way. If the user asks you to change "
                "something on the calendar, tell them you can only read it, not "
                "modify it. NEVER claim you moved, cancelled, or rescheduled anything."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "day": {"type": "string",
                            "description": "Which day: 'today', 'tomorrow', or 'YYYY-MM-DD'. Default 'today'."},
                },
                "required": [],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "web_search",
            "description": (
                "Search the web for facts, definitions, current information, or "
                "anything you do not know. Use when the user asks a factual "
                "question you cannot answer from conversation."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string",
                             "description": "The user's full question, e.g. 'capital of Telangana'. "
                                            "For follow-ups like 'what about dallas?', write the complete "
                                            "standalone question, e.g. 'what is the weather in dallas?'."},
                },
                "required": ["query"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_datetime",
            "description": (
                "Get the current date and time. Use when the user asks what time "
                "it is, what day it is, or today's date."
            ),
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "save_note",
            "description": (
                "Remember something for the user. Use when the user says 'remember "
                "this', 'note this down', 'remind me', or wants you to keep a "
                "thought, task, or idea."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "text": {"type": "string",
                             "description": "The note to remember, e.g. 'buy milk tomorrow'"},
                },
                "required": ["text"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "read_notes",
            "description": (
                "Read back the user's saved notes. Use when the user asks 'what "
                "did I ask you to remember' or 'show my notes'."
            ),
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "delete_note",
            "description": (
                "Forget a saved note. Use when the user says 'forget that', "
                "'delete that note', or 'forget about ...'."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string",
                             "description": "Words identifying the note to forget, e.g. 'buy milk'"},
                },
                "required": ["query"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": (
                "Read the text contents of a file on the user's laptop out loud "
                "(a short preview). Use when the user asks what's inside a file, "
                "'read my notes', or 'show me the contents of ...'. Only works "
                "for text files."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string",
                             "description": "File name keywords, e.g. 'meeting notes'"},
                    "file_type": {"type": "string",
                                  "description": "Optional extension without dot, e.g. 'txt'"},
                },
                "required": ["query"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_files",
            "description": (
                "List the user's most recently modified files. Use when the user "
                "asks 'what files do I have', 'show my recent files', or 'what's "
                "in my documents'."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "limit": {"type": "integer",
                              "description": "How many files to list (default 5, max 20)"},
                },
                "required": [],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "calculate",
            "description": (
                "Evaluate a math expression. Use for arithmetic, percentages, "
                "and unit-free calculations, e.g. '15% of 240' or 'sqrt(144)'. "
                "Supports + - * / // % ** and parentheses."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "expression": {"type": "string",
                                   "description": "The math expression, e.g. '15 * 240 / 100'"},
                },
                "required": ["expression"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "remember_fact",
            "description": (
                "Save a fact about the user to long-term memory. Use when the user "
                "tells you something to remember (name, preferences, teammates, etc.). "
                "Memory persists across calls. E.g. key='user_name', value='Nikhil'."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "key": {"type": "string",
                            "description": "Short key, e.g. 'user_name', 'favorite_food'"},
                    "value": {"type": "string",
                              "description": "The fact to remember"},
                    "category": {"type": "string",
                                 "description": "Optional category, e.g. 'identity', 'preference'"},
                },
                "required": ["key", "value"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "recall_facts",
            "description": (
                "Recall facts from long-term memory. Use when you need to remember "
                "something about the user from a previous conversation."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "key": {"type": "string",
                            "description": "Optional specific key to recall; omit for all facts"},
                },
                "required": [],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_event",
            "description": (
                "Create a Google Calendar event. Use when the user asks to schedule, "
                "add, or create a meeting/appointment. Requires Google to be connected "
                "(if not, tell the user to visit /web/oauth/authorize)."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "summary": {"type": "string", "description": "Event title, e.g. 'Meeting with Prasad'"},
                    "day": {"type": "string", "description": "'today', 'tomorrow', or 'YYYY-MM-DD'. Default 'today'."},
                    "time": {"type": "string", "description": "'HH:MM' 24-hour, e.g. '18:30'. Default '09:00'."},
                    "duration_min": {"type": "integer", "description": "Duration in minutes. Default 60."},
                },
                "required": ["summary"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "cancel_event",
            "description": (
                "Cancel/delete a Google Calendar event. Use when the user asks to cancel, "
                "delete, or remove a meeting. You must first identify WHICH event — "
                "if the user says 'that meeting' or 'it', use find_event first via "
                "check_calendar, then confirm with the user before cancelling. "
                "NEVER cancel without the user confirming which event."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Words from the event title to find, e.g. 'pankaj'"},
                    "day": {"type": "string", "description": "'today', 'tomorrow', or 'YYYY-MM-DD'."},
                },
                "required": ["query"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "reschedule_event",
            "description": (
                "Move a Google Calendar event to a new day/time. Use when the user asks "
                "to reschedule, move, or postpone a meeting. Identify the event first "
                "(via check_calendar), confirm with the user, then reschedule. "
                "NEVER reschedule without the user confirming which event and the new time."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Words from the event title to find"},
                    "day": {"type": "string", "description": "Current day of the event: 'today', 'tomorrow', or 'YYYY-MM-DD'"},
                    "new_day": {"type": "string", "description": "New day: 'today', 'tomorrow', or 'YYYY-MM-DD'"},
                    "new_time": {"type": "string", "description": "New time 'HH:MM'. Omit to keep same time."},
                },
                "required": ["query", "new_day"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_drive",
            "description": (
                "Search the user's Google Drive for files by name. Use when the user "
                "asks for a file that might be on Drive (not just the laptop). "
                "Returns matching files with id, name, and modified date."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "File name to search for, e.g. 'resume'"},
                },
                "required": ["query"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "send_drive_file",
            "description": (
                "Download a file from Google Drive and email it as an attachment. "
                "Use when the user wants to send a Drive file to someone (or themselves). "
                "You must have the file's Drive ID (from search_drive). "
                "NEVER send without the user confirming the file and recipient. "
                "If no recipient is named, send to the user's own email."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "file_id": {"type": "string", "description": "Google Drive file ID (from search_drive)"},
                    "file_name": {"type": "string", "description": "File name for the attachment"},
                    "to": {"type": "string", "description": "Recipient email. Omit for the user's own email."},
                },
                "required": ["file_id", "file_name"],
                "additionalProperties": False,
            },
        },
    },
]

_BY_NAME = {t["function"]["name"]: t["function"] for t in TOOLS}

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

_TYPE_CHECKS = {
    "string": lambda v: isinstance(v, str),
    "integer": lambda v: isinstance(v, int) and not isinstance(v, bool),
    "number": lambda v: isinstance(v, (int, float)) and not isinstance(v, bool),
    "boolean": lambda v: isinstance(v, bool),
    "array": lambda v: isinstance(v, list),
    "object": lambda v: isinstance(v, dict),
}


def list_tools() -> list[dict[str, Any]]:
    """Return the tool schemas to hand to the LLM."""
    return TOOLS


def validate_tool_call(name: str, arguments: dict[str, Any]) -> tuple[bool, dict[str, Any] | str]:
    """Validate a tool call against its schema.

    Returns (True, cleaned_args) or (False, error_message).
    """
    schema = _BY_NAME.get(name)
    if schema is None:
        return False, f"Unknown tool '{name}'. Available: {sorted(_BY_NAME)}"
    if not isinstance(arguments, dict):
        return False, "Tool arguments must be a JSON object."
    params = schema["parameters"]
    props: dict[str, Any] = params.get("properties", {})
    required: list[str] = params.get("required", [])

    for req in required:
        if req not in arguments or arguments[req] in (None, ""):
            return False, f"Missing required argument '{req}' for tool '{name}'."
    if params.get("additionalProperties") is False:
        for key in arguments:
            if key not in props:
                return False, f"Unexpected argument '{key}' for tool '{name}'."

    cleaned: dict[str, Any] = {}
    for key, value in arguments.items():
        if key not in props:
            continue
        spec = props[key]
        expected = spec.get("type")
        check = _TYPE_CHECKS.get(expected)
        if check and not check(value):
            return False, f"Argument '{key}' must be {expected}, got {type(value).__name__}."
        if "enum" in spec and value not in spec["enum"]:
            return False, f"Argument '{key}' must be one of {spec['enum']}."
        cleaned[key] = value

    if name == "send_email" and not _EMAIL_RE.match(cleaned.get("to", "")):
        return False, f"Argument 'to' is not a valid email address: {cleaned.get('to')!r}."
    if name == "find_file" and cleaned.get("to") \
            and not _EMAIL_RE.match(cleaned["to"]):
        return False, f"Argument 'to' is not a valid email address: {cleaned['to']!r}."
    if name == "find_file":
        cleaned.setdefault("sort", "recent")
        cleaned.setdefault("purpose", "find")
        ft = cleaned.get("file_type")
        if ft:
            cleaned["file_type"] = ft.lower().lstrip(".")
    if name == "read_file":
        ft = cleaned.get("file_type")
        if ft:
            cleaned["file_type"] = ft.lower().lstrip(".")
    if name == "list_files":
        limit = cleaned.get("limit", 5)
        cleaned["limit"] = max(1, min(int(limit), 20))
    if name == "check_calendar":
        cleaned.setdefault("day", "today")

    return True, cleaned
