"""
Pydantic schemas for encounters and diagnosis.
"""

from typing import List, Optional
from pydantic import BaseModel, Field


class TranscriptSegment(BaseModel):
    """A segment of transcript with optional key-term tagging."""

    text: str
    start_ms: Optional[int] = None
    end_ms: Optional[int] = None
    key_terms: List[str] = Field(default_factory=list, description="e.g. symptoms, vitals")


class CreateEncounterRequest(BaseModel):
    """Request to start a new encounter."""

    patient_id: Optional[str] = None


class EndEncounterRequest(BaseModel):
    """Optional transcript/vision to save when ending."""

    transcript: Optional[List[dict]] = None
    vision_log: Optional[List[str]] = None


class EncounterResponse(BaseModel):
    """Encounter metadata."""

    encounter_id: str
    patient_id: Optional[str] = None
    status: str  # "active" | "ended"
    started_at: str


class DiagnosisSuggestion(BaseModel):
    """A single AI-suggested diagnosis with explainability."""

    condition: str
    confidence: float  # 0–1
    icd10_code: str
    icd10_title: Optional[str] = None
    source_snippet: Optional[str] = None  # transcript excerpt that triggered this


class ClinicalPlanItem(BaseModel):
    """Suggested treatment or order."""

    type: str  # "medication" | "lab" | "imaging"
    name: str
    dosage: Optional[str] = None
    frequency: Optional[str] = None
    code: Optional[str] = None  # e.g. LOINC, CPT


class PatientFriendlySummary(BaseModel):
    """Plain-language summary for the patient."""

    headline: str  # e.g. "Heart Attack"
    summary: str
    steps: List[str] = Field(default_factory=list)


class DiagnosisResponse(BaseModel):
    """Full diagnosis and plan after encounter ends."""

    chief_complaint: str
    clinical_summary: Optional[str] = None  # Subjective/Objective note
    suggestions: List[DiagnosisSuggestion] = Field(default_factory=list)
    clinical_plan: List[ClinicalPlanItem] = Field(default_factory=list)
    patient_summary: Optional[PatientFriendlySummary] = None
    conflicts: List[str] = Field(default_factory=list)  # e.g. allergy vs suggested med
    ddx_alerts: List[str] = Field(default_factory=list)
    evidence_links: List[dict] = Field(default_factory=list)  # [{ title, url }]
    drug_interaction_flags: List[dict] = Field(default_factory=list)  # [{ drug, message, severity }]


class SyncToChartRequest(BaseModel):
    """Payload for syncing to EMR."""

    encounter_id: str
    confirmed_diagnoses: List[DiagnosisSuggestion] = Field(default_factory=list)
    clinical_plan: List[ClinicalPlanItem] = Field(default_factory=list)
    notes: Optional[str] = None
