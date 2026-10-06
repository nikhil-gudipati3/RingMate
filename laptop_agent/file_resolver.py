"""File search + ranking for the RingMate laptop agent.

Token-based fuzzy search, built for how people actually talk:

- The query is split into tokens and filler words are dropped, so
  "send me my latest resume" and "resume" search the same way.
- Filenames are split into tokens on separators AND camelCase, so
  "ProjectReport_Final.pdf" matches "final report".
- Each query token scores against filename tokens:
  exact (3) > prefix (2) > substring (1) > typo-tolerant fuzzy.
- Whole-query bonuses keep exact filename hits on top.
- ``resolve()`` returns strong matches (every query token matched).
  ``suggest()`` returns close partial matches so the agent can ask
  "is this the file?" instead of giving up.

Read-only: this module never modifies the filesystem.
"""
from __future__ import annotations

import difflib
import os
import re
from pathlib import Path

from laptop_agent.safety import SafetyError, resolve_inside

_TOKEN_SPLIT = re.compile(r"[\W_]+")
_CAMEL_SPLIT = re.compile(r"(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])")
_NOSEP = re.compile(r"[\W_]+")

# Absolute folder/file paths people paste into chat, e.g.
#   D:\PythonCourseWork\Day-01   D:/Work/report.pdf   /home/nikhil/docs
# Used to (a) keep path parts out of filename matching and (b) answer
# "what files are in D:\path" by listing the directory directly.
_PATH_HINT_RE = re.compile(
    r"(?:[A-Za-z]:[\\/][^\s\"']*|/(?:[^\s\"']+[\\/])+[^\s\"']*|/[^\s\"']+)"
)
_TRAILING_PUNCT = ".,;:!?\"')]}"

# File extensions people say as part of the name ("resume.pdf", "notes.txt").
# A trailing extension token is treated as a file-type filter, not a
# filename token, so "python_introduction.txt" matches python_introduction.txt.
_KNOWN_EXTENSIONS = frozenset({
    "txt", "md", "markdown", "csv", "tsv", "json", "log",
    "pdf", "docx", "doc", "odt", "rtf",
    "xlsx", "xls", "ods",
    "pptx", "ppt", "odp",
    "jpg", "jpeg", "png", "heic", "webp", "gif", "bmp", "svg",
    "mp4", "mov", "mkv", "avi",
    "mp3", "wav", "m4a", "ogg",
    "zip", "rar", "7z",
    "py", "js", "ts", "html", "css", "yaml", "yml", "xml", "sql",
})

# Filler words people add when speaking; never the thing they're looking for.
_STOPWORDS = frozenset({
    "my", "the", "a", "an", "latest", "recent", "newest", "oldest",
    "file", "files", "document", "documents", "doc", "docs",
    "please", "send", "me", "find", "get", "show", "give", "email", "mail",
    "look", "for", "of", "on", "in", "to", "and", "is", "it", "its", "this",
    "called", "named", "titled", "attachment",
    "can", "could", "would", "you", "your", "yours", "yourselves",
    "what", "whats", "which", "where", "when", "how",
    "are", "there", "inside", "within", "outside",
    "path", "folder", "directory",
})

# Generic words that hint at a file type (only used when no explicit
# file_type was passed).
_EXT_HINTS = {
    "photo": {"jpg", "jpeg", "png", "heic", "webp"},
    "image": {"jpg", "jpeg", "png", "heic", "webp"},
    "picture": {"jpg", "jpeg", "png", "heic", "webp"},
    "screenshot": {"png", "jpg", "jpeg"},
    "document": {"pdf", "docx", "doc", "txt", "md"},
    "spreadsheet": {"xlsx", "xls", "csv"},
    "excel": {"xlsx", "xls", "csv"},
    "presentation": {"pptx", "ppt"},
    "slides": {"pptx", "ppt"},
    "video": {"mp4", "mov", "mkv"},
    "audio": {"mp3", "wav", "m4a"},
    "pdf": {"pdf"},
    "word": {"docx", "doc"},
}
# Plural forms map to the same families ("show my photos").
for _singular in list(_EXT_HINTS):
    _EXT_HINTS.setdefault(_singular + "s", _EXT_HINTS[_singular])

_FUZZY_MIN_RATIO = 0.8
_SUGGEST_MIN_SCORE = 2.0


def _tokens(text: str) -> list[str]:
    """Split text into lowercase tokens on separators and camelCase."""
    out: list[str] = []
    for part in _TOKEN_SPLIT.split(text):
        for tok in _CAMEL_SPLIT.split(part):
            tok = tok.lower()
            if tok:
                out.append(tok)
    return out


def _query_tokens(query: str) -> list[str]:
    """Query tokens with filler words dropped (keeps at least one token)."""
    toks = _tokens(query)
    kept = [t for t in toks if t not in _STOPWORDS]
    return kept or toks


def extract_path_hint(query: str) -> str | None:
    """Return the first absolute path mentioned in *query*, if any.

    Trailing punctuation from chat ("...in D:\\Work.") is stripped.
    """
    m = _PATH_HINT_RE.search(query or "")
    if not m:
        return None
    return m.group(0).rstrip(_TRAILING_PUNCT) or None


def strip_path_hints(query: str) -> str:
    """Remove absolute paths from *query* so their parts (D, Work, Day, 01)
    don't pollute filename matching."""
    return _PATH_HINT_RE.sub(" ", query or "")


def _query_tokens_and_ext(query: str) -> tuple[list[str], str | None]:
    """Tokens plus an extension hint.

    "python_introduction.txt" -> (["python", "introduction"], "txt"), so the
    exact filename (with extension) matches instead of failing.
    """
    toks = _query_tokens(strip_path_hints(query))
    ext = None
    if len(toks) > 1 and toks[-1] in _KNOWN_EXTENSIONS:
        ext = toks.pop()
    return toks, ext


def _token_score(qtok: str, ftoks: list[str]) -> float:
    """Best match of one query token against the filename's tokens."""
    best = 0.0
    # Very short tokens (e.g. "no" from "zzz_no_such_file") only match exactly;
    # otherwise they prefix-match half the filesystem ("no" -> "notes").
    short = len(qtok) < 3
    for ftok in ftoks:
        if ftok == qtok:
            return 3.0  # exact beats everything
        if short:
            continue
        if ftok.startswith(qtok):
            best = max(best, 2.0)
        elif qtok in ftok:
            best = max(best, 1.0)
        else:
            ratio = difflib.SequenceMatcher(None, qtok, ftok).ratio()
            if ratio >= _FUZZY_MIN_RATIO:
                best = max(best, 1.5 * ratio)
    return best


def _whole_query_bonus(stem_nosep: str, sq: str) -> float:
    """Bonus when the whole query matches the filename contiguously."""
    if not sq:
        return 0.0
    if stem_nosep == sq:
        return 5.0
    if stem_nosep.startswith(sq):
        return 2.0
    if sq in stem_nosep:
        return 1.0
    return 0.0


def _walk_files(base: Path):
    """Yield file paths under *base*, recursively. Never raises on bad dirs."""
    for root, _dirs, files in os.walk(base, onerror=lambda _e: None, followlinks=False):
        for name in files:
            yield Path(root) / name


def _iter_candidates(allowed_folders: list[str]):
    """Yield (safe_path, stat) for every readable file in allowed folders."""
    for folder in allowed_folders or []:
        base = Path(folder).expanduser()
        if not base.is_dir():
            continue
        for candidate in _walk_files(base):
            try:
                safe = resolve_inside(candidate, allowed_folders)
            except SafetyError:
                continue  # symlink escape or otherwise outside allowed folders
            if not safe.is_file():
                continue
            try:
                stat = safe.stat()
            except OSError:
                continue  # unreadable -> skip
            if not os.access(safe, os.R_OK):
                continue
            yield safe, stat


def _score_file(safe: Path, qtokens: list[str]) -> tuple[float, int]:
    """Return (total_score, matched_token_count) for one file."""
    ftoks = _tokens(safe.stem)
    if not ftoks:
        return 0.0, 0
    per_token = [_token_score(q, ftoks) for q in qtokens]
    matched = sum(1 for s in per_token if s > 0)
    stem_nosep = _NOSEP.sub("", safe.stem.lower())
    sq = "".join(qtokens)
    total = sum(per_token) + _whole_query_bonus(stem_nosep, sq)
    return total, matched


def _ranked(query: str, allowed_folders: list[str], file_type: str | None,
            sort: str, strong_only: bool) -> list[dict]:
    qtokens, ext_hint = _query_tokens_and_ext(query)
    if not qtokens or not allowed_folders:
        return []
    ext = file_type.strip().lower().lstrip(".") if file_type else ext_hint
    hint_exts: set[str] = set()
    if not ext:
        for tok in qtokens:
            hint_exts |= _EXT_HINTS.get(tok, set())
    # "show my photos" — the query is ONLY a type hint, so every file of that
    # type is a match (ranked by recency).
    type_only = bool(qtokens) and all(t in _EXT_HINTS for t in qtokens)

    scored: list[tuple] = []
    for safe, stat in _iter_candidates(allowed_folders):
        if ext and safe.suffix.lower().lstrip(".") != ext:
            continue
        if hint_exts and safe.suffix.lower().lstrip(".") not in hint_exts:
            continue
        if type_only:
            total, matched = 2.0, len(qtokens)
        else:
            total, matched = _score_file(safe, qtokens)
        if strong_only and matched < len(qtokens):
            continue
        if not strong_only and (matched == 0 or total < _SUGGEST_MIN_SCORE):
            continue
        scored.append(
            (
                total,
                matched,
                stat.st_mtime,
                safe.name.lower(),
                {
                    "name": safe.name,
                    "path": str(safe),
                    "size": stat.st_size,
                    "mtime": stat.st_mtime,
                    "score": round(total, 2),
                },
            )
        )

    if sort == "name":
        scored.sort(key=lambda t: (-t[0], -t[1], t[3]))
    else:  # "recent" (default)
        scored.sort(key=lambda t: (-t[0], -t[1], -t[2], t[3]))
    return [entry[4] for entry in scored]


def resolve(
    query: str,
    allowed_folders: list[str],
    file_type: str | None = None,
    sort: str = "recent",
    max_results: int = 5,
) -> list[dict]:
    """Search allowed folders for files matching *query*.

    Returns strong matches (every query token matched), ranked best first.
    Each dict: {"name", "path", "size", "mtime", "score"}. ``path`` is
    server-side only — never spoken or shown to the user.
    """
    return _ranked(query, allowed_folders, file_type, sort,
                   strong_only=True)[:max_results]


def suggest(
    query: str,
    allowed_folders: list[str],
    file_type: str | None = None,
    max_results: int = 3,
) -> list[dict]:
    """Close partial matches for "did you mean ...?" prompts.

    Returns files where at least one query token matched, ranked by score.
    Empty when nothing is even close.
    """
    return _ranked(query, allowed_folders, file_type, "recent",
                   strong_only=False)[:max_results]


def check_path_hint(query: str, allowed_folders: list[str]) -> dict:
    """Check an absolute path mentioned in *query* against allowed folders.

    Returns {"hint": str|None, "status": ...} where status is one of:
      "none"     - no path mentioned in the query
      "outside"  - path is outside the allowed folders (not searchable)
      "missing"  - path is inside allowed folders but doesn't exist
      "dir"      - path is an allowed directory (list it with list_dir)
      "file"     - path is an allowed file (use it directly)
    """
    hint = extract_path_hint(query)
    if not hint:
        return {"hint": None, "status": "none"}
    try:
        safe = resolve_inside(hint, allowed_folders)
    except SafetyError:
        return {"hint": hint, "status": "outside"}
    if safe.is_dir():
        return {"hint": hint, "status": "dir", "path": str(safe)}
    if safe.is_file():
        try:
            stat = safe.stat()
        except OSError:
            return {"hint": hint, "status": "missing", "path": str(safe)}
        return {"hint": hint, "status": "file", "path": str(safe),
                "candidate": {"name": safe.name, "path": str(safe),
                              "size": stat.st_size, "mtime": stat.st_mtime,
                              "score": 10.0}}
    return {"hint": hint, "status": "missing", "path": str(safe)}


def list_dir(dir_path: str | Path, allowed_folders: list[str],
             max_results: int = 10) -> list[dict]:
    """List files directly inside an allowed directory.

    Same candidate dict shape as resolve(). Used when the user names a
    folder outright ("what files are in D:\\Work").
    """
    try:
        safe = resolve_inside(dir_path, allowed_folders)
    except SafetyError:
        return []
    if not safe.is_dir():
        return []
    entries: list[dict] = []
    try:
        names = sorted(os.listdir(safe), key=str.lower)
    except OSError:
        return []
    for name in names:
        p = safe / name
        if not p.is_file():
            continue
        try:
            stat = p.stat()
        except OSError:
            continue
        entries.append({"name": name, "path": str(p), "size": stat.st_size,
                        "mtime": stat.st_mtime, "score": 5.0})
        if len(entries) >= max_results:
            break
    return entries
