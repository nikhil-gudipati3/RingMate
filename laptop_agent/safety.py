"""Safety layer for the RingMate laptop agent.

Read-only by construction: this module exposes NO functions that write, modify,
or delete files. It only validates paths (must stay inside allowed folders) and
file sizes before the agent reads them.
"""
from __future__ import annotations

from pathlib import Path


class SafetyError(Exception):
    """Raised when a path or file fails a safety check."""


def resolve_inside(path: str | Path, allowed_folders: list[str]) -> Path:
    """Resolve *path* (following symlinks and ``..``) and ensure it sits inside
    one of *allowed_folders*.

    Returns the resolved absolute Path. Raises SafetyError if the path escapes
    the allowed folders, if no allowed folders are configured, or if the path
    cannot be resolved.
    """
    if not allowed_folders:
        raise SafetyError("No allowed folders configured")
    try:
        target = Path(path).expanduser().resolve()
    except (OSError, RuntimeError) as exc:
        raise SafetyError(f"Cannot resolve path {path!r}: {exc}")
    for folder in allowed_folders:
        try:
            base = Path(folder).expanduser().resolve()
        except (OSError, RuntimeError):
            continue
        try:
            target.relative_to(base)
        except ValueError:
            continue
        return target
    raise SafetyError(f"Path is outside allowed folders: {path!r}")


def check_size(path: Path, max_mb: int) -> None:
    """Raise SafetyError if the file at *path* exceeds *max_mb* megabytes."""
    try:
        size = path.stat().st_size
    except OSError as exc:
        raise SafetyError(f"Cannot stat file {path!r}: {exc}")
    limit = max_mb * 1024 * 1024
    if size > limit:
        raise SafetyError(
            f"File too large: {size} bytes exceeds {max_mb} MB limit ({path})"
        )
