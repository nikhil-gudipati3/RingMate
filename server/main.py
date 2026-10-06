"""RingMate server: FastAPI app wiring all modules together."""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from server import agent_routes, exotel_voice, web_routes
from server.config import Settings
from server.queue_store import QueueStore

app = FastAPI(title="RingMate", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Shared state, created at startup.
app.state.settings = None
app.state.store = None
app.state.agent_core = None


def _startup() -> None:
    settings = Settings.load()  # fail fast on missing secrets
    app.state.settings = settings
    store = QueueStore(settings.db_path, ttl_seconds=settings.command_ttl_seconds)
    app.state.store = store
    app.state.agent_core = _build_agent_core(settings, store)


def _build_agent_core(settings: Settings, store: QueueStore):
    """Assemble the Agent Core: LLM client + email sender + core loop."""
    from server.agent_core import AgentCore
    from server.llm_client import LLMClient
    from server import email_tool

    llm = LLMClient(
        api_key=settings.omniroute_api_key,
        base_url=settings.omniroute_base_url,
        model=settings.omniroute_model,
        fallback_api_key=settings.gemini_api_key,
    )

    def send_email_fn(to: str, subject: str, body: str,
                      attachment_path: str | None = None) -> dict:
        return email_tool.send_email(
            to, subject, body,
            attachment_path=attachment_path,
            gmail_user=settings.gmail_user,
            gmail_app_password=settings.gmail_app_password,
            max_mb=settings.max_attachment_mb,
        )

    return AgentCore(
        store,
        llm,
        send_email_fn,
        user_email=settings.user_email,
        calendar_ical_url=settings.google_calendar_ical_url,
        notes_path=settings.notes_path,
    )


def _shutdown() -> None:
    store = app.state.store
    if store is not None:
        store.close()


from contextlib import asynccontextmanager  # noqa: E402


@asynccontextmanager
async def lifespan(app: FastAPI):
    _startup()
    # Best-effort background warmup: pre-generate the call greeting's TTS
    # audio so the first thing a caller hears plays with zero synthesis delay.
    import threading
    from server import exotel_voice, web_routes
    threading.Thread(target=web_routes.warmup_tts_cache, daemon=True).start()
    threading.Thread(target=exotel_voice.warmup_phone_voice, daemon=True).start()
    yield
    _shutdown()


app.router.lifespan_context = lifespan


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "ringmate"}


app.include_router(agent_routes.router)
app.include_router(web_routes.router)
# Exotel AgentStream phone path. Mounted on /voice/... — never under /web/
# or /app/, so browser behaviour is untouched.
app.include_router(exotel_voice.router)

# Static web UI (talk page + console). Mounted last so API routes take precedence.
app.mount("/app", StaticFiles(directory="web", html=True), name="web")
