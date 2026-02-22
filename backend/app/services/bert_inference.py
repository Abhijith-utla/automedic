"""
Clinical BERT inference placeholder (NER, ICD-10, DDx).

Diagnosis is produced only by the clinical report pipeline (Ministral agents).
Use the clinical report API for diagnosis; this module is not used in the main flow.
"""

from app.schemas.encounter import DiagnosisResponse


def run_bert_inference(narrative: str) -> DiagnosisResponse:
    """
    Placeholder. Diagnosis comes only from the clinical report (Ministral) pipeline.
    Use POST /api/clinical-report or run_agents_via_script for diagnosis.
    """
    raise NotImplementedError(
        "Diagnosis is provided by the clinical report pipeline (Ministral). Use the clinical report API."
    )
