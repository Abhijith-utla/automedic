"""
TwiML webhook for Twilio voice calls. When a call connects, Twilio GETs this URL;
we return TwiML that reads the visit summary to the patient.
"""

import xml.etree.ElementTree as ET
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.encounter import Encounter
from app.services.clinical_agents import agent_report_to_diagnosis_response

router = APIRouter()


def _escape_text(text: str) -> str:
    if not text:
        return ""
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&#39;")
    )


def _build_say_script(encounter: Encounter) -> str:
    """Build a short script for Twilio <Say> (TTS). Keep under ~4000 chars. Uses agent report when diagnosis_json missing."""
    diagnosis = encounter.diagnosis_json
    if not diagnosis and encounter.agent_report_json:
        d = agent_report_to_diagnosis_response(
            encounter.agent_report_json,
            paragraph=encounter.agent_report_json.get("paragraph_summary") or "",
        )
        diagnosis = d.model_dump()
    diagnosis = diagnosis or {}
    patient_summary = diagnosis.get("patient_summary") or {}
    headline = patient_summary.get("headline") or "Visit summary"
    summary = patient_summary.get("summary") or ""
    steps = patient_summary.get("steps") or []
    chief = encounter.chief_complaint or diagnosis.get("chief_complaint") or "your recent visit"
    steps_text = ". ".join(steps) if steps else "None specified."
    parts = [
        f"This is a follow-up from your care team about {chief}.",
        f"Summary: {headline}. {summary}",
        f"Next steps: {steps_text}",
        "If you have questions, please contact your care team. Goodbye.",
    ]
    script = " ".join(parts)
    return script[:3900] if len(script) > 3900 else script


@router.get("/voice/twiml", response_class=Response)
def twiml_webhook(encounter_id: str, db: Session = Depends(get_db)):
    """
    Twilio calls this URL when the outbound call connects.
    Returns TwiML that speaks the visit summary to the patient.
    """
    encounter = db.query(Encounter).filter(Encounter.id == encounter_id).first()
    if not encounter:
        raise HTTPException(status_code=404, detail="Encounter not found")
    script = _build_say_script(encounter)
    escaped = _escape_text(script)
    # TwiML: <Response><Say>...</Say></Response>
    root = ET.Element("Response")
    say = ET.SubElement(root, "Say", {"voice": "alice", "language": "en-US"})
    say.text = escaped
    xml_str = ET.tostring(root, encoding="unicode")
    return Response(content=f'<?xml version="1.0" encoding="UTF-8"?>\n{xml_str}', media_type="application/xml")
