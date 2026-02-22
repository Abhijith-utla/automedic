"""Encounter model — stores transcript, vision log, and full diagnosis (EMR)."""

from datetime import datetime
from sqlalchemy import Column, String, DateTime, Text, ForeignKey
from sqlalchemy.dialects.sqlite import JSON
from sqlalchemy.orm import relationship

from app.db.base import Base


class Encounter(Base):
    __tablename__ = "encounters"

    id = Column(String(36), primary_key=True, index=True)
    patient_id = Column(String(36), ForeignKey("patients.id"), nullable=False, index=True)
    doctor_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    status = Column(String(20), nullable=False, default="active")  # active | ended
    started_at = Column(DateTime, default=datetime.utcnow)
    ended_at = Column(DateTime, nullable=True)
    transcript = Column(JSON, default=list)  # [{ "text", "key_terms" }]
    vision_log = Column(JSON, default=list)  # ["..."]
    chief_complaint = Column(Text, nullable=True)
    clinical_summary = Column(Text, nullable=True)
    diagnosis_json = Column(JSON, nullable=True)  # full DiagnosisResponse as dict
    agent_report_json = Column(JSON, nullable=True)  # triage + care plan from clinical agents (almost.py)
    synced_at = Column(DateTime, nullable=True)
    report_accepted_at = Column(DateTime, nullable=True)  # human-in-the-loop
    follow_up_json = Column(JSON, nullable=True)  # {"method": "email"|"call", "note": "...", "at": "ISO"}

    patient = relationship("Patient", back_populates="encounters")
    doctor = relationship("User", back_populates="encounters")
