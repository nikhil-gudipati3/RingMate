"""Google Drive API: search files and download them.

Read-only scope. Files are downloaded to a temp dir and returned as bytes
for emailing as attachments. All functions return dicts; never raise.
"""
from __future__ import annotations

import logging
import os
import tempfile

from server import google_oauth

log = logging.getLogger("ringmate.gdrive")

_API = "https://www.googleapis.com/drive/v3"


def _headers() -> dict | None:
    token = google_oauth.get_access_token()
    if not token:
        return None
    return {"Authorization": f"Bearer {token}"}


def search(query: str, max_results: int = 10) -> dict:
    """Search Drive files by name. Returns [{id, name, mimeType, modifiedTime}]."""
    import httpx
    headers = _headers()
    if not headers:
        return {"ok": False, "error": "Google not connected. Visit /web/oauth/authorize first."}
    # Search by name containing the query; exclude trashed.
    q = f"name contains '{query.replace(chr(39), '')}' and trashed = false"
    try:
        resp = httpx.get(
            _API + "/files",
            headers=headers,
            params={
                "q": q,
                "fields": "files(id, name, mimeType, modifiedTime, size)",
                "pageSize": max(1, min(20, max_results)),
                "orderBy": "modifiedTime desc",
            },
            timeout=20.0,
        )
        if resp.status_code != 200:
            return {"ok": False, "error": f"Drive API {resp.status_code}: {resp.text[:200]}"}
        files = resp.json().get("files", [])
        return {"ok": True, "files": [
            {"id": f.get("id", ""), "name": f.get("name", ""),
             "mimeType": f.get("mimeType", ""),
             "modifiedTime": f.get("modifiedTime", "")[:10]}
            for f in files
        ]}
    except Exception as exc:  # noqa: BLE001
        log.warning("Drive search failed: %s", exc)
        return {"ok": False, "error": str(exc)}


def download(file_id: str, file_name: str) -> dict:
    """Download a Drive file. Returns {"ok": True, "path": local_path}."""
    import httpx
    headers = _headers()
    if not headers:
        return {"ok": False, "error": "Google not connected."}
    # Sanitize the filename.
    safe = "".join(c for c in os.path.basename(file_name) if c.isalnum() or c in "._- ")[:100]
    if not safe:
        safe = "drive_file"
    dest = os.path.join(tempfile.gettempdir(), f"ringmate_drive_{safe}")
    try:
        with httpx.stream("GET", f"{_API}/files/{file_id}",
                          headers=headers,
                          params={"alt": "media"},
                          timeout=60.0) as resp:
            if resp.status_code != 200:
                return {"ok": False, "error": f"Download failed: HTTP {resp.status_code}"}
            with open(dest, "wb") as fh:
                for chunk in resp.iter_bytes(65536):
                    fh.write(chunk)
        size = os.path.getsize(dest)
        if size == 0:
            return {"ok": False, "error": "Downloaded file is empty"}
        if size > 25 * 1024 * 1024:
            return {"ok": False, "error": "File too large to email (>25 MB)"}
        return {"ok": True, "path": dest, "size": size}
    except Exception as exc:  # noqa: BLE001
        log.warning("Drive download failed: %s", exc)
        return {"ok": False, "error": str(exc)}
