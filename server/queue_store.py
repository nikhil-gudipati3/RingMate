"""SQLite-backed command queue + action log.

The queue decouples the phone call from the laptop: the Agent Core enqueues a
command, the laptop agent polls for it every few seconds. Commands carry an
expiry time so an offline laptop degrades gracefully instead of hanging forever.

Thread-safe for use under Uvicorn (single lock around sqlite3 with
check_same_thread=False).
"""
from __future__ import annotations

import json
import sqlite3
import threading
import time
from typing import Any

PENDING = "pending"
CLAIMED = "claimed"
DONE = "done"
EXPIRED = "expired"
NOT_FOUND = "not_found"
ERROR = "error"
FOUND = "found"

_SCHEMA = """
CREATE TABLE IF NOT EXISTS commands (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    call_id     TEXT NOT NULL DEFAULT '',
    tool        TEXT NOT NULL,
    args_json   TEXT NOT NULL DEFAULT '{}',
    status      TEXT NOT NULL DEFAULT 'pending',
    result_json TEXT,
    created_at  REAL NOT NULL,
    claimed_at  REAL,
    expires_at  REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS action_log (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    ts      REAL NOT NULL,
    call_id TEXT NOT NULL DEFAULT '',
    actor   TEXT NOT NULL DEFAULT '',
    action  TEXT NOT NULL,
    detail  TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_commands_status ON commands(status, expires_at);
"""


class QueueStore:
    """Persistent command queue with atomic claim and expiry sweep."""

    def __init__(self, db_path: str, ttl_seconds: int = 120):
        self.db_path = db_path
        self.ttl_seconds = ttl_seconds
        self._lock = threading.Lock()
        self._conn = sqlite3.connect(db_path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        with self._lock:
            self._conn.executescript(_SCHEMA)
            self._conn.commit()

    # -- commands ---------------------------------------------------------
    def enqueue(self, tool: str, args: dict[str, Any], call_id: str = "") -> int:
        """Add a command; returns its id."""
        now = time.time()
        with self._lock:
            cur = self._conn.execute(
                "INSERT INTO commands (call_id, tool, args_json, status, created_at, expires_at)"
                " VALUES (?, ?, ?, ?, ?, ?)",
                (call_id, tool, json.dumps(args), PENDING, now, now + self.ttl_seconds),
            )
            self._conn.commit()
            command_id = cur.lastrowid
        self.log(call_id, "server", "enqueue", f"#{command_id} {tool} {args}")
        return command_id

    def poll_next(self) -> dict[str, Any] | None:
        """Atomically claim the oldest pending, unexpired command."""
        now = time.time()
        with self._lock:
            row = self._conn.execute(
                "SELECT * FROM commands WHERE status=? AND expires_at>? ORDER BY id LIMIT 1",
                (PENDING, now),
            ).fetchone()
            if row is None:
                return None
            self._conn.execute(
                "UPDATE commands SET status=?, claimed_at=? WHERE id=? AND status=?",
                (CLAIMED, now, row["id"], PENDING),
            )
            self._conn.commit()
            claimed = dict(row)
            claimed["status"] = CLAIMED
        self.log(claimed["call_id"], "server", "claimed", f"#{claimed['id']} by laptop agent")
        return {
            "command_id": claimed["id"],
            "call_id": claimed["call_id"],
            "tool": claimed["tool"],
            "args": json.loads(claimed["args_json"]),
        }

    def complete(self, command_id: int, status: str, data: dict[str, Any] | None = None) -> None:
        """Mark a claimed command done (status: done/found/not_found/error,
        path_not_allowed/dir_listing for find_file)."""
        with self._lock:
            row = self._conn.execute(
                "SELECT call_id FROM commands WHERE id=?", (command_id,)
            ).fetchone()
            self._conn.execute(
                "UPDATE commands SET status=?, result_json=? WHERE id=?",
                (status, json.dumps(data or {}), command_id),
            )
            self._conn.commit()
        self.log(row["call_id"] if row else "", "laptop", "complete",
                 f"#{command_id} -> {status}")

    def get_result(self, command_id: int) -> dict[str, Any] | None:
        """Fetch a command's current status + result (for the status-check loop)."""
        with self._lock:
            row = self._conn.execute(
                "SELECT * FROM commands WHERE id=?", (command_id,)
            ).fetchone()
        if row is None:
            return None
        return {
            "command_id": row["id"],
            "call_id": row["call_id"],
            "tool": row["tool"],
            "status": row["status"],
            "result": json.loads(row["result_json"]) if row["result_json"] else {},
        }

    def expire_sweep(self) -> int:
        """Flip pending/claimed commands past their expiry to 'expired'."""
        now = time.time()
        with self._lock:
            cur = self._conn.execute(
                "UPDATE commands SET status=? WHERE status IN (?, ?) AND expires_at<=?",
                (EXPIRED, PENDING, CLAIMED, now),
            )
            self._conn.commit()
            count = cur.rowcount
        if count:
            self.log("", "server", "expire_sweep", f"{count} command(s) expired")
        return count

    # -- action log --------------------------------------------------------
    def log(self, call_id: str, actor: str, action: str, detail: str = "") -> None:
        with self._lock:
            self._conn.execute(
                "INSERT INTO action_log (ts, call_id, actor, action, detail)"
                " VALUES (?, ?, ?, ?, ?)",
                (time.time(), call_id, actor, action, detail),
            )
            self._conn.commit()

    def recent_commands(self, limit: int = 20) -> list[dict[str, Any]]:
        with self._lock:
            rows = self._conn.execute(
                "SELECT id, call_id, tool, args_json, status, created_at FROM commands"
                " ORDER BY id DESC LIMIT ?", (limit,),
            ).fetchall()
        return [
            {"id": r["id"], "call_id": r["call_id"], "tool": r["tool"],
             "args": json.loads(r["args_json"]), "status": r["status"],
             "created_at": r["created_at"]}
            for r in rows
        ]

    def recent_log(self, limit: int = 50) -> list[dict[str, Any]]:
        with self._lock:
            rows = self._conn.execute(
                "SELECT ts, call_id, actor, action, detail FROM action_log"
                " ORDER BY id DESC LIMIT ?", (limit,),
            ).fetchall()
        return [dict(r) for r in rows]

    def close(self) -> None:
        with self._lock:
            self._conn.close()
