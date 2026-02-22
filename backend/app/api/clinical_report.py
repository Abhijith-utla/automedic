"""
API for running the clinical agents (triage + care plan) and retrieving the report.

Input: 4–5 sentence summary of the doctor–patient conversation (video/audio transcript).
Flow: summary → Agent 1 (triage) + Agent 2 (care plan) → parser agent → structured JSON for dashboard graphics.
"""

import json
import os
import re
import urllib.error
import urllib.request
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.api.auth import get_current_user_id
from app.db.session import get_db
from app.models.encounter import Encounter
from app.services.clinical_agents import run_agents_via_script, run_agents_via_script_stream, agent_report_to_diagnosis_response
from app.config import settings

router = APIRouter()


class ClinicalReportRequest(BaseModel):
    """Request body: paragraph and optional encounter_id to store result. Report comes only from agent output (no demo/mock)."""

    paragraph: str
    encounter_id: Optional[str] = None


class TranscriptKeywordsRequest(BaseModel):
    transcript: str
    max_keywords: int = 40


class FinalCondenseRequest(BaseModel):
    transcript: str
    vision_notes: list[str] = []
    max_keywords: int = 30


def _extract_json(text: str) -> str:
    if not text:
        return "{}"
    for pat in [r"```(?:json)?\s*(\{[\s\S]*?\})\s*```", r"(\{[\s\S]*\})"]:
        m = re.search(pat, text)
        if m:
            return m.group(1)
    return "{}"


def _ollama_keywords(transcript: str, max_keywords: int) -> list[str]:
    model = (os.environ.get("TRIAGE_PIPELINE_TRIAGE_MODEL") or settings.TRIAGE_PIPELINE_TRIAGE_MODEL or "mistral").strip()
    base_url = (os.environ.get("OLLAMA_URL") or "http://localhost:11434").rstrip("/")
    prompt = (
        "Extract only the most important clinical keywords from the transcript.\n"
        "Return one JSON object only in this exact schema:\n"
        '{"keywords":["word1","word2"]}\n'
        "Rules: keywords only (no sentences), lower-case, deduplicated, include symptoms, duration, severity, vitals, risk factors, meds, allergies.\n"
        f"Return at most {max_keywords} keywords.\n\n"
        f"Transcript:\n{transcript.strip()}"
    )
    body = json.dumps(
        {
            "model": model,
            "prompt": prompt,
            "stream": False,
            "format": "json",
            "options": {"num_predict": 220, "temperature": 0.1},
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        f"{base_url}/api/generate",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            payload = json.loads(r.read().decode("utf-8"))
    except urllib.error.URLError as e:
        raise HTTPException(status_code=502, detail=f"Cannot reach Ollama at {base_url}: {e}") from e
    except urllib.error.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Ollama HTTP {e.code}: {e.reason}") from e
    if "error" in payload:
        raise HTTPException(status_code=502, detail=f"Ollama error: {payload['error']}")
    raw = str(payload.get("response") or "").strip()
    parsed = {}
    try:
        parsed = json.loads(raw)
    except Exception:
        try:
            parsed = json.loads(_extract_json(raw))
        except Exception:
            parsed = {}
    kws = parsed.get("keywords") if isinstance(parsed, dict) else None
    if not isinstance(kws, list):
        return []
    out: list[str] = []
    seen = set()
    for k in kws:
        term = str(k or "").strip().lower()
        if not term or len(term) < 2 or len(term) > 48:
            continue
        if term in seen:
            continue
        seen.add(term)
        out.append(term)
        if len(out) >= max_keywords:
            break
    return out


def _ollama_final_condense(transcript: str, vision_notes: list[str], max_keywords: int) -> dict:
    model = (os.environ.get("TRIAGE_PIPELINE_TRIAGE_MODEL") or settings.TRIAGE_PIPELINE_TRIAGE_MODEL or "mistral").strip()
    base_url = (os.environ.get("OLLAMA_URL") or "http://localhost:11434").rstrip("/")
    vision_block = "\n".join([f"- {v}" for v in (vision_notes or []) if str(v).strip()])
    prompt = (
        "You are a clinical summarizer.\n"
        "Return one JSON object only in this exact schema:\n"
        '{"summary":"", "keywords":[]}\n'
        "Rules:\n"
        "1) summary must be 3 to 5 short sentences.\n"
        "2) use dense medical language and key findings only.\n"
        "3) avoid filler words and conversational phrasing.\n"
        "4) include critical symptoms, timing, vitals, wound/imaging findings, risk clues.\n"
        "5) keywords must be medical terms or clinically relevant entities only.\n"
        "6) keywords lower-case, deduplicated, max "
        f"{max_keywords} entries.\n\n"
        f"Transcript:\n{transcript.strip()}\n\n"
        f"Vision findings:\n{vision_block or '- none'}"
    )
    body = json.dumps(
        {
            "model": model,
            "prompt": prompt,
            "stream": False,
            "format": "json",
            "options": {"num_predict": 320, "temperature": 0.1},
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        f"{base_url}/api/generate",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=150) as r:
            payload = json.loads(r.read().decode("utf-8"))
    except urllib.error.URLError as e:
        raise HTTPException(status_code=502, detail=f"Cannot reach Ollama at {base_url}: {e}") from e
    except urllib.error.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Ollama HTTP {e.code}: {e.reason}") from e
    if "error" in payload:
        raise HTTPException(status_code=502, detail=f"Ollama error: {payload['error']}")

    raw = str(payload.get("response") or "").strip()
    parsed = {}
    try:
        parsed = json.loads(raw)
    except Exception:
        try:
            parsed = json.loads(_extract_json(raw))
        except Exception:
            parsed = {}

    summary = str(parsed.get("summary") or "").strip()
    kws = parsed.get("keywords") if isinstance(parsed, dict) else []
    keywords: list[str] = []
    if isinstance(kws, list):
        seen = set()
        for item in kws:
            term = str(item or "").strip().lower()
            if not term or len(term) < 2 or len(term) > 64 or term in seen:
                continue
            seen.add(term)
            keywords.append(term)
            if len(keywords) >= max_keywords:
                break

    return {"summary": summary, "keywords": keywords}


@router.post("/clinical-report")
def run_clinical_report(
    body: ClinicalReportRequest,
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """
    Run triage + care plan agents (Ministral) on a clinical summary. Output is stored as
    agent_report_json and diagnosis_json (report only from agent; no mock). Optionally pass encounter_id to store.
    """
    result = run_agents_via_script(body.paragraph.strip())
    if result.get("error"):
        raise HTTPException(status_code=502, detail=result["error"])

    if body.encounter_id and db is not None:
        encounter = db.query(Encounter).filter(
            Encounter.id == body.encounter_id,
            Encounter.doctor_id == user_id,
        ).first()
        if encounter:
            encounter.agent_report_json = {
                "paragraph_summary": result.get("paragraph_summary"),
                "agent1_triage": result.get("agent1_triage"),
                "agent2_care_plan": result.get("agent2_care_plan"),
                "care_plan_structured": result.get("care_plan_structured"),
                "pipeline_json": result.get("pipeline_json"),
                "raw_output": result.get("raw_output"),
                "parse_failed": result.get("parse_failed"),
            }
            # Fill diagnosis from agent output only (no mock)
            diagnosis = agent_report_to_diagnosis_response(
                {k: result.get(k) for k in ("paragraph_summary", "agent1_triage", "agent2_care_plan", "care_plan_structured")},
                paragraph=body.paragraph.strip(),
            )
            encounter.diagnosis_json = diagnosis.model_dump()
            encounter.chief_complaint = diagnosis.chief_complaint
            encounter.clinical_summary = diagnosis.clinical_summary
            db.commit()

    return {
        "ok": True,
        "paragraph_summary": result.get("paragraph_summary"),
        "agent1_triage": result.get("agent1_triage"),
        "agent2_care_plan": result.get("agent2_care_plan"),
        "care_plan_structured": result.get("care_plan_structured"),
        "pipeline_json": result.get("pipeline_json"),
        "raw_output": result.get("raw_output"),
        "parse_failed": result.get("parse_failed"),
    }


@router.post("/clinical-report/keywords")
def summarize_transcript_keywords(
    body: TranscriptKeywordsRequest,
    _user_id: str = Depends(get_current_user_id),
):
    transcript = (body.transcript or "").strip()
    if not transcript:
        raise HTTPException(status_code=400, detail="Transcript is required")
    max_keywords = max(5, min(int(body.max_keywords or 40), 80))
    keywords = _ollama_keywords(transcript, max_keywords=max_keywords)
    keyword_text = ", ".join(keywords)
    return {"ok": True, "keywords": keywords, "keyword_text": keyword_text}


@router.post("/clinical-report/final-condensed")
def final_condensed_summary(
    body: FinalCondenseRequest,
    _user_id: str = Depends(get_current_user_id),
):
    transcript = (body.transcript or "").strip()
    if not transcript:
        raise HTTPException(status_code=400, detail="Transcript is required")
    max_keywords = max(10, min(int(body.max_keywords or 30), 60))
    result = _ollama_final_condense(transcript, body.vision_notes or [], max_keywords=max_keywords)
    summary = str(result.get("summary") or "").strip()
    keywords = result.get("keywords") or []
    return {
        "ok": True,
        "summary": summary,
        "keywords": keywords,
        "keyword_text": ", ".join(keywords),
    }


def _stream_events(paragraph: str, encounter_id: Optional[str], user_id: str, db):
    """Generator that yields SSE events: progress messages then final result or error."""
    for event, payload in run_agents_via_script_stream(paragraph.strip()):
        if event == "progress":
            yield f"data: {json.dumps({'event': 'progress', 'message': payload})}\n\n"
        elif event == "error":
            yield f"data: {json.dumps({'event': 'error', 'detail': payload})}\n\n"
            return
        elif event == "result":
            report = payload
            if encounter_id and db is not None:
                encounter = db.query(Encounter).filter(
                    Encounter.id == encounter_id,
                    Encounter.doctor_id == user_id,
                ).first()
                if encounter:
                    encounter.agent_report_json = {
                        "paragraph_summary": report.get("paragraph_summary"),
                        "agent1_triage": report.get("agent1_triage"),
                        "agent2_care_plan": report.get("agent2_care_plan"),
                        "care_plan_structured": report.get("care_plan_structured"),
                        "pipeline_json": report.get("pipeline_json"),
                        "raw_output": report.get("raw_output"),
                        "parse_failed": report.get("parse_failed"),
                    }
                    diagnosis = agent_report_to_diagnosis_response(
                        {k: report.get(k) for k in ("paragraph_summary", "agent1_triage", "agent2_care_plan", "care_plan_structured")},
                        paragraph=paragraph,
                    )
                    encounter.diagnosis_json = diagnosis.model_dump()
                    encounter.chief_complaint = diagnosis.chief_complaint
                    encounter.clinical_summary = diagnosis.clinical_summary
                    db.commit()
            yield f"data: {json.dumps({'event': 'result', 'ok': True, **report})}\n\n"
            return


@router.post("/clinical-report/stream")
def run_clinical_report_stream(
    body: ClinicalReportRequest,
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """
    Run agents with live progress. Streams SSE: progress messages then result or error.
    Report data comes only from agent output (no demo/mock).
    """
    return StreamingResponse(
        _stream_events(body.paragraph.strip(), body.encounter_id, user_id, db),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/encounters/{encounter_id}/agent-report")
def get_agent_report(
    encounter_id: str,
    user_id: str = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Get stored agent report for an encounter (if any)."""
    encounter = db.query(Encounter).filter(
        Encounter.id == encounter_id,
        Encounter.doctor_id == user_id,
    ).first()
    if not encounter:
        raise HTTPException(status_code=404, detail="Encounter not found")
    if not encounter.agent_report_json:
        return {"ok": True, "report": None}
    return {"ok": True, "report": encounter.agent_report_json}
