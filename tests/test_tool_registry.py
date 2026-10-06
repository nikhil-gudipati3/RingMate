"""Tests for server.tool_registry — schema validation of tool calls."""
from server.tool_registry import list_tools, validate_tool_call


def test_nineteen_tools_listed():
    tools = list_tools()
    names = {t["function"]["name"] for t in tools}
    assert names == {"send_email", "find_file", "send_file", "check_calendar",
                     "web_search", "get_datetime", "save_note", "read_notes",
                     "delete_note", "read_file", "list_files", "calculate",
                     "remember_fact", "recall_facts",
                     "create_event", "cancel_event", "reschedule_event",
                     "search_drive", "send_drive_file"}


def test_send_email_valid():
    ok, args = validate_tool_call("send_email", {
        "to": "prasad@example.com", "subject": "Hi", "body": "Hello"})
    assert ok and args["to"] == "prasad@example.com"


def test_send_email_bad_address():
    ok, err = validate_tool_call("send_email", {
        "to": "not-an-email", "subject": "Hi", "body": "Hello"})
    assert not ok and "valid email" in err


def test_send_email_missing_required():
    ok, err = validate_tool_call("send_email", {"to": "a@b.com", "subject": "Hi"})
    assert not ok and "body" in err


def test_send_email_subject_optional():
    ok, args = validate_tool_call("send_email", {
        "to": "a@b.com", "body": "The project is working"})
    assert ok and "subject" not in args


def test_unknown_tool():
    ok, err = validate_tool_call("launch_rockets", {})
    assert not ok and "Unknown tool" in err


def test_unexpected_argument_rejected():
    ok, err = validate_tool_call("send_email", {
        "to": "a@b.com", "subject": "s", "body": "b", "cc": "x@y.com"})
    assert not ok and "Unexpected argument" in err


def test_find_file_defaults_sort():
    ok, args = validate_tool_call("find_file", {"query": "resume"})
    assert ok and args["sort"] == "recent"


def test_find_file_normalises_type():
    ok, args = validate_tool_call("find_file", {"query": "resume", "file_type": "PDF"})
    assert ok and args["file_type"] == "pdf"


def test_find_file_bad_sort():
    ok, err = validate_tool_call("find_file", {"query": "r", "sort": "biggest"})
    assert not ok


def test_send_file_command_id_must_be_int():
    ok, _ = validate_tool_call("send_file", {"command_id": 7})
    assert ok
    ok, err = validate_tool_call("send_file", {"command_id": "seven"})
    assert not ok


def test_check_calendar_defaults_day_to_today():
    ok, args = validate_tool_call("check_calendar", {})
    assert ok and args["day"] == "today"


def test_web_search_requires_query():
    ok, err = validate_tool_call("web_search", {})
    assert not ok and "query" in err


def test_save_note_requires_text():
    ok, err = validate_tool_call("save_note", {})
    assert not ok and "text" in err


def test_wrong_type_rejected():
    ok, err = validate_tool_call("send_email", {
        "to": "a@b.com", "subject": ["not", "a", "string"], "body": "b"})
    assert not ok and "subject" in err


def test_read_file_valid_and_type_normalized():
    ok, args = validate_tool_call("read_file", {"query": "notes", "file_type": ".TXT"})
    assert ok and args["file_type"] == "txt"


def test_read_file_requires_query():
    ok, err = validate_tool_call("read_file", {})
    assert not ok and "query" in err


def test_list_files_limit_clamped():
    ok, args = validate_tool_call("list_files", {"limit": 99})
    assert ok and args["limit"] == 20
    ok, args = validate_tool_call("list_files", {})
    assert ok and args["limit"] == 5


def test_calculate_requires_expression():
    ok, err = validate_tool_call("calculate", {"expression": ""})
    assert not ok
    ok, args = validate_tool_call("calculate", {"expression": "2+2"})
    assert ok


def test_delete_note_requires_query():
    ok, err = validate_tool_call("delete_note", {})
    assert not ok and "query" in err


def test_unknown_tool_rejected():
    ok, err = validate_tool_call("launch_missiles", {})
    assert not ok and "Unknown tool" in err


def test_find_file_purpose_send_accepted():
    ok, args = validate_tool_call("find_file", {"query": "resume", "purpose": "send"})
    assert ok and args["purpose"] == "send"


def test_find_file_purpose_defaults_to_find():
    ok, args = validate_tool_call("find_file", {"query": "resume"})
    assert ok and args["purpose"] == "find"


def test_find_file_purpose_rejects_unknown():
    ok, err = validate_tool_call("find_file", {"query": "resume", "purpose": "delete"})
    assert not ok


def test_find_file_to_accepts_valid_email():
    ok, args = validate_tool_call(
        "find_file", {"query": "resume", "purpose": "send", "to": "prasad@example.com"})
    assert ok and args["to"] == "prasad@example.com"


def test_find_file_to_rejects_bad_email():
    ok, err = validate_tool_call(
        "find_file", {"query": "resume", "purpose": "send", "to": "not-an-email"})
    assert not ok


def test_find_file_to_optional():
    ok, args = validate_tool_call("find_file", {"query": "resume"})
    assert ok and "to" not in args
