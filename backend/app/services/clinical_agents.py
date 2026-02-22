"""
Run the triage + care plan model (almost.py) and return structured report for the dashboard.
Input: clinical paragraph (e.g. from hardware/socket or encounter transcript).
Output: combined triage + parsed care plan for the Journey dashboard.
"""

import json
import logging
import os
import queue
import subprocess
import sys
import threading
import urllib.request
import urllib.error
from pathlib import Path
from typing import Any, Dict, Iterator, Optional, Tuple
from app.config import settings

from app.schemas.encounter import (
    DiagnosisResponse,
    DiagnosisSuggestion,
    ClinicalPlanItem,
    PatientFriendlySummary,
)
from app.services.parser_agent import run_parser_agent

log = logging.getLogger(__name__)

# Path to the almost.py script: backend/scripts/almost.py or set CLINICAL_SCRIPT_PATH (e.g. Downloads/almost.py)
_BASE = Path(__file__).resolve().parent.parent.parent
_SCRIPT = os.environ.get("CLINICAL_SCRIPT_PATH") or str(_BASE / "scripts" / "almost.py")
_SCRIPT = Path(_SCRIPT).resolve()

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
OLLAMA_CHECK_TIMEOUT = 6  # fail fast if Ollama not reachable
LLM_PROVIDER = (os.environ.get("LLM_PROVIDER") or settings.LLM_PROVIDER or "ollama").strip().lower()
GEMINI_API_KEY = (os.environ.get("GEMINI_API_KEY") or settings.GEMINI_API_KEY or "").strip()
TRIAGE_PIPELINE_TRIAGE_MODEL = (os.environ.get("TRIAGE_PIPELINE_TRIAGE_MODEL") or settings.TRIAGE_PIPELINE_TRIAGE_MODEL or "mistral").strip()
TRIAGE_PIPELINE_CARE_MODEL = (os.environ.get("TRIAGE_PIPELINE_CARE_MODEL") or settings.TRIAGE_PIPELINE_CARE_MODEL or "mistral").strip()

# Only Ministral pipeline is used; no demo/mock — report comes only from agent output.
USE_TRIAGE_PIPELINE = True

# (Commented out: old almost.py models — deepseek-r1:8b, medllama2:latest)
# REQUIRED_OLLAMA_MODELS = [
#     os.environ.get("CLINICAL_TRIAGE_MODEL", "deepseek-r1:8b"),
#     os.environ.get("CLINICAL_CARE_MODEL", "medllama2:latest"),
# ]

# Model config for triage + care plan.
TRIAGE_PIPELINE_MODELS = [TRIAGE_PIPELINE_TRIAGE_MODEL, TRIAGE_PIPELINE_CARE_MODEL]

log.info("Clinical agents: provider=%s pipeline (triage_pipeline).", LLM_PROVIDER)


def _ollama_instructions() -> str:
    """Single line: what to run for the active pipeline (serve + pull)."""
    return "Ensure Ollama is running (ollama serve) and pull the model: ollama pull mistral"


def _ollama_pull_only() -> str:
    """Pull commands only (no 'serve')."""
    return "ollama pull mistral"


def _list_ollama_model_names() -> Tuple[Optional[list], Optional[str]]:
    """Return (model_names, error_message)."""
    try:
        req = urllib.request.Request(f"{OLLAMA_URL.rstrip('/')}/api/tags", method="GET")
        with urllib.request.urlopen(req, timeout=OLLAMA_CHECK_TIMEOUT) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        return None, f"Could not list Ollama models: {e}"
    models = data.get("models") or []
    names = [m.get("name") or m.get("model") or "" for m in models]
    return [n for n in names if n], None


def _resolve_model_name(preferred: str, available: list[str]) -> Optional[str]:
    """
    Resolve a model name against installed tags.
    Accept exact match or common Ollama variants (e.g. 'mistral' -> 'mistral:latest').
    """
    p = (preferred or "").strip()
    if not p:
        return None
    for n in available:
        if n == p:
            return n
    for n in available:
        if n.startswith(p + ":") or n.startswith(p + "-"):
            return n
    return None


def _select_pipeline_models(available: list[str], triage_preferred: str, care_preferred: str) -> Tuple[str, str]:
    """
    Pick triage/care models for the pipeline from configured names.
    """
    triage = _resolve_model_name(triage_preferred, available)
    care = _resolve_model_name(care_preferred, available)
    if not triage or not care:
        raise ValueError(
            f"Configured models are unavailable. Install them with: ollama pull {triage_preferred} && ollama pull {care_preferred}"
        )
    return triage, care


def _check_ollama_reachable() -> Optional[str]:
    """Return None if Ollama is reachable, else an error message. Uses short timeout to avoid hanging."""
    try:
        req = urllib.request.Request(f"{OLLAMA_URL.rstrip('/')}/api/tags", method="GET")
        urllib.request.urlopen(req, timeout=OLLAMA_CHECK_TIMEOUT)
        return None
    except urllib.error.URLError as e:
        return f"Ollama is not running or not reachable. Start it with: ollama serve. Then run: {_ollama_pull_only()}"
    except urllib.error.HTTPError:
        return f"Cannot reach Ollama at {OLLAMA_URL}. Is it running? Start with: ollama serve. Then run: {_ollama_pull_only()}"
    except Exception as e:
        return str(e)


def _check_ollama_models() -> Optional[str]:
    """Return None if configured triage/care models are available; otherwise an error message."""
    names, err = _list_ollama_model_names()
    if err:
        return err
    if not names:
        return (
            "Ollama is running but no models are installed. Pull models first: "
            f"ollama pull {TRIAGE_PIPELINE_TRIAGE_MODEL} && ollama pull {TRIAGE_PIPELINE_CARE_MODEL}"
        )
    if not _resolve_model_name(TRIAGE_PIPELINE_TRIAGE_MODEL, names):
        return f"Configured triage model not found: {TRIAGE_PIPELINE_TRIAGE_MODEL}. Run: ollama pull {TRIAGE_PIPELINE_TRIAGE_MODEL}"
    if not _resolve_model_name(TRIAGE_PIPELINE_CARE_MODEL, names):
        return f"Configured care model not found: {TRIAGE_PIPELINE_CARE_MODEL}. Run: ollama pull {TRIAGE_PIPELINE_CARE_MODEL}"
    return None


def agent_report_to_diagnosis_response(report: Dict[str, Any], paragraph: str = "") -> DiagnosisResponse:
    """
    Build DiagnosisResponse from agent report JSON only (no mock data).
    Used to fill diagnosis_json and GET /diagnosis from Ministral triage + care plan output.
    """
    triage = report.get("agent1_triage") or {}
    care = report.get("care_plan_structured") or {}
    paragraph_summary = (report.get("paragraph_summary") or paragraph or "").strip() or "Clinical encounter"

    # Differential diagnoses → suggestions (with ICD from care plan when available)
    icd_codes = [c.get("code") or "" for c in (care.get("icd_codes") or []) if isinstance(c, dict)]
    diffs = triage.get("differential_diagnoses") or []
    suggestions = []
    for i, d in enumerate(diffs):
        if not isinstance(d, dict):
            continue
        cond = (d.get("diagnosis") or "").strip() or "Unspecified"
        reasoning = (d.get("reasoning") or "").strip()
        code = icd_codes[i] if i < len(icd_codes) else ""
        desc = (care.get("icd_codes") or [])[i].get("description", "") if i < len(care.get("icd_codes") or []) else ""
        suggestions.append(
            DiagnosisSuggestion(
                condition=cond,
                confidence=0.8,
                icd10_code=code or "R69",
                icd10_title=desc or cond,
                source_snippet=reasoning or None,
            )
        )

    # Clinical plan from care_plan_structured (agent output only)
    clinical_plan: list = []
    for m in (care.get("medications") or []):
        if isinstance(m, dict):
            clinical_plan.append(
                ClinicalPlanItem(type="medication", name=(m.get("name_dose") or "").strip() or "Medication", dosage=None, frequency=None, code=None)
            )
    for lb in (care.get("lab_tests") or []):
        if isinstance(lb, dict):
            name = (lb.get("name") or "").strip() or "Lab"
            item_type = "imaging" if "imaging" in name.lower() or "x-ray" in name.lower() or "ct" in name.lower() else "lab"
            clinical_plan.append(
                ClinicalPlanItem(type=item_type, name=name, dosage=None, frequency=None, code=(lb.get("reason") or "").strip() or None)
            )

    # Patient-friendly summary from treatment + next visit
    steps = list(care.get("treatment_steps") or [])
    if care.get("next_visit"):
        steps.append(f"Follow-up: {care.get('next_visit', '').strip()}")
    lifestyle = (care.get("diet_lifestyle") or {}).get("recommendations") or []
    steps.extend(lifestyle)
    patient_summary = PatientFriendlySummary(
        headline=paragraph_summary[:80] + ("…" if len(paragraph_summary) > 80 else ""),
        summary=(triage.get("clinical_assessment") or "")[:500] or "See clinical assessment.",
        steps=steps[:20],
    )

    return DiagnosisResponse(
        chief_complaint=paragraph_summary[:500],
        clinical_summary=(triage.get("clinical_assessment") or "").strip() or None,
        suggestions=suggestions,
        clinical_plan=clinical_plan,
        patient_summary=patient_summary,
        conflicts=[],  # From agent only; no mock
        ddx_alerts=(triage.get("thought_process") or [])[:5],
        evidence_links=[],
        drug_interaction_flags=[],  # Could map from risk_factors if needed
    )


def _run_triage_pipeline_in_process(paragraph: str) -> Dict[str, Any]:
    """Run triage_pipeline in-process; return API-shaped report or error dict."""
    try:
        from app.services.triage_pipeline import run_pipeline, pipeline_result_to_agent_report
    except ImportError as e:
        log.warning("Triage pipeline import failed: %s", e)
        return {
            "error": "Triage pipeline not available. Install with: pip install langchain-ollama",
            "agent1_triage": None,
            "agent2_care_plan": None,
            "care_plan_structured": None,
        }
    try:
        if LLM_PROVIDER == "gemini":
            triage_model = TRIAGE_PIPELINE_TRIAGE_MODEL or "gemini-2.5-flash"
            care_model = TRIAGE_PIPELINE_CARE_MODEL or "gemini-2.5-flash"
        else:
            names, names_err = _list_ollama_model_names()
            if names_err:
                return {
                    "error": names_err,
                    "agent1_triage": None,
                    "agent2_care_plan": None,
                    "care_plan_structured": None,
                }
            if not names:
                return {
                    "error": f"Ollama is running but no models are installed. Pull one first: {_ollama_pull_only()}",
                    "agent1_triage": None,
                    "agent2_care_plan": None,
                    "care_plan_structured": None,
                }
            triage_model, care_model = _select_pipeline_models(
                names, TRIAGE_PIPELINE_TRIAGE_MODEL, TRIAGE_PIPELINE_CARE_MODEL
            )
        pipeline_result = run_pipeline(
            paragraph, base_url=OLLAMA_URL, debug=False,
            triage_model=triage_model, care_model=care_model,
        )
        report = pipeline_result_to_agent_report(pipeline_result, paragraph)
        return {
            "error": None,
            "paragraph_summary": report.get("paragraph_summary"),
            "agent1_triage": report.get("agent1_triage"),
            "agent2_care_plan": report.get("agent2_care_plan"),
            "care_plan_structured": report.get("care_plan_structured"),
            "pipeline_json": pipeline_result,
        }
    except Exception as e:
        log.exception("Triage pipeline run failed")
        return {
            "error": str(e),
            "agent1_triage": None,
            "agent2_care_plan": None,
            "care_plan_structured": None,
        }

def run_agents_via_script(
    paragraph: str,
    script_path: Optional[str] = None,
    use_demo: Optional[bool] = None,
) -> Dict[str, Any]:
    """
    Run Ministral triage_pipeline in-process (NEWS2, strict JSON).
    Returns combined structure: agent1_triage, agent2_care_plan (raw), plus parsed care_plan_structured.
    Report data comes only from agent output; no mock or demo. On failure returns {"error": "..."}.
    """
    _ = script_path, use_demo  # unused; kept for API compatibility
    paragraph = (paragraph or "").strip()
    if not paragraph:
        return {"error": "Empty paragraph.", "agent1_triage": None, "agent2_care_plan": None, "care_plan_structured": None}

    if LLM_PROVIDER == "gemini":
        if not GEMINI_API_KEY:
            return {"error": "GEMINI_API_KEY is missing.", "agent1_triage": None, "agent2_care_plan": None, "care_plan_structured": None}
    else:
        ollama_err = _check_ollama_reachable()
        if ollama_err:
            return {"error": ollama_err, "agent1_triage": None, "agent2_care_plan": None, "care_plan_structured": None}
        models_err = _check_ollama_models()
        if models_err:
            return {"error": models_err, "agent1_triage": None, "agent2_care_plan": None, "care_plan_structured": None}
    log.info("Clinical report: using Ministral triage pipeline (NEWS2, in-process)")
    return _run_triage_pipeline_in_process(paragraph)

    # (Commented out: old almost.py script path — deepseek-r1 / medllama2)
    # script = (Path(script_path) if script_path else _SCRIPT).resolve()
    # ... subprocess run almost.py ...


def run_agents_via_script_stream(
    paragraph: str,
    script_path: Optional[str] = None,
) -> Iterator[Tuple[str, Any]]:
    """
    Run Ministral triage pipeline in-process; yield ("progress", message) then ("result", report_dict) or ("error", message).
    Report data comes only from agent output; no mock or demo.
    """
    _ = script_path
    paragraph = (paragraph or "").strip()
    if not paragraph:
        yield ("error", "Empty paragraph.")
        return

    if LLM_PROVIDER == "gemini":
        if not GEMINI_API_KEY:
            yield ("error", "GEMINI_API_KEY is missing.")
            return
    else:
        ollama_err = _check_ollama_reachable()
        if ollama_err:
            yield ("error", ollama_err)
            return
        models_err = _check_ollama_models()
        if models_err:
            yield ("error", models_err)
            return
    yield ("progress", "Running triage (Agent 1)…")
    yield ("progress", "Running care plan (Agent 2)…")
    report = _run_triage_pipeline_in_process(paragraph)
    if report.get("error"):
        yield ("error", report["error"])
        return
    yield ("result", report)

    # (Commented out: old almost.py streaming path)
