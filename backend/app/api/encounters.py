"""
REST API for encounters: create, end, get diagnosis, sync to chart.
All data persisted to DB; encounters tied to patient and doctor.
"""

import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.auth import get_current_user_id
from app.db.session import get_db
from app.models.patient import Patient
from app.models.encounter import Encounter
from app.schemas.encounter import (
    CreateEncounterRequest,
    EndEncounterRequest,
    EncounterResponse,
    DiagnosisResponse,
    SyncToChartRequest,
)
from app.services.clinical_agents import agent_report_to_diagnosis_response
from app.services.patient_email import send_patient_report_email
from app.services.patient_call import initiate_automated_call

router = APIRouter()


def _encounter_response(e: Encounter) -> EncounterResponse:
    return EncounterResponse(
        encounter_id=e.id,
        patient_id=e.patient_id,
        status=e.status,
        started_at=e.started_at.isoformat() if e.started_at else "",
    )


@router.post("/encounters", response_model=EncounterResponse)
def create_encounter(
    body: CreateEncounterRequest,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Start a new encounter for a patient. Requires patient_id."""
    if not body.patient_id:
        raise HTTPException(status_code=400, detail="patient_id required")
    patient = db.query(Patient).filter(
        Patient.id == body.patient_id,
        Patient.doctor_id == user_id,
    ).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    encounter = Encounter(
        id=str(uuid.uuid4()),
        patient_id=body.patient_id,
        doctor_id=user_id,
        status="active",
        started_at=datetime.now(timezone.utc),
        transcript=[],
        vision_log=[],
    )
    db.add(encounter)
    db.commit()
    db.refresh(encounter)
    return _encounter_response(encounter)


@router.get("/encounters/{encounter_id}")
def get_encounter(
    encounter_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Get encounter metadata, transcript, and vision log."""
    encounter = db.query(Encounter).filter(
        Encounter.id == encounter_id,
        Encounter.doctor_id == user_id,
    ).first()
    if not encounter:
        raise HTTPException(status_code=404, detail="Encounter not found")
    return {
        "encounter_id": encounter.id,
        "patient_id": encounter.patient_id,
        "status": encounter.status,
        "started_at": encounter.started_at.isoformat() if encounter.started_at else None,
        "transcript": encounter.transcript or [],
        "vision_log": encounter.vision_log or [],
        "report_accepted_at": encounter.report_accepted_at.isoformat() if encounter.report_accepted_at else None,
        "follow_up": encounter.follow_up_json,
    }


@router.post("/encounters/{encounter_id}/end", response_model=EncounterResponse)
def end_encounter(
    encounter_id: str,
    body: EndEncounterRequest | None = None,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """End encounter, save transcript, run analysis and store diagnosis."""
    encounter = db.query(Encounter).filter(
        Encounter.id == encounter_id,
        Encounter.doctor_id == user_id,
    ).first()
    if not encounter:
        raise HTTPException(status_code=404, detail="Encounter not found")
    if body:
        if body.transcript is not None:
            encounter.transcript = body.transcript
        if body.vision_log is not None:
            encounter.vision_log = body.vision_log
    encounter.status = "ended"
    encounter.ended_at = datetime.now(timezone.utc)
    # Diagnosis and report come only from agent output (clinical report), not mock. Leave null until report is run.
    db.commit()
    db.refresh(encounter)
    return _encounter_response(encounter)


@router.get("/encounters/{encounter_id}/diagnosis", response_model=DiagnosisResponse)
def get_diagnosis(
    encounter_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Get diagnosis for encounter. Uses diagnosis_json if set (from agent report); else builds from agent_report_json; else 404."""
    encounter = db.query(Encounter).filter(
        Encounter.id == encounter_id,
        Encounter.doctor_id == user_id,
    ).first()
    if not encounter:
        raise HTTPException(status_code=404, detail="Encounter not found")
    if encounter.diagnosis_json:
        return DiagnosisResponse(**encounter.diagnosis_json)
    if encounter.agent_report_json:
        diagnosis = agent_report_to_diagnosis_response(
            encounter.agent_report_json,
            paragraph=encounter.agent_report_json.get("paragraph_summary") or "",
        )
        return diagnosis
    raise HTTPException(status_code=404, detail="Diagnosis not ready. Run the clinical model to generate the report.")


@router.post("/encounters/{encounter_id}/accept-report")
def accept_report(
    encounter_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Human-in-the-loop: doctor accepts the diagnosis report."""
    encounter = db.query(Encounter).filter(
        Encounter.id == encounter_id,
        Encounter.doctor_id == user_id,
    ).first()
    if not encounter:
        raise HTTPException(status_code=404, detail="Encounter not found")
    if not encounter.diagnosis_json and not encounter.agent_report_json:
        raise HTTPException(status_code=400, detail="No report to accept. Run the clinical model first.")
    encounter.report_accepted_at = datetime.now(timezone.utc)
    db.commit()
    return {"ok": True, "report_accepted_at": encounter.report_accepted_at.isoformat()}


@router.post("/encounters/{encounter_id}/follow-up")
def submit_follow_up(
    encounter_id: str,
    body: dict,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Send custom email or initiate automated call to patient with report and analysis."""
    encounter = db.query(Encounter).filter(
        Encounter.id == encounter_id,
        Encounter.doctor_id == user_id,
    ).first()
    if not encounter:
        raise HTTPException(status_code=404, detail="Encounter not found")
    method = (body.get("method") or "").lower()
    if method not in ("email", "call"):
        raise HTTPException(status_code=400, detail="method must be 'email' or 'call'")
    note = body.get("note") or ""

    patient = db.query(Patient).filter(Patient.id == encounter.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

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
    chief_complaint = encounter.chief_complaint or diagnosis.get("chief_complaint") or "Recent visit"

    if method == "email":
        if not (patient.email or "").strip():
            raise HTTPException(
                status_code=400,
                detail="Patient has no email on file. Add email in patient info to send report.",
            )
        ok, msg = send_patient_report_email(
            to_email=patient.email.strip(),
            patient_name=patient.name,
            chief_complaint=chief_complaint,
            patient_headline=headline,
            patient_summary=summary,
            steps=steps,
            doctor_note=note,
        )
        if not ok:
            raise HTTPException(
                status_code=502,
                detail=f"Email failed: {msg} Try calling the patient instead.",
            )
    else:
        if not (patient.phone or "").strip():
            raise HTTPException(
                status_code=400,
                detail="Patient has no phone number on file. Add phone in patient info to place call.",
            )
        ok, msg = initiate_automated_call(
            to_phone=patient.phone.strip(),
            patient_name=patient.name,
            chief_complaint=chief_complaint,
            patient_headline=headline,
            patient_summary=summary,
            steps=steps,
            doctor_note=note,
            encounter_id=encounter_id,
        )
        if not ok:
            raise HTTPException(status_code=502, detail=f"Call failed: {msg}")

    encounter.follow_up_json = {
        "method": method,
        "note": note,
        "at": datetime.now(timezone.utc).isoformat(),
    }
    db.commit()
    return {"ok": True, "method": method, "message": msg}


@router.post("/encounters/{encounter_id}/sync")
def sync_to_chart(
    encounter_id: str,
  body: SyncToChartRequest,
  db: Session = Depends(get_db),
  user_id: str = Depends(get_current_user_id),
):
    """Mark encounter as synced to EMR (store synced_at)."""
    encounter = db.query(Encounter).filter(
        Encounter.id == encounter_id,
        Encounter.doctor_id == user_id,
    ).first()
    if not encounter:
        raise HTTPException(status_code=404, detail="Encounter not found")
    encounter.synced_at = datetime.now(timezone.utc)
    db.commit()
    return {"ok": True, "message": "Synced to chart", "encounter_id": encounter_id}
