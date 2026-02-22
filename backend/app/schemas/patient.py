"""Patient API schemas."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class PatientCreate(BaseModel):
    name: str
    date_of_birth: Optional[str] = None
    mrn: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    notes: Optional[str] = None
    photo_url: Optional[str] = None


class PatientUpdate(BaseModel):
    name: Optional[str] = None
    date_of_birth: Optional[str] = None
    mrn: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    notes: Optional[str] = None


class PatientResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    doctor_id: str
    name: str
    date_of_birth: Optional[str] = None
    mrn: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    notes: Optional[str] = None
    photo_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class PatientWithEncounters(PatientResponse):
    encounter_count: int = 0
    last_encounter_at: Optional[datetime] = None
