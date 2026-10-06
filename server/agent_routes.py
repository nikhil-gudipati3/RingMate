"""HTTP endpoints for the laptop agent + internal command intake.

Contract (frozen):
  POST /command            {tool, args} -> {command_id}
  GET  /agent/poll         -> {command_id, call_id, tool, args} or {}
  POST /agent/result       {command_id, status, data} -> {ok: true}
  POST /agent/upload       multipart: command_id (form), file (bytes) -> {ok: true, path}
"""
from __future__ import annotations

import os
import tempfile
import time

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile

from server.queue_store import QueueStore

router = APIRouter(tags=["agent"])

_UPLOAD_DIR = os.path.join(tempfile.gettempdir(), "ringmate_uploads")
os.makedirs(_UPLOAD_DIR, exist_ok=True)


def get_store(request: Request) -> QueueStore:
    store = request.app.state.store
    if store is None:
        raise HTTPException(500, "Server not initialised")
    return store


@router.post("/command")
def create_command(payload: dict, request: Request):
    """Enqueue a command for the laptop agent. Body: {tool, args}."""
    tool = payload.get("tool")
    args = payload.get("args", {})
    call_id = payload.get("call_id", "")
    if not tool or not isinstance(args, dict):
        raise HTTPException(400, "Body must be {tool: str, args: object}")
    command_id = get_store(request).enqueue(tool, args, call_id=call_id)
    return {"command_id": command_id}


@router.get("/agent/poll")
def agent_poll(request: Request):
    """Laptop agent long-polls here every few seconds. Claims one command."""
    request.app.state.last_laptop_poll = time.time()
    cmd = get_store(request).poll_next()
    return cmd or {}


@router.post("/agent/result")
def agent_result(payload: dict, request: Request):
    """Laptop agent reports a command outcome."""
    try:
        command_id = int(payload["command_id"])
    except (KeyError, TypeError, ValueError):
        raise HTTPException(400, "command_id is required")
    status = payload.get("status", "")
    data = payload.get("data") or {}
    if status not in ("found", "not_found", "error", "done",
                      "path_not_allowed", "dir_listing"):
        raise HTTPException(400, f"Bad status: {status!r}")
    get_store(request).complete(command_id, status, data)
    return {"ok": True}


@router.post("/agent/upload")
async def agent_upload(
    request: Request,
    command_id: int = Form(...),
    file: UploadFile = File(...),
):
    """Laptop agent uploads the confirmed file's bytes."""
    store = get_store(request)
    safe_name = f"{command_id}_{int(time.time())}_{os.path.basename(file.filename or 'upload.bin')}"
    dest = os.path.join(_UPLOAD_DIR, safe_name)
    data = await file.read()
    with open(dest, "wb") as fh:
        fh.write(data)
    store.complete(command_id, "done", {"file_path": dest, "size": len(data)})
    store.log("", "laptop", "upload", f"#{command_id} {len(data)} bytes -> {dest}")
    return {"ok": True, "path": dest, "size": len(data)}
