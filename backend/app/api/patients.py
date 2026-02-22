"""
Patients API: list (for current doctor), create, get one with EMR/encounters.
"""

import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.auth import get_current_user_id
from app.db.session import get_db
from app.models.patient import Patient
from app.models.encounter import Encounter
from app.schemas.patient import PatientCreate, PatientResponse, PatientWithEncounters

router = APIRouter()


@router.get("/patients", response_model=list[PatientWithEncounters])
def list_patients(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """List all patients for the logged-in doctor."""
    patients = db.query(Patient).filter(Patient.doctor_id == user_id).order_by(Patient.updated_at.desc()).all()
    out = []
    for p in patients:
        encs = p.encounters or []
        last = encs[0].started_at if encs else None
        out.append(
            PatientWithEncounters(
                id=p.id,
                doctor_id=p.doctor_id,
                name=p.name,
                date_of_birth=p.date_of_birth,
                mrn=p.mrn,
                email=p.email,
                phone=p.phone,
                notes=p.notes,
                photo_url=getattr(p, "photo_url", None),
                created_at=p.created_at,
                updated_at=p.updated_at,
                encounter_count=len(encs),
                last_encounter_at=last,
            )
        )
    return out


@router.post("/patients", response_model=PatientResponse)
def create_patient(
    body: PatientCreate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Create a patient for the current doctor."""
    patient = Patient(
        id=str(uuid.uuid4()),
        doctor_id=user_id,
        name=body.name,
        date_of_birth=body.date_of_birth,
        mrn=body.mrn,
        email=body.email,
        phone=body.phone,
        notes=body.notes,
        photo_url=body.photo_url,
    )
    db.add(patient)
    db.commit()
    db.refresh(patient)
    return patient


@router.get("/patients/{patient_id}", response_model=PatientResponse)
def get_patient(
  patient_id: str,
  db: Session = Depends(get_db),
  user_id: str = Depends(get_current_user_id),
):
    """Get one patient. Returns 404 if not found or not owned by current user."""
    patient = db.query(Patient).filter(Patient.id == patient_id, Patient.doctor_id == user_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient


@router.get("/patients/{patient_id}/timeline")
def get_patient_timeline(
    patient_id: str,
    db: Session = Depends(get_db),
  user_id: str = Depends(get_current_user_id),
):
    """Patient history: past encounters (EMR) for timeline."""
    patient = db.query(Patient).filter(Patient.id == patient_id, Patient.doctor_id == user_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    encounters = db.query(Encounter).filter(Encounter.patient_id == patient_id).order_by(Encounter.started_at.desc()).all()
    return [
        {
            "id": e.id,
            "date": e.started_at.strftime("%Y-%m-%d") if e.started_at else "",
            "type": "encounter",
            "summary": e.chief_complaint or "Encounter",
        }
        for e in encounters
    ]


@router.get("/patients/{patient_id}/profile")
def get_patient_profile(
    patient_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Full profile: patient info, timeline, and alerts from latest encounter."""
    patient = db.query(Patient).filter(Patient.id == patient_id, Patient.doctor_id == user_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    encounters = (
        db.query(Encounter)
        .filter(Encounter.patient_id == patient_id)
        .order_by(Encounter.started_at.desc())
        .all()
    )
    timeline = [
        {
            "id": e.id,
            "date": e.started_at.strftime("%Y-%m-%d") if e.started_at else "",
            "type": "encounter",
            "summary": e.chief_complaint or "Encounter",
            "month_key": e.started_at.strftime("%Y-%m") if e.started_at else "",
        }
        for e in encounters
    ]
    alerts = []
    if encounters:
        latest = encounters[0]
        if latest.diagnosis_json:
            d = latest.diagnosis_json
            alerts.extend(d.get("conflicts") or [])
            for flag in d.get("drug_interaction_flags") or []:
                alerts.append(f"{flag.get('drug', '')}: {flag.get('message', '')}")
    return {
        "patient": {
            "id": patient.id,
            "doctor_id": patient.doctor_id,
            "name": patient.name,
            "date_of_birth": patient.date_of_birth,
            "mrn": patient.mrn,
            "email": patient.email,
            "phone": patient.phone,
            "notes": patient.notes,
            "photo_url": getattr(patient, "photo_url", None),
            "created_at": patient.created_at.isoformat() if patient.created_at else None,
            "updated_at": patient.updated_at.isoformat() if patient.updated_at else None,
        },
        "timeline": timeline,
        "alerts": alerts,
    }
