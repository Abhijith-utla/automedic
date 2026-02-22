"""
Clinical Triage Pipeline — Two agents in sequence (Mistral/Gemini).

Agent 1 (Triage):    Vitals + chain-of-thought assessment + differential diagnoses.
Agent 2 (Care plan): Treatment plan, medications, labs, ICD-10, next visit.

Can be used as an importable module (run_pipeline) or via CLI.
Override with TRIAGE_PIPELINE_TRIAGE_MODEL / TRIAGE_PIPELINE_CARE_MODEL and OLLAMA_URL if needed.
Set LLM_PROVIDER=ollama for local Mistral or LLM_PROVIDER=gemini for Gemini API.
"""

import os
import re
import json
import argparse
import sys
import urllib.parse
import urllib.request
import urllib.error
from typing import Any, Dict, List, Optional
from app.config import settings

# ─────────────────────────────────────────────────────────────────────────────
# Config — LLM provider (env overrides for backend)
# ─────────────────────────────────────────────────────────────────────────────
DEFAULT_OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
LLM_PROVIDER = (os.environ.get("LLM_PROVIDER") or settings.LLM_PROVIDER or "ollama").strip().lower()  # ollama | gemini
TRIAGE_MODEL = (os.environ.get("TRIAGE_PIPELINE_TRIAGE_MODEL") or settings.TRIAGE_PIPELINE_TRIAGE_MODEL or "mistral").strip()
CARE_PLAN_MODEL = (os.environ.get("TRIAGE_PIPELINE_CARE_MODEL") or settings.TRIAGE_PIPELINE_CARE_MODEL or "mistral").strip()
TRIAGE_MAX_TOKENS = int(os.environ.get("TRIAGE_PIPELINE_TRIAGE_TOKENS", "320"))
CARE_PLAN_MAX_TOKENS = int(os.environ.get("TRIAGE_PIPELINE_CARE_TOKENS", "480"))
OLLAMA_NUM_CTX = os.environ.get("OLLAMA_NUM_CTX", "1536")
OLLAMA_TEMPERATURE = float(os.environ.get("TRIAGE_PIPELINE_TEMPERATURE", "0.1"))
OLLAMA_KEEP_ALIVE = os.environ.get("TRIAGE_PIPELINE_KEEP_ALIVE", "20m")
OLLAMA_REQUEST_TIMEOUT_SEC = int(os.environ.get("TRIAGE_PIPELINE_REQUEST_TIMEOUT_SEC", "300"))
FEATHERLESS_BASE_URL = os.environ.get("FEATHERLESS_BASE_URL", "https://api.featherless.ai/v1").strip().rstrip("/")
FEATHERLESS_API_KEY = (os.environ.get("FEATHERLESS_API_KEY") or settings.FEATHERLESS_API_KEY or "").strip()
GEMINI_BASE_URL = (os.environ.get("GEMINI_BASE_URL") or settings.GEMINI_BASE_URL or "https://generativelanguage.googleapis.com/v1beta").strip().rstrip("/")
GEMINI_API_KEY = (os.environ.get("GEMINI_API_KEY") or settings.GEMINI_API_KEY or "").strip()


# ─────────────────────────────────────────────────────────────────────────────
# Vitals extraction
# ─────────────────────────────────────────────────────────────────────────────
def parse_vitals(text: str) -> Dict[str, Any]:
    v = {
        "temperature": None, "heart_rate": None, "respiratory_rate": None,
        "blood_pressure": None, "oxygen_sat": None,
        "consciousness": "ALERT", "on_oxygen": False,
    }
    m = re.search(r"(?:temp(?:erature)?|T)\s*[=:]?\s*(\d+\.?\d*)\s*[°]?\s*[Cc]?", text, re.IGNORECASE)
    if m:
        try: v["temperature"] = float(m.group(1))
        except ValueError: pass

    m = re.search(r"(?:HR|heart\s*rate|pulse)\s*[=:]?\s*(\d+)\s*(?:bpm)?", text, re.IGNORECASE)
    if m:
        try: v["heart_rate"] = int(m.group(1))
        except ValueError: pass

    m = re.search(r"(?:RR|resp(?:iratory)?\s*rate)\s*[=:]?\s*(\d+)\s*(?:/min)?", text, re.IGNORECASE)
    if m:
        try: v["respiratory_rate"] = int(m.group(1))
        except ValueError: pass

    m = re.search(r"(?:BP|blood\s*pressure)\s*[=:]?\s*(\d+)\s*/\s*(\d+)", text, re.IGNORECASE)
    if not m:
        m = re.search(r"\b(\d{2,3})\s*/\s*(\d{2,3})\s*(?:mmHg)?", text)
    if m:
        v["blood_pressure"] = f"{m.group(1)}/{m.group(2)}"

    m = re.search(r"(?:SpO2|sats?|oxygen\s*sat(?:uration)?)\s*[=:]?\s*(\d+)\s*%?", text, re.IGNORECASE)
    if m:
        try: v["oxygen_sat"] = float(m.group(1))
        except ValueError: pass

    if "on oxygen" in text.lower() or "supplemental oxygen" in text.lower():
        v["on_oxygen"] = True
    if "unresponsive" in text.lower() or "GCS" in text.lower():
        v["consciousness"] = "VOICE"
    return v


# ─────────────────────────────────────────────────────────────────────────────
# NEWS2 score
# ─────────────────────────────────────────────────────────────────────────────
def calculate_news2(vitals: Dict[str, Any]) -> Dict[str, Any]:
    score = 0
    breakdown = {}

    def add(name, value, s, desc):
        nonlocal score
        score += s
        breakdown[name] = {"value": value, "score": s, "description": desc}

    t = vitals.get("temperature")
    if t is not None:
        if   t <= 35.0: add("temperature", t, 3, "Critical - Severe hypothermia")
        elif t <= 36.0: add("temperature", t, 1, "Low - Hypothermia")
        elif t <= 38.0: add("temperature", t, 0, "Normal")
        elif t <= 39.0: add("temperature", t, 1, "Elevated - Low-grade pyrexia")
        else:           add("temperature", t, 2, "High - Significant pyrexia")
    else:
        add("temperature", None, 0, "Not recorded")

    hr = vitals.get("heart_rate")
    if hr is not None:
        if   hr <= 40:  add("heart_rate", hr, 3, "Critical - Severe bradycardia")
        elif hr <= 50:  add("heart_rate", hr, 1, "Bradycardia")
        elif hr <= 90:  add("heart_rate", hr, 0, "Normal")
        elif hr <= 110: add("heart_rate", hr, 1, "Mild tachycardia")
        elif hr <= 130: add("heart_rate", hr, 2, "Tachycardia")
        else:           add("heart_rate", hr, 3, "Critical - Severe tachycardia")
    else:
        add("heart_rate", None, 0, "Not recorded")

    rr = vitals.get("respiratory_rate")
    if rr is not None:
        if   rr <= 8:  add("respiratory_rate", rr, 3, "Critical - Bradypnoea")
        elif rr <= 11: add("respiratory_rate", rr, 1, "Low")
        elif rr <= 20: add("respiratory_rate", rr, 0, "Normal")
        elif rr <= 24: add("respiratory_rate", rr, 2, "Tachypnoea")
        else:          add("respiratory_rate", rr, 3, "Critical - Severe tachypnoea")
    else:
        add("respiratory_rate", None, 0, "Not recorded")

    spo2 = vitals.get("oxygen_sat")
    if spo2 is not None:
        if   spo2 <= 91: add("oxygen_sat", spo2, 3, "Critical - Severe hypoxia")
        elif spo2 <= 93: add("oxygen_sat", spo2, 2, "Hypoxia")
        elif spo2 <= 95: add("oxygen_sat", spo2, 1, "Borderline")
        else:            add("oxygen_sat", spo2, 0, "Normal")
    else:
        add("oxygen_sat", None, 0, "Not recorded")

    bp = vitals.get("blood_pressure")
    if bp:
        try:
            sys_bp = int(str(bp).split("/")[0])
            if   sys_bp <= 90:  add("blood_pressure", bp, 3, "Critical - Hypotension")
            elif sys_bp <= 100: add("blood_pressure", bp, 2, "Low")
            elif sys_bp <= 110: add("blood_pressure", bp, 1, "Low-normal")
            elif sys_bp <= 219: add("blood_pressure", bp, 0, "Normal")
            else:               add("blood_pressure", bp, 3, "Critical - Severe hypertension")
        except Exception:
            add("blood_pressure", bp, 0, "Invalid format")
    else:
        add("blood_pressure", None, 0, "Not recorded")

    consciousness = vitals.get("consciousness", "ALERT")
    if consciousness.upper() == "ALERT":
        add("consciousness", consciousness, 0, "Alert and oriented")
    else:
        add("consciousness", consciousness, 3, "Reduced consciousness")

    on_o2 = vitals.get("on_oxygen", False)
    add("supplemental_oxygen", "Yes" if on_o2 else "No", 2 if on_o2 else 0,
        "On supplemental O2" if on_o2 else "Room air")

    if   score == 0: risk, urgency = "Low",       "LOW"
    elif score <= 4: risk, urgency = "Low-Medium", "LOW"
    elif score <= 6: risk, urgency = "Medium",     "MEDIUM"
    else:            risk, urgency = "High",       "HIGH"

    return {"total_score": score, "risk_level": risk, "urgency": urgency, "breakdown": breakdown}


# ─────────────────────────────────────────────────────────────────────────────
# Ollama helpers
# ─────────────────────────────────────────────────────────────────────────────
def call_ollama_raw(prompt: str, base_url: str, model: str, max_tokens: int) -> str:
    url  = f"{base_url.rstrip('/')}/api/generate"
    options: Dict[str, Any] = {
        "num_predict": max_tokens,
        "temperature": OLLAMA_TEMPERATURE,
    }
    if OLLAMA_NUM_CTX:
        try:
            options["num_ctx"] = int(OLLAMA_NUM_CTX)
        except ValueError:
            pass
    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False,
        "format": "json",
        "options": options,
        "keep_alive": OLLAMA_KEEP_ALIVE,
    }
    body = json.dumps(payload).encode()
    req  = urllib.request.Request(url, data=body,
                                  headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=OLLAMA_REQUEST_TIMEOUT_SEC) as r:
            data = json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        if e.code == 404:
            raise RuntimeError(
                f"Cannot reach Ollama at {base_url} (404). Start Ollama: ollama serve. Then pull the model: ollama pull {model}"
            ) from e
        raise RuntimeError(f"Ollama at {base_url} returned HTTP {e.code}: {e.reason}") from e
    except urllib.error.URLError as e:
        raise RuntimeError(f"Cannot reach Ollama at {base_url}. Is it running? Run: ollama serve. Then: ollama pull {model}") from e
    if "error" in data:
        raise RuntimeError(f"Ollama error: {data['error']}")
    return data.get("response", "")


def llm_call(model: str, base_url: str, system: str, user: str, max_tokens: int) -> str:
    if LLM_PROVIDER == "gemini":
        return call_gemini_chat(model, system, user, max_tokens)
    return call_ollama_raw(system + "\n\n" + user, base_url, model, max_tokens)


def call_gemini_chat(model: str, system: str, user: str, max_tokens: int) -> str:
    """Gemini REST generateContent call."""
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is missing. Set it in backend environment.")
    model_name = (model or "").strip()
    if model_name.startswith("models/"):
        model_name = model_name.split("/", 1)[1]
    model_path = urllib.parse.quote(model_name, safe="")
    url = f"{GEMINI_BASE_URL}/models/{model_path}:generateContent?key={GEMINI_API_KEY}"
    payload = {
        "system_instruction": {"parts": [{"text": system}]},
        "contents": [{"role": "user", "parts": [{"text": user}]}],
        "generationConfig": {
            "temperature": OLLAMA_TEMPERATURE,
            "maxOutputTokens": max_tokens,
            "responseMimeType": "application/json",
        },
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=OLLAMA_REQUEST_TIMEOUT_SEC) as r:
            data = json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = ""
        try:
            body = e.read().decode("utf-8")
        except Exception:
            pass
        raise RuntimeError(f"Gemini API HTTP {e.code}: {body or e.reason}") from e
    except urllib.error.URLError as e:
        raise RuntimeError(f"Cannot reach Gemini API at {GEMINI_BASE_URL}: {e}") from e
    candidates = data.get("candidates") or []
    if not candidates:
        raise RuntimeError(f"Gemini API returned no candidates: {json.dumps(data)[:500]}")
    parts = ((candidates[0] or {}).get("content") or {}).get("parts") or []
    content = ""
    for p in parts:
        if isinstance(p, dict) and p.get("text"):
            content += str(p.get("text"))
    content = content.strip()
    if not content:
        raise RuntimeError(f"Gemini API returned empty content: {json.dumps(data)[:500]}")
    return content


def _trim(text: Any, max_chars: int) -> str:
    s = str(text or "").strip()
    if len(s) <= max_chars:
        return s
    return s[: max_chars - 1].rstrip() + "…"


# ─────────────────────────────────────────────────────────────────────────────
# JSON helpers
# ─────────────────────────────────────────────────────────────────────────────
def extract_json(text: str) -> Optional[str]:
    if not text:
        return None
    for pat in [r"```(?:json)?\s*(\{[\s\S]*?\})\s*```", r"(\{[\s\S]*\})"]:
        m = re.search(pat, text)
        if m:
            return m.group(1)
    s, e = text.find("{"), text.rfind("}") + 1
    return text[s:e] if s >= 0 and e > s else None


# ─────────────────────────────────────────────────────────────────────────────
# AGENT 1 — Triage
# ─────────────────────────────────────────────────────────────────────────────
TRIAGE_SYSTEM = """You are an experienced triage nurse. Assess the clinical paragraph and return a JSON object.

STRICT RULES:
- Your entire response must be ONE valid JSON object and nothing else.
- No prose, no markdown, no code fences, no explanation before or after.
- Every key below is required. Do not add or remove keys.
- Strings must be properly escaped. Arrays must be arrays. Booleans must be true/false (no quotes).
- severity_score is an integer 1–5 (1 = most critical, 5 = least urgent).

Required JSON structure (fill in all values based on the clinical paragraph):
{
  "severity_score": 3,
  "is_red_flag": false,
  "clinical_assessment": "Detailed clinical reasoning about this patient.",
  "differential_diagnoses": [
    {"diagnosis": "Condition name", "reasoning": "Why this fits the symptoms and vitals"}
  ],
  "thought_process": [
    "Step 1: Chief complaint — describe it",
    "Step 2: Concerning findings — what stands out",
    "Step 3: Vitals interpretation — what the numbers mean",
    "Step 4: Differential reasoning — which diagnoses fit and why",
    "Step 5: Acuity and risk — final risk conclusion"
  ],
  "risk_factors": ["list", "of", "patient", "risk", "factors"]
}"""


def run_triage(
    paragraph: str,
    base_url: str,
    debug: bool = False,
    triage_model: Optional[str] = None,
) -> Dict[str, Any]:
    vitals  = parse_vitals(paragraph)
    news2   = None
    has_any = any(vitals.get(k) is not None
                  for k in ("temperature", "heart_rate", "respiratory_rate", "oxygen_sat", "blood_pressure"))

    if has_any:
        news2 = calculate_news2(vitals)

    vitals_ctx = (
        f"NEWS2 score: {news2['total_score']} | Risk: {news2['risk_level']} | Urgency: {news2['urgency']}\n"
        f"Breakdown: {json.dumps(news2['breakdown'], default=str)}"
        if news2 else "No vitals parsed from text."
    )

    system = TRIAGE_SYSTEM + f"\n\n=== VITAL SIGNS (pre-calculated) ===\n{vitals_ctx}"
    user   = (
        f"=== CLINICAL PARAGRAPH ===\n\n{paragraph}\n\n"
        "Respond with ONLY the JSON object. Do not write anything before or after the opening {{ and closing }}."
    )
    model = (triage_model or TRIAGE_MODEL).strip()
    raw = llm_call(model, base_url, system, user, TRIAGE_MAX_TOKENS)

    if debug:
        print(f"\n[DEBUG Agent 1 raw]:\n{raw[:2000]}\n", file=sys.stderr)

    triage = _parse_triage(raw)
    return {"vitals": vitals, "news2": news2, "triage": triage}


def _parse_triage(raw: str) -> Dict[str, Any]:
    default = {
        "severity_score": 3, "is_red_flag": False,
        "clinical_assessment": raw[:3000] if raw else "No assessment returned.",
        "thought_process": [], "risk_factors": [], "differential_diagnoses": [],
    }
    blob = extract_json(raw)
    if blob:
        try:
            p = json.loads(blob)
            for k, v in default.items():
                if k not in p or p[k] is None:
                    p[k] = v
            if not isinstance(p.get("risk_factors"), list):
                p["risk_factors"] = []
            if not isinstance(p.get("thought_process"), list):
                p["thought_process"] = []
            if not isinstance(p.get("differential_diagnoses"), list):
                p["differential_diagnoses"] = []

            cleaned_diffs: List[Dict[str, Any]] = []
            for d in p.get("differential_diagnoses", []):
                if isinstance(d, dict):
                    cleaned_diffs.append({
                        "diagnosis": str(d.get("diagnosis") or "").strip(),
                        "reasoning": str(d.get("reasoning") or "").strip(),
                    })
            p["differential_diagnoses"] = cleaned_diffs

            try:
                p["severity_score"] = int(p.get("severity_score") or 3)
            except Exception:
                p["severity_score"] = 3
            p["severity_score"] = max(1, min(5, p["severity_score"]))
            p["is_red_flag"] = bool(p.get("is_red_flag"))
            return p
        except json.JSONDecodeError:
            pass
    return default


# ─────────────────────────────────────────────────────────────────────────────
# AGENT 2 — Care Plan
# ─────────────────────────────────────────────────────────────────────────────
CARE_PLAN_SYSTEM = """You are a clinical assistant. Create a care plan based on the triage data provided and return a JSON object.

STRICT RULES:
- Your entire response must be ONE valid JSON object and nothing else.
- No prose, no markdown, no code fences, no explanation before or after.
- Every key below is required. Do not add or remove keys.
- Strings must be properly escaped. Arrays must be arrays, even if empty ([]).
- Assign at least one real ICD-10-CM code for each differential diagnosis listed in the triage.

Required JSON structure (fill in all values based on the triage data):
{
  "treatment_plan": "Clear step-by-step treatment plan tailored to this patient.",
  "recommended_medications": [
    {"name": "Medication name", "indication": "Why this is appropriate for this patient", "notes": "Dose, frequency, or cautions"}
  ],
  "lab_tests": [
    {"test": "Test or imaging name", "reason": "Why this is ordered for this patient"}
  ],
  "icd10_codes": [
    {"code": "R07.9", "description": "Chest pain, unspecified"}
  ],
  "next_visit": "When the patient should return and why (e.g. in 1 week for BP recheck)."
}"""

_ICD_PAT = re.compile(r"\b([A-Z]\d{2}(?:\.\d{2,4})?)\b", re.IGNORECASE)


def run_care_plan(
    triage_output: Dict[str, Any],
    paragraph: str,
    base_url: str,
    debug: bool = False,
    care_model: Optional[str] = None,
) -> Dict[str, Any]:
    t     = triage_output.get("triage") or {}
    n     = triage_output.get("news2") or {}
    diffs = "\n".join(
        f"  - {_trim(d.get('diagnosis',''), 80)}: {_trim(d.get('reasoning',''), 220)}"
        for d in (t.get("differential_diagnoses") or []) if isinstance(d, dict)
    )
    context = (
        f"=== ORIGINAL PARAGRAPH ===\n{paragraph}\n\n"
        f"=== TRIAGE SUMMARY ===\n"
        f"Severity: {t.get('severity_score')}/5  |  Red flag: {t.get('is_red_flag')}\n"
        f"NEWS2: {n.get('total_score')} ({n.get('urgency')})\n"
        f"Risk factors: {_trim(', '.join(t.get('risk_factors') or []), 280)}\n\n"
        f"Differential diagnoses:\n{diffs}\n\n"
        f"Clinical assessment:\n{_trim(t.get('clinical_assessment',''), 1000)}"
    )
    model = (care_model or CARE_PLAN_MODEL).strip()
    raw = llm_call(
        model,
        base_url,
        CARE_PLAN_SYSTEM,
        context + "\n\nRespond with ONLY the JSON object. Do not write anything before or after the opening { and closing }.",
        CARE_PLAN_MAX_TOKENS,
    )

    if debug:
        print(f"\n[DEBUG Agent 2 raw]:\n{raw[:2000]}\n", file=sys.stderr)

    return _parse_care_plan(raw)


def _parse_care_plan(raw: str) -> Dict[str, Any]:
    default = {
        "treatment_plan": "", "recommended_medications": [],
        "lab_tests": [], "icd10_codes": [], "next_visit": "",
    }
    blob = extract_json(raw)
    if blob:
        try:
            p = json.loads(blob)
            for k, v in default.items():
                if k not in p or p[k] is None:
                    p[k] = v
            if not isinstance(p.get("recommended_medications"), list):
                p["recommended_medications"] = []
            if not isinstance(p.get("lab_tests"), list):
                p["lab_tests"] = []
            if not isinstance(p.get("icd10_codes"), list):
                p["icd10_codes"] = []
            return p
        except json.JSONDecodeError:
            pass
    seen, icd = set(), []
    for m in _ICD_PAT.finditer(raw):
        c = m.group(1).upper()
        if c not in seen:
            seen.add(c)
            icd.append({"code": c, "description": ""})
    default["treatment_plan"] = raw[:3000]
    default["icd10_codes"]    = icd
    return default


# ─────────────────────────────────────────────────────────────────────────────
# run_pipeline — main callable for backend / API
# ─────────────────────────────────────────────────────────────────────────────
def run_pipeline(
    paragraph: str,
    base_url: str = DEFAULT_OLLAMA_URL,
    debug: bool = False,
    triage_model: Optional[str] = None,
    care_model: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Run the full triage pipeline and return a single combined dict.

    Returns:
        vitals, news2, triage, care_plan
    """
    triage_output = run_triage(paragraph, base_url, debug, triage_model=triage_model)
    care_plan = run_care_plan(triage_output, paragraph, base_url, debug, care_model=care_model)

    return {
        "vitals":    triage_output.get("vitals"),
        "news2":     triage_output.get("news2"),
        "triage":    triage_output.get("triage"),
        "care_plan": care_plan,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Convert pipeline output → AgentReport shape (for backend API)
# ─────────────────────────────────────────────────────────────────────────────
def pipeline_result_to_agent_report(
    pipeline_result: Dict[str, Any],
    paragraph: str,
) -> Dict[str, Any]:
    """
    Map triage_pipeline output to the shape expected by clinical_report API and frontend:
    paragraph_summary, agent1_triage, agent2_care_plan, care_plan_structured.
    Pipeline JSON shape: vitals, news2, triage, care_plan — parsed directly for dashboard.
    """
    triage = pipeline_result.get("triage") or {}
    news2 = pipeline_result.get("news2")
    care_plan = pipeline_result.get("care_plan") or {}
    vitals = pipeline_result.get("vitals")

    # agent1_triage: triage + news2 + vitals (frontend reads these for dashboard)
    agent1_triage: Dict[str, Any] = {**triage}
    if news2 is not None:
        agent1_triage["news2"] = news2
    if vitals is not None:
        agent1_triage["vitals"] = vitals

    # agent2_care_plan: key-value for compatibility with parser/medllama style
    treatment_plan = care_plan.get("treatment_plan") or ""
    meds = care_plan.get("recommended_medications") or []
    meds_text = "\n".join(
        f"- {m.get('name', '')} | Indication: {m.get('indication', '')} | {m.get('notes', '')}"
        for m in meds if isinstance(m, dict)
    )
    labs = care_plan.get("lab_tests") or []
    labs_text = "\n".join(
        f"- {l.get('test', '')} | {l.get('reason', '')}"
        for l in labs if isinstance(l, dict)
    )
    icd = care_plan.get("icd10_codes") or []
    icd_text = "\n".join(
        f"{c.get('code', '')} — {c.get('description', '')}"
        for c in icd if isinstance(c, dict)
    )
    agent2_care_plan: Dict[str, str] = {
        "TREATMENT PLAN": treatment_plan,
        "RECOMMENDED MEDICATIONS": meds_text,
        "LAB TESTS": labs_text,
        "ICD-10 CODES": icd_text,
        "LIFESTYLE": "\n".join(
            f"- {x.get('type', '')}: {x.get('recommendation_text', '')}"
            for x in (care_plan.get("lifestyle_recommendations") or []) if isinstance(x, dict)
        ),
        "NEXT VISIT": (care_plan.get("next_visit") or "").strip(),
    }

    # care_plan_structured: direct map for dashboard (no parser agent needed)
    treatment_steps: List[str] = []
    if treatment_plan.strip():
        for line in treatment_plan.strip().split("\n"):
            line = line.strip()
            if line and not line.startswith("#"):
                treatment_steps.append(line)

    medications: List[Dict[str, Any]] = []
    for m in meds:
        if isinstance(m, dict):
            name_dose = (m.get("name") or "").strip()
            if (m.get("notes") or "").strip():
                name_dose = f"{name_dose} {m.get('notes', '').strip()}"
            medications.append({
                "name_dose": name_dose,
                "indication": (m.get("indication") or "").strip(),
                "route": (m.get("route") or "").strip() or None,
                "frequency": (m.get("frequency") or "").strip() or None,
                "monitoring_points": m.get("monitoring_points") if isinstance(m.get("monitoring_points"), list) else [],
                "side_effect_category": (m.get("side_effect_category") or "").strip().lower() or "none",
                "monitor": "; ".join(
                    str(x).strip() for x in (m.get("monitoring_points") or []) if str(x).strip()
                ),
            })

    lab_tests: List[Dict[str, Any]] = []
    for l in labs:
        if isinstance(l, dict):
            lab_tests.append({
                "name": (l.get("test") or "").strip(),
                "reason": (l.get("reason") or "").strip(),
                "priority": (l.get("priority") or "Routine"),
                "type": (l.get("type") or "Lab"),
                "fasting_required": bool(l.get("fasting_required")),
                "note": "",
            })

    icd_codes: List[Dict[str, str]] = []
    for c in icd:
        if isinstance(c, dict):
            icd_codes.append({
                "code": (c.get("code") or "").strip().upper(),
                "description": (c.get("description") or "").strip(),
                "category": (c.get("category") or "").strip() or "Other",
                "justification_symptoms": c.get("justification_symptoms") if isinstance(c.get("justification_symptoms"), list) else [],
            })

    care_plan_structured: Dict[str, Any] = {
        "treatment_steps": treatment_steps,
        "care_steps_ordered": care_plan.get("care_steps_ordered") or [],
        "medications": medications,
        "lab_tests": lab_tests,
        "icd_codes": icd_codes,
        "diet_lifestyle": {"recommendations": [
            str(x.get("recommendation_text", "")).strip()
            for x in (care_plan.get("lifestyle_recommendations") or [])
            if isinstance(x, dict) and str(x.get("recommendation_text", "")).strip()
        ]},
        "follow_up": care_plan.get("follow_up") or {},
        "next_visit": (care_plan.get("next_visit") or "").strip(),
        "raw": agent2_care_plan,
    }

    return {
        "paragraph_summary": paragraph.strip()[:2000],
        "agent1_triage": agent1_triage,
        "agent2_care_plan": agent2_care_plan,
        "care_plan_structured": care_plan_structured,
    }


# ─────────────────────────────────────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────────────────────────────────────
def main() -> None:
    parser = argparse.ArgumentParser(
        description="Clinical triage pipeline. Outputs a single JSON object."
    )
    parser.add_argument("input", nargs="?", default=None,
                        help="Clinical paragraph (or pipe from stdin)")
    parser.add_argument("--url", type=str, default=DEFAULT_OLLAMA_URL,
                        help="Ollama base URL")
    parser.add_argument("--debug", action="store_true",
                        help="Print raw model responses to stderr")
    args = parser.parse_args()

    paragraph = (args.input or sys.stdin.read()).strip()
    if not paragraph:
        print(json.dumps({"error": "No clinical paragraph provided."}))
        sys.exit(1)

    try:
        result = run_pipeline(paragraph, base_url=args.url, debug=args.debug)
        print(json.dumps(result, indent=2, default=str))
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
