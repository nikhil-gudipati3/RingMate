"""Tiny local notes store: "remember this" / "what did I ask you to remember".

Notes live in a single JSON file (NOTES_PATH env, default notes.json next to
the server working directory). No cloud, no account — the file is the
database. Defensive: a corrupt file is treated as empty, never a crash.
"""
from __future__ import annotations

import datetime
import json
import logging
import os
import threading

log = logging.getLogger("ringmate.notes")


class NotesStore:
    """Append/read short text notes persisted as JSON."""

    def __init__(self, path: str = "notes.json"):
        self.path = path
        self._lock = threading.Lock()

    def _load(self) -> list[dict]:
        try:
            with open(self.path, "r", encoding="utf-8") as fh:
                data = json.load(fh)
            if isinstance(data, list):
                return [n for n in data if isinstance(n, dict)]
        except FileNotFoundError:
            pass
        except (json.JSONDecodeError, OSError) as exc:
            log.warning("Notes file unreadable (%s); treating as empty.", exc)
        return []

    def _save(self, notes: list[dict]) -> None:
        tmp = self.path + ".tmp"
        try:
            with open(tmp, "w", encoding="utf-8") as fh:
                json.dump(notes, fh, ensure_ascii=False, indent=1)
            os.replace(tmp, self.path)
        except OSError as exc:
            log.warning("Could not save notes: %s", exc)

    def add(self, text: str) -> dict:
        """Save a note. Returns {"ok": True, "note": {...}}."""
        text = (text or "").strip()
        if not text:
            return {"ok": False, "error": "empty note"}
        with self._lock:
            notes = self._load()
            note = {
                "id": len(notes) + 1,
                "text": text[:500],
                "created": datetime.datetime.now().isoformat(timespec="minutes"),
            }
            notes.append(note)
            self._save(notes)
        return {"ok": True, "note": note}

    def list(self, limit: int = 10) -> list[dict]:
        """Newest-first notes, up to limit."""
        with self._lock:
            notes = self._load()
        return list(reversed(notes[-max(1, limit):]))

    def find(self, query: str) -> list[dict]:
        """Notes whose text contains every word of the query (case-insensitive)."""
        words = [w for w in query.lower().split() if w]
        if not words:
            return []
        with self._lock:
            notes = self._load()
        return [n for n in notes
                if all(w in n.get("text", "").lower() for w in words)]

    def delete(self, note_id: int) -> bool:
        """Delete a note by id. Returns True if something was removed."""
        with self._lock:
            notes = self._load()
            kept = [n for n in notes if n.get("id") != note_id]
            if len(kept) == len(notes):
                return False
            self._save(kept)
        return True
