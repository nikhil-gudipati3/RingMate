"""Persistent user memory: facts the agent remembers across calls.

Memory lives in a single JSON file (MEMORY_PATH env, default memory.json next to
the server working directory). No cloud, no account — the file is the database.
Defensive: a corrupt file is treated as empty, never a crash.

Unlike notes (which are explicit "remember this" items), memory stores
structured facts: {"key": "user_name", "value": "Nikhil", "category": "identity"}.
The agent can save facts it learns ("remember_fact") and recall them ("recall_facts").
Memory is loaded into the system prompt so the agent knows the user across calls.
"""
from __future__ import annotations

import datetime
import json
import logging
import os
import threading

log = logging.getLogger("ringmate.memory")


class MemoryStore:
    """Key-value facts about the user, persisted as JSON."""

    def __init__(self, path: str = "memory.json"):
        self.path = path
        self._lock = threading.Lock()

    def _load(self) -> dict:
        try:
            with open(self.path, "r", encoding="utf-8") as fh:
                data = json.load(fh)
            if isinstance(data, dict):
                return data
        except FileNotFoundError:
            pass
        except (json.JSONDecodeError, OSError) as exc:
            log.warning("Memory file unreadable (%s); treating as empty.", exc)
        return {}

    def _save(self, mem: dict) -> None:
        tmp = self.path + ".tmp"
        try:
            with open(tmp, "w", encoding="utf-8") as fh:
                json.dump(mem, fh, ensure_ascii=False, indent=1)
            os.replace(tmp, self.path)
        except OSError as exc:
            log.warning("Could not save memory: %s", exc)

    def remember(self, key: str, value: str, category: str = "general") -> dict:
        """Save a fact. Returns {"ok": True}."""
        key = (key or "").strip().lower().replace(" ", "_")[:50]
        value = (value or "").strip()[:500]
        if not key or not value:
            return {"ok": False, "error": "key and value required"}
        with self._lock:
            mem = self._load()
            mem[key] = {
                "value": value,
                "category": category[:30],
                "updated": datetime.datetime.now().isoformat(timespec="minutes"),
            }
            self._save(mem)
        return {"ok": True, "key": key}

    def recall(self, key: str = "") -> dict:
        """Get a specific fact, or all facts if key is empty."""
        with self._lock:
            mem = self._load()
        if key:
            key = key.strip().lower().replace(" ", "_")
            fact = mem.get(key)
            return {"ok": True, "fact": fact} if fact else {"ok": False, "error": "not found"}
        return {"ok": True, "facts": mem}

    def forget(self, key: str) -> dict:
        """Delete a fact. Returns {"ok": True} if removed."""
        key = (key or "").strip().lower().replace(" ", "_")
        with self._lock:
            mem = self._load()
            if key in mem:
                del mem[key]
                self._save(mem)
                return {"ok": True}
        return {"ok": False, "error": "not found"}

    def get_context_string(self) -> str:
        """Format all facts as a prompt-ready string."""
        with self._lock:
            mem = self._load()
        if not mem:
            return ""
        lines = ["Things you remember about the user:"]
        for key, fact in sorted(mem.items()):
            lines.append(f"- {key.replace('_', ' ')}: {fact['value']}")
        return "\n".join(lines)
