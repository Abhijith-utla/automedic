"""
Parser agent: takes raw triage + care plan text from the two clinical agents and outputs
structured JSON for the dashboard (charts, cards, tables). Uses an LLM call so formatting
variations are handled and the result is guaranteed to match the schema needed for graphics.
"""

import json
import logging
import os
import re
import urllib.parse
import urllib.request
import urllib.error
from typing import Any, Dict, List, Optional
from app.config import settings

from app.services.medllama_fast_parser import medllama_care_plan_to_structured

log = logging.getLogger(__name__)

LLM_PROVIDER = (os.environ.get("LLM_PROVIDER") or settings.LLM_PROVIDER or "ollama").strip().lower()
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
GEMINI_BASE_URL = (os.environ.get("GEMINI_BASE_URL") or settings.GEMINI_BASE_URL or "https://generativelanguage.googleapis.com/v1beta").strip().rstrip("/")
GEMINI_API_KEY = (os.environ.get("GEMINI_API_KEY") or settings.GEMINI_API_KEY or "").strip()
PARSER_MODEL = (os.environ.get("PARSER_AGENT_MODEL") or os.environ.get("TRIAGE_PIPELINE_CARE_MODEL") or settings.TRIAGE_PIPELINE_CARE_MODEL or "mistral").strip()
PARSER_MAX_TOKENS = 2048
PARSER_TIMEOUT = 120

# Exact schema we need for dashboard graphics (treatment steps, meds, labs, ICD, lifestyle, next visit)
STRUCTURED_SCHEMA = """
Output a single JSON object with these keys only (no other text, no markdown):
- "treatment_steps": array of strings (ordered clinical actions)
- "medications": array of objects with "name_dose", "indication", "monitor" (strings)
- "lab_tests": array of objects with "name", "reason", "priority" ("Routine"|"Urgent"|"Elective"), "note" (strings)
- "icd_codes": array of objects with "code", "description" (strings)
- "diet_lifestyle": object with "recommendations": array of strings
- "next_visit": single string (one sentence)
"""


def _call_gemini(prompt: str, model: str, max_tokens: int) -> str:
    """Single non-streaming call to Gemini generateContent API."""
    if LLM_PROVIDER != "gemini":
        raise RuntimeError("Only Gemini API is supported. Set LLM_PROVIDER=gemini.")
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is missing. Set it in backend environment.")
    model_name = (model or "").strip()
    if model_name.startswith("models/"):
        model_name = model_name.split("/", 1)[1]
    url = f"{GEMINI_BASE_URL}/models/{urllib.parse.quote(model_name, safe='')}:generateContent?key={GEMINI_API_KEY}"
    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.1,
            "maxOutputTokens": max_tokens,
            "responseMimeType": "application/json",
        },
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=PARSER_TIMEOUT) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    candidates = data.get("candidates") or []
    if not candidates:
        return ""
    parts = ((candidates[0] or {}).get("content") or {}).get("parts") or []
    return "".join(str(p.get("text", "")) for p in parts if isinstance(p, dict)).strip()


def _call_ollama(prompt: str, model: str, max_tokens: int) -> str:
    """Single non-streaming call to Ollama /api/generate."""
    url = f"{OLLAMA_URL.rstrip('/')}/api/generate"
    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False,
        "options": {"num_predict": max_tokens},
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=PARSER_TIMEOUT) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return (data.get("response") or "").strip()


def _extract_json_block(text: str) -> Optional[str]:
    """Extract JSON object from markdown code block or first { ... }."""
    if not text:
        return None
    for pattern in [r"```(?:json)?\s*(\{[\s\S]*?\})\s*```", r"(\{[\s\S]*\})"]:
        m = re.search(pattern, text)
        if m:
            return m.group(1)
    start = text.find("{")
    end = text.rfind("}") + 1
    if start >= 0 and end > start:
        return text[start:end]
    return None


def _normalize_parser_output(parsed: Dict[str, Any]) -> Dict[str, Any]:
    """Ensure all keys exist and types match dashboard expectations."""
    def str_list(v: Any) -> List[str]:
        if isinstance(v, list):
            return [str(x).strip() for x in v if x is not None and str(x).strip()]
        return []

    def med_list(v: Any) -> List[Dict[str, str]]:
        if not isinstance(v, list):
            return []
        out = []
        for x in v:
            if isinstance(x, dict):
                out.append({
                    "name_dose": str(x.get("name_dose", "")).strip(),
                    "indication": str(x.get("indication", "")).strip(),
                    "monitor": str(x.get("monitor", "")).strip(),
                })
            else:
                out.append({"name_dose": str(x), "indication": "", "monitor": ""})
        return out

    def lab_list(v: Any) -> List[Dict[str, Any]]:
        if not isinstance(v, list):
            return []
        out = []
        for x in v:
            if isinstance(x, dict):
                p = str(x.get("priority", "Routine")).strip()
                if p not in ("Routine", "Urgent", "Elective"):
                    p = "Routine"
                out.append({
                    "name": str(x.get("name", "")).strip(),
                    "reason": str(x.get("reason", "")).strip(),
                    "priority": p,
                    "note": str(x.get("note", "")).strip(),
                })
            else:
                out.append({"name": str(x), "reason": "", "priority": "Routine", "note": ""})
        return out

    def icd_list(v: Any) -> List[Dict[str, str]]:
        if not isinstance(v, list):
            return []
        out = []
        for x in v:
            if isinstance(x, dict):
                out.append({
                    "code": str(x.get("code", "")).strip().upper(),
                    "description": str(x.get("description", "")).strip(),
                })
            else:
                out.append({"code": "", "description": str(x)})
        return out

    diet = parsed.get("diet_lifestyle")
    if isinstance(diet, dict) and "recommendations" in diet:
        recs = str_list(diet["recommendations"])
    else:
        recs = str_list(parsed.get("diet_lifestyle", []) if isinstance(parsed.get("diet_lifestyle"), list) else [])

    return {
        "treatment_steps": str_list(parsed.get("treatment_steps")),
        "medications": med_list(parsed.get("medications")),
        "lab_tests": lab_list(parsed.get("lab_tests")),
        "icd_codes": icd_list(parsed.get("icd_codes")),
        "diet_lifestyle": {"recommendations": recs},
        "next_visit": str(parsed.get("next_visit", "")).strip(),
        "raw": parsed.get("raw"),  # keep if present
    }


def run_parser_agent(
    agent1_triage: Optional[Dict[str, Any]],
    agent2_care_plan_raw: Optional[Dict[str, str]],
) -> Dict[str, Any]:
    """
    Parser agent: convert raw triage + care plan text into structured JSON for dashboard graphics.
    Uses an LLM to handle format variations; falls back to regex parser if LLM fails or is unavailable.
    Returns care_plan_structured (treatment_steps, medications, lab_tests, icd_codes, diet_lifestyle, next_visit).
    """
    # Fallback without LLM: use regex-based parser on care plan sections only
    if agent2_care_plan_raw:
        fallback = medllama_care_plan_to_structured(care_plan_raw=agent2_care_plan_raw)
    else:
        fallback = {
            "treatment_steps": [],
            "medications": [],
            "lab_tests": [],
            "icd_codes": [],
            "diet_lifestyle": {"recommendations": []},
            "next_visit": "",
            "raw": {},
        }

    # Build context for parser: triage summary + care plan sections as text
    triage_blob = ""
    if agent1_triage:
        t = agent1_triage.get("triage") or agent1_triage
        if isinstance(t, dict):
            triage_blob = json.dumps({
                "severity_score": t.get("severity_score"),
                "clinical_assessment": (t.get("clinical_assessment") or "")[:500],
                "differential_diagnoses": t.get("differential_diagnoses") or [],
            }, default=str)
        else:
            triage_blob = str(agent1_triage)[:800]

    care_plan_blob = ""
    if agent2_care_plan_raw:
        care_plan_blob = "\n\n".join(
            f"## {k}\n{v}" for k, v in (agent2_care_plan_raw or {}).items() if v
        )

    if not care_plan_blob.strip():
        return fallback

    user_prompt = f"""You are a parser. Convert the following clinical outputs into exactly one JSON object for a medical dashboard (charts and cards).

TRIAGE SUMMARY (for context):
{triage_blob or "None"}

CARE PLAN SECTIONS (raw text to parse):
{care_plan_blob[:6000]}

{STRUCTURED_SCHEMA}

Output only the JSON object, no explanation. Start with {{ and end with }}."""

    try:
        response = _call_gemini(user_prompt, PARSER_MODEL, PARSER_MAX_TOKENS) if LLM_PROVIDER == "gemini" else _call_ollama(user_prompt, PARSER_MODEL, PARSER_MAX_TOKENS)
        json_str = _extract_json_block(response)
        if json_str:
            parsed = json.loads(json_str)
            out = _normalize_parser_output(parsed)
            if not out.get("raw") and agent2_care_plan_raw:
                out["raw"] = agent2_care_plan_raw
            log.info("Parser agent produced structured care plan (LLM)")
            return out
    except urllib.error.URLError as e:
        log.warning("Parser agent LLM call failed: %s; using fallback", e)
    except json.JSONDecodeError as e:
        log.warning("Parser agent invalid JSON: %s; using fallback", e)
    except Exception as e:
        log.warning("Parser agent error: %s; using fallback", e)

    return fallback
