"""End-to-end: REAL uvicorn server + REAL laptop agent subprocess + REAL files.

The only fakes are the LLM (scripted decisions) and the email sink.
Everything else — HTTP, the queue protocol, the fuzzy file search, the
upload bytes — is the genuine production path. This is the strictest test
short of a live voice call.
"""
import json
import os
import socket
import subprocess
import sys
import threading
import time
from pathlib import Path

import pytest
import requests

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def _free_port() -> int:
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


class FakeLLM:
    def __init__(self, script):
        self.script = list(script)

    def complete(self, messages, tools):
        assert self.script, "FakeLLM ran out of scripted decisions"
        return self.script.pop(0)


class FakeEmail:
    def __init__(self):
        self.sent = []

    def __call__(self, to, subject, body, attachment_path=None):
        self.sent.append({"to": to, "subject": subject, "body": body,
                          "attachment_path": attachment_path})
        return {"ok": True}


@pytest.fixture(scope="module")
def e2e(tmp_path_factory):
    tmp = tmp_path_factory.mktemp("e2e")
    docs = tmp / "Documents"
    docs.mkdir()

    resume_bytes = b"%PDF-1.4 nikhil-resume-bytes-12345"
    (docs / "Nikhil_Resume_2026.pdf").write_bytes(resume_bytes)
    (docs / "ProjectReport_Final.pdf").write_bytes(b"%PDF-1.4 project-report")
    notes_text = "Buy milk. Call Prasad about the demo on Friday."
    (docs / "meeting_notes.txt").write_text(notes_text)
    (docs / "photo.jpg").write_bytes(b"\xff\xd8\xff binary-jpeg-bytes")

    old_env = dict(os.environ)
    os.environ.update({
        "OMNIROUTE_API_KEY": "e2e-dummy",
        "OMNIROUTE_BASE_URL": "http://127.0.0.1:9",
        "OMNIROUTE_MODEL": "e2e-dummy",
        "GMAIL_USER": "e2e@example.com",
        "GMAIL_APP_PASSWORD": "e2e-dummy",
        "USER_EMAIL": "me@example.com",
        "DB_PATH": str(tmp / "e2e.db"),
        "NOTES_PATH": str(tmp / "notes.json"),
        "COMMAND_TTL_SECONDS": "60",
    })
    try:
        import uvicorn  # noqa: E402
        from server.main import app  # noqa: E402
        from server.agent_core import AgentCore  # noqa: E402

        port = _free_port()
        server = uvicorn.Server(uvicorn.Config(
            app, host="127.0.0.1", port=port, log_level="error"))
        thread = threading.Thread(target=server.run, daemon=True)
        thread.start()
        deadline = time.time() + 20
        while not server.started and time.time() < deadline:
            time.sleep(0.1)
        assert server.started, "uvicorn did not start"

        # Swap the real core for a scripted-LLM core sharing the same store.
        llm = FakeLLM([
            {"type": "tool_call", "name": "find_file",
             "arguments": {"query": "resuem", "sort": "recent"}},  # TYPO on purpose
            {"type": "tool_call", "name": "read_file",
             "arguments": {"query": "meeting notes"}},
            {"type": "tool_call", "name": "list_files",
             "arguments": {"limit": 5}},
        ])
        email = FakeEmail()
        core = AgentCore(app.state.store, llm, email,
                         user_email="me@example.com",
                         notes_path=str(tmp / "notes.json"),
                         wait_timeout=25, poll_interval=0.05)
        app.state.agent_core = core

        cfg = {"allowed_folders": [str(docs)], "max_file_mb": 20,
               "poll_seconds": 0.2, "server_url": f"http://127.0.0.1:{port}"}
        cfg_path = tmp / "agent_config.json"
        cfg_path.write_text(json.dumps(cfg))
        agent = subprocess.Popen(
            [sys.executable, "laptop_agent/agent.py", str(cfg_path)],
            cwd=str(ROOT), stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        time.sleep(2)  # let the agent start polling
        assert agent.poll() is None, "laptop agent exited immediately"

        base = f"http://127.0.0.1:{port}"
        yield {"base": base, "email": email, "resume_bytes": resume_bytes,
               "notes_text": notes_text, "docs": docs}

        agent.terminate()
        agent.wait(timeout=10)
        server.should_exit = True
        thread.join(timeout=15)
    finally:
        os.environ.clear()
        os.environ.update(old_env)


def _talk(base, text, call_id="e2e1"):
    r = requests.post(f"{base}/web/talk",
                      json={"text": text, "call_id": call_id}, timeout=60)
    r.raise_for_status()
    return r.json()


def test_e2e_typo_find_confirm_send_real_bytes(e2e):
    base, email = e2e["base"], e2e["email"]
    # NOTE the typo: "resuem". The real fuzzy search must still find it.
    out = _talk(base, "send me my resuem")
    assert out["action"] == "awaiting_confirmation"
    assert "Nikhil_Resume_2026.pdf" in out["reply_text"]

    out = _talk(base, "yes")
    assert out["action"] == "file_sent"
    assert len(email.sent) == 1
    sent = email.sent[0]
    assert sent["to"] == "me@example.com"
    # The attachment is the REAL uploaded file bytes from the laptop.
    data = Path(sent["attachment_path"]).read_bytes()
    assert data == e2e["resume_bytes"]


def test_e2e_read_file_real_content(e2e):
    out = _talk(e2e["base"], "read my meeting notes", call_id="e2e2")
    assert out["action"] == "none"
    assert "Buy milk" in out["reply_text"]
    assert "Prasad" in out["reply_text"]


def test_e2e_list_files(e2e):
    out = _talk(e2e["base"], "what are my recent files", call_id="e2e3")
    assert out["action"] == "none"
    assert "Nikhil_Resume_2026.pdf" in out["reply_text"]
