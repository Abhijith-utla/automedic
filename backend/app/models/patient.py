"""Patient model."""

from datetime import datetime
from sqlalchemy import Column, String, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship

from app.db.base import Base


class Patient(Base):
    __tablename__ = "patients"

    id = Column(String(36), primary_key=True, index=True)
    doctor_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    date_of_birth = Column(String(50), nullable=True)
    mrn = Column(String(100), nullable=True)  # Medical record number
    email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    notes = Column(Text, nullable=True)
    photo_url = Column(String(512), nullable=True)  # avatar/photo URL (mock or live)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    doctor = relationship("User", back_populates="patients")
    encounters = relationship("Encounter", back_populates="patient", order_by="Encounter.started_at.desc()")
