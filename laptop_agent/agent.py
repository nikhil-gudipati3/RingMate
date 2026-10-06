"""Laptop agent: polls the RingMate server for commands and executes them.

Loop:  GET {server_url}/agent/poll  every ``poll_seconds``
  - tool "find_file"   -> search allowed folders, POST /agent/result
                         {status: "found"/"not_found", data: {"candidates": [...],
                          "suggestions": [...]}}. Only file *names/sizes/times*
                         travel here -- no bytes yet. Suggestions are close
                         partial matches for "did you mean ...?" prompts.
  - tool "upload_file" -> safety-check args["path"], POST the bytes to
                         /agent/upload (multipart: command_id form field + file).
                         The server marks the command complete itself.
  - tool "read_file"   -> safety-check args["path"], read a text preview
                         (first ~4000 chars), POST /agent/result
                         {status: "done", data: {"name", "content", "truncated"}}.
                         Binary files are refused.
  - tool "list_files"  -> list the most recently modified files in the allowed
                         folders, POST /agent/result {status: "done",
                         data: {"files": [{"name", "mtime"}]}}.
  - unknown tool       -> POST /agent/result {status: "error"}.

Read-only: this agent never edits or deletes user files. Connection problems
never crash the loop -- it backs off and keeps polling. Ctrl+C exits cleanly.

Start it with:  python -m laptop_agent.agent [config.json]
           or:  python laptop_agent/agent.py [config.json]
"""
from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

if __package__ in (None, ""):
    # Running as a plain script (python laptop_agent/agent.py): make the repo
    # root importable so the laptop_agent package resolves.
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import requests  # noqa: E402

from laptop_agent import file_resolver  # noqa: E402
from laptop_agent.safety import SafetyError, check_size, resolve_inside  # noqa: E402

DEFAULTS: dict = {
    "server_url": "http://127.0.0.1:8000",
    "allowed_folders": [],
    "poll_seconds": 3,
    "max_file_mb": 20,
}
REQUEST_TIMEOUT = 10  # seconds; the server must answer quickly


def load_config(path: str | Path = "agent_config.json") -> dict:
    """Load agent config from a JSON file. Missing file -> defaults.

    Expected keys: server_url, allowed_folders, poll_seconds, max_file_mb.
    """
    cfg = dict(DEFAULTS)
    cfg_path = Path(path)
    if cfg_path.is_file():
        try:
            data = json.loads(cfg_path.read_text())
        except (OSError, json.JSONDecodeError) as exc:
            raise SystemExit(f"Cannot read config {cfg_path}: {exc}")
        if not isinstance(data, dict):
            raise SystemExit(f"Config {cfg_path} must be a JSON object")
        cfg.update(data)
    cfg["server_url"] = str(cfg["server_url"]).rstrip("/")
    return cfg


def _report(server: str, command_id: int, status: str, data: dict) -> None:
    """POST a command outcome to /agent/result. Best-effort: never raises."""
    try:
        resp = requests.post(
            f"{server}/agent/result",
            json={"command_id": command_id, "status": status, "data": data},
            timeout=REQUEST_TIMEOUT,
        )
        resp.raise_for_status()
    except Exception as exc:  # noqa: BLE001 - reporting must not crash the loop
        print(f"[agent] result report failed: {exc}", flush=True)


def _handle_find_file(server: str, command_id: int, args: dict, config: dict) -> None:
    """Run the file search and report candidates (no file bytes yet).

    If the query names an absolute path, it is checked first:
      - outside the allowed folders -> "path_not_allowed" (the server tells
        the user which folder to add to agent_config.json);
      - an allowed directory        -> "dir_listing" with its files;
      - an allowed file             -> "found" with that file.
    Otherwise the normal fuzzy search runs. When nothing matches strongly,
    close partial matches go out as ``suggestions`` so the agent can ask
    "did you mean ...?" instead of giving up.
    """
    query = str(args.get("query", ""))
    folders = config.get("allowed_folders", [])

    path_info = file_resolver.check_path_hint(query, folders)
    status = path_info["status"]
    if status == "outside":
        _report(server, command_id, "path_not_allowed",
                {"path": path_info["hint"]})
        return
    if status == "dir":
        files = file_resolver.list_dir(path_info["path"], folders)
        _report(server, command_id, "dir_listing",
                {"path": path_info["hint"], "files": files})
        return
    if status == "file":
        _report(server, command_id, "found",
                {"candidates": [path_info["candidate"]]})
        return
    # "missing" (inside allowed folders but doesn't exist) and "none" fall
    # through to the normal fuzzy search on the remaining filename words.

    candidates = file_resolver.resolve(
        query=query,
        allowed_folders=folders,
        file_type=args.get("file_type"),
        sort=args.get("sort", "recent"),
        max_results=int(args.get("max_results", 5)),
    )
    data: dict = {"candidates": candidates}
    if not candidates:
        data["suggestions"] = file_resolver.suggest(
            query=query,
            allowed_folders=folders,
            file_type=args.get("file_type"),
            max_results=3,
        )
    status = "found" if candidates else "not_found"
    _report(server, command_id, status, data)


_TEXT_EXTENSIONS = frozenset({
    ".txt", ".md", ".markdown", ".csv", ".tsv", ".json", ".log",
    ".py", ".js", ".ts", ".html", ".css", ".yaml", ".yml",
    ".ini", ".cfg", ".xml", ".sql",
})
_READ_PREVIEW_CHARS = 4000


def _looks_like_text(path: Path) -> bool:
    """Sniff the first bytes: null bytes (or undecodable) mean binary."""
    try:
        with open(path, "rb") as fh:
            chunk = fh.read(512)
    except OSError:
        return False
    if b"\x00" in chunk:
        return False
    return True


def _handle_read_file(server: str, command_id: int, args: dict, config: dict) -> None:
    """Safety-check the path, then report a text preview of the file."""
    raw_path = args.get("path", "")
    safe_path = resolve_inside(raw_path, config.get("allowed_folders", []))
    if not safe_path.is_file():
        raise ValueError(f"not a file: {raw_path}")
    check_size(safe_path, min(int(config.get("max_file_mb", 20)), 5))
    if safe_path.suffix.lower() not in _TEXT_EXTENSIONS \
            and not _looks_like_text(safe_path):
        raise ValueError(f"not a readable text file: {safe_path.name}")
    raw = safe_path.read_bytes()  # read-only read
    text = raw.decode("utf-8", errors="replace")
    truncated = len(text) > _READ_PREVIEW_CHARS
    _report(server, command_id, "done", {
        "name": safe_path.name,
        "content": text[:_READ_PREVIEW_CHARS],
        "truncated": truncated,
    })


def _handle_list_files(server: str, command_id: int, args: dict, config: dict) -> None:
    """Report the most recently modified files in the allowed folders."""
    limit = max(1, min(int(args.get("limit", 5)), 20))
    entries: list[tuple[float, str]] = []
    for folder in config.get("allowed_folders", []) or []:
        base = Path(folder).expanduser()
        if not base.is_dir():
            continue
        for root, _dirs, files in os.walk(base, onerror=lambda _e: None,
                                          followlinks=False):
            for name in files:
                p = Path(root) / name
                try:
                    st = p.stat()
                except OSError:
                    continue
                entries.append((st.st_mtime, name))
    entries.sort(key=lambda t: -t[0])
    seen: set[str] = set()
    files = []
    for mtime, name in entries:
        if name in seen:
            continue
        seen.add(name)
        files.append({"name": name, "mtime": mtime})
        if len(files) >= limit:
            break
    _report(server, command_id, "done", {"files": files})


def _handle_upload_file(server: str, command_id: int, args: dict, config: dict) -> None:
    """Safety-check the path, then upload the file bytes.

    The server marks the command complete on a successful upload, so nothing
    else is reported here. Any failure raises -> run_once reports "error".
    """
    raw_path = args.get("path", "")
    safe_path = resolve_inside(raw_path, config.get("allowed_folders", []))
    check_size(safe_path, int(config.get("max_file_mb", 20)))
    data = safe_path.read_bytes()  # read-only read
    resp = requests.post(
        f"{server}/agent/upload",
        data={"command_id": command_id},
        files={"file": (safe_path.name, data)},
        timeout=REQUEST_TIMEOUT,
    )
    resp.raise_for_status()
    body = resp.json()
    if not body.get("ok"):
        raise RuntimeError(f"upload rejected by server: {body}")


def run_once(config: dict) -> str:
    """Poll once and handle a single command.

    Returns "idle" | "handled:<tool>" | "error:<reason>". Never raises on
    connection problems or bad server responses.
    """
    server = config["server_url"]
    try:
        resp = requests.get(f"{server}/agent/poll", timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        cmd = resp.json()
    except Exception as exc:  # noqa: BLE001 - poll must never crash the loop
        return f"error:connection ({exc})"
    if not cmd:
        return "idle"

    command_id = cmd.get("command_id")
    tool = cmd.get("tool")
    args = cmd.get("args") or {}
    try:
        if tool == "find_file":
            _handle_find_file(server, command_id, args, config)
        elif tool == "upload_file":
            _handle_upload_file(server, command_id, args, config)
        elif tool == "read_file":
            _handle_read_file(server, command_id, args, config)
        elif tool == "list_files":
            _handle_list_files(server, command_id, args, config)
        else:
            _report(server, command_id, "error", {"error": f"unknown tool: {tool}"})
            return f"error:unknown-tool ({tool})"
    except (SafetyError, OSError, RuntimeError, ValueError) as exc:
        _report(server, command_id, "error", {"error": str(exc)})
        return f"error:handler ({exc})"
    except Exception as exc:  # noqa: BLE001 - e.g. requests errors mid-upload
        _report(server, command_id, "error", {"error": str(exc)})
        return f"error:handler ({exc})"
    return f"handled:{tool}"


def main_loop(config: dict) -> None:
    """Poll forever. Ctrl+C exits cleanly; unexpected errors never kill it."""
    poll = float(config.get("poll_seconds", 3))
    print(
        f"[agent] polling {config['server_url']} every {poll}s "
        f"(allowed folders: {len(config.get('allowed_folders', []))}). Ctrl+C to stop.",
        flush=True,
    )
    while True:
        try:
            result = run_once(config)
            if result != "idle":
                print(f"[agent] {result}", flush=True)
        except KeyboardInterrupt:
            print("\n[agent] stopped by user.", flush=True)
            break
        except Exception as exc:  # noqa: BLE001 - the loop must survive anything
            print(f"[agent] unexpected error (continuing): {exc}", flush=True)
        try:
            time.sleep(poll)
        except KeyboardInterrupt:
            print("\n[agent] stopped by user.", flush=True)
            break


def main(argv: list[str] | None = None) -> None:
    """Entry point: load config, then poll forever."""
    args = argv if argv is not None else sys.argv[1:]
    config = load_config(args[0] if args else "agent_config.json")
    if not config.get("allowed_folders"):
        print(
            "[agent] WARNING: no allowed_folders configured - "
            "find_file will find nothing.",
            flush=True,
        )
    main_loop(config)


if __name__ == "__main__":
    main()
