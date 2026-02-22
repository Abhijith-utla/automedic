"""
Mock data for encounters, diagnosis, and patient timeline.
Replace with real BERT/EMR integration.
"""

from app.schemas.encounter import (
    DiagnosisResponse,
    DiagnosisSuggestion,
    ClinicalPlanItem,
    PatientFriendlySummary,
)


def get_mock_diagnosis(encounter_id: str, transcript: str) -> DiagnosisResponse:
    """Return a full mock diagnosis for demo."""
    return DiagnosisResponse(
        chief_complaint="Chest pain and heaviness, 2 hours duration",
        clinical_summary=(
            "Subjective: Patient reports central chest pain and heaviness for ~2 hours. "
            "Denies SOB, nausea. No prior cardiac history. Objective: Alert, mild distress. "
            "Vitals within normal limits (mock)."
        ),
        suggestions=[
            DiagnosisSuggestion(
                condition="Acute myocardial infarction (STEMI/NSTEMI)",
                confidence=0.85,
                icd10_code="I21.9",
                icd10_title="Acute myocardial infarction, unspecified",
                source_snippet="chest pain and heaviness for about two hours",
            ),
            DiagnosisSuggestion(
                condition="Unstable angina",
                confidence=0.62,
                icd10_code="I20.0",
                icd10_title="Unstable angina",
                source_snippet="chest pain",
            ),
            DiagnosisSuggestion(
                condition="Anxiety with somatic symptoms",
                confidence=0.35,
                icd10_code="F41.1",
                icd10_title="Generalized anxiety disorder",
                source_snippet="heaviness",
            ),
        ],
        clinical_plan=[
            ClinicalPlanItem(
                type="medication",
                name="Aspirin",
                dosage="324 mg",
                frequency="once now",
                code=None,
            ),
            ClinicalPlanItem(
                type="imaging",
                name="Chest X-Ray",
                dosage=None,
                frequency=None,
                code="71046",
            ),
            ClinicalPlanItem(
                type="lab",
                name="CBC",
                dosage=None,
                frequency=None,
                code="CBC",
            ),
            ClinicalPlanItem(
                type="lab",
                name="Troponin",
                dosage=None,
                frequency=None,
                code="Troponin",
            ),
        ],
        patient_summary=PatientFriendlySummary(
            headline="Heart Attack (Acute Myocardial Infarction)",
            summary="Your symptoms suggest possible reduced blood flow to the heart. "
            "We are running tests and may start medicines to protect your heart.",
            steps=[
                "Rest and avoid exertion until your doctor says otherwise.",
                "Take medications exactly as prescribed.",
                "Return to the ER if you have new or worse chest pain, shortness of breath, or fainting.",
            ],
        ),
        conflicts=[
            "Patient has documented penicillin allergy; avoid Amoxicillin.",
        ],
        ddx_alerts=[
            "Consider: Unstable angina vs NSTEMI based on troponin and ECG. Consider aortic dissection if radiating pain.",
        ],
        evidence_links=[
            {"title": "UpToDate: Acute MI", "url": "https://www.uptodate.com/contents/acute-mi"},
            {"title": "BMJ: Chest pain", "url": "https://bestpractice.bmj.com/topics/en-gb/"},
        ],
        drug_interaction_flags=[
            {"drug": "Warfarin", "message": "Patient on Warfarin; avoid NSAIDs.", "severity": "high"},
        ],
    )


def get_mock_encounter(encounter_id: str) -> dict:
    """Return mock encounter record."""
    return {
        "encounter_id": encounter_id,
        "patient_id": "patient-001",
        "status": "ended",
        "started_at": "2025-02-21T10:00:00Z",
        "transcript": [
            {"text": "Patient states chest pain and heaviness for about two hours.", "key_terms": ["chest pain"]},
            {"text": "No prior cardiac history. Denies shortness of breath.", "key_terms": ["shortness of breath"]},
        ],
        "vision_log": [
            "Detected: Patient holding chest (central).",
            "Patient mobility: Limited.",
        ],
    }


def get_mock_patient_timeline(patient_id: str) -> list:
    """Mock EMR timeline for patient."""
    return [
        {"date": "2025-01-15", "type": "encounter", "summary": "Annual physical", "id": "e1"},
        {"date": "2024-11-02", "type": "lab", "summary": "Lipid panel", "id": "l1"},
        {"date": "2024-08-10", "type": "encounter", "summary": "UTI", "id": "e2"},
    ]
