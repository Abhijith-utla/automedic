"""
Automedic — FastAPI application entry point.

Provides REST and WebSocket APIs for the Diagnostic Assistant.
Database: SQLite (users, patients, encounters/EMR).
Placeholders for: Whisper (STT), Clinical BERT, Vision, Arduino.
"""

import traceback
import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import auth, encounters, transcription_ws, patients, device_ws, voice, clinical_report, vision
from app.config import settings
from app.db.session import init_db
from app.services.pi_bridge import run_pi_bridge

log = logging.getLogger(__name__)


async def _warmup_models() -> None:
    """
    Warm LLM model(s) once at startup to reduce first-request latency.
    Runs in background and never crashes app startup.
    """
    try:
        from app.services.triage_pipeline import (
            llm_call,
            DEFAULT_OLLAMA_URL,
            TRIAGE_MODEL,
            CARE_PLAN_MODEL,
        )

        models = []
        for m in [TRIAGE_MODEL, CARE_PLAN_MODEL]:
            mm = (m or "").strip()
            if mm and mm not in models:
                models.append(mm)

        system = "Return valid JSON only."
        user = '{"warmup": true}'
        for model in models:
            try:
                await asyncio.to_thread(
                    llm_call,
                    model,
                    DEFAULT_OLLAMA_URL,
                    system,
                    user,
                    32,
                )
                log.info("Model warmup complete: %s", model)
            except Exception as e:
                log.warning("Model warmup failed for %s: %s", model, e)
    except Exception as e:
        log.warning("Model warmup init failed: %s", e)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    if settings.MODEL_WARMUP_ON_START:
        asyncio.create_task(_warmup_models())
    if settings.PI_WS_URL and settings.PI_WS_ENCOUNTER_ID:
        asyncio.create_task(run_pi_bridge())
    yield


app = FastAPI(
    lifespan=lifespan,
    title="Automedic Diagnostic Assistant API",
    description="Edge-to-Cloud diagnostic ecosystem: encounter, transcription, diagnosis, EMR sync.",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api", tags=["auth"])
app.include_router(encounters.router, prefix="/api", tags=["encounters"])
app.include_router(patients.router, prefix="/api", tags=["patients"])
app.include_router(transcription_ws.router, prefix="/api", tags=["transcription"])
app.include_router(device_ws.router, prefix="/api", tags=["device"])
app.include_router(voice.router, prefix="/api", tags=["voice"])
app.include_router(clinical_report.router, prefix="/api", tags=["clinical-report"])
app.include_router(vision.router, prefix="/api", tags=["vision"])


@app.exception_handler(Exception)
def unhandled_exception_handler(request, exc: Exception):
    """Return error detail so frontend and logs can show the real cause."""
    tb = traceback.format_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc), "type": type(exc).__name__},
    )


@app.get("/health")
def health():
    """Health check for load balancers and monitoring."""
    return {"status": "ok", "service": "automedic-api"}
