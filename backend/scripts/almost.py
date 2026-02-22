"""
Triage and care plan from a single paragraph (no chat). Two agents in sequence via LangChain.

Agent 1 (Triage): Vitals + chain-of-thought assessment + differential diagnoses → full output.
Agent 2 (Care plan): Receives FULL Agent 1 output via LangChain → treatment plan, meds, labs, ICD-10, next visit.

For full agent communication (Agent 1 output passed to Agent 2 as context): pip install langchain-ollama
Without it, falls back to raw Ollama API (single prompt string).
"""

import os
import re
import json
import argparse
import sys
import socket
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Dict, List, Optional, Tuple

# LangChain for agent communication (Agent 1 output → Agent 2 input)
try:
    from langchain_ollama import ChatOllama
    from langchain_core.messages import SystemMessage, HumanMessage
    LANGCHAIN_AVAILABLE = True
except ImportError:
    LANGCHAIN_AVAILABLE = False
    ChatOllama = None
    SystemMessage = HumanMessage = None

# -----------------------------------------------------------------------------
# Config (override via env for speed: CLINICAL_FAST=1, TRIAGE_MAX_TOKENS, etc.)
# -----------------------------------------------------------------------------
DEFAULT_OLLAMA_URL = "http://localhost:11434"
TRIAGE_MODEL = os.environ.get("CLINICAL_TRIAGE_MODEL", "mistral")
ICD_MODEL = os.environ.get("CLINICAL_CARE_MODEL", "mistral")

# Token limits: lower = faster. Triage JSON is ~500-1500 tokens. CLINICAL_FAST=1 uses 2048.
_default_triage = "2048" if os.environ.get("CLINICAL_FAST", "").lower() in ("1", "true", "yes") else "3072"
TRIAGE_MAX_TOKENS = int(os.environ.get("TRIAGE_MAX_TOKENS", _default_triage))
AGENT2_MAX_TOKENS = int(os.environ.get("AGENT2_MAX_TOKENS", "6144"))
# Optional context cap (smaller = faster, less memory). Ollama default often 2048-4096.
OLLAMA_NUM_CTX = os.environ.get("OLLAMA_NUM_CTX")  # e.g. "4096" to limit context


# -----------------------------------------------------------------------------
# Vitals parsing from free text
# -----------------------------------------------------------------------------
def parse_vitals_from_paragraph(paragraph: str) -> Dict[str, Any]:
    """Extract vitals from a clinical paragraph using regex. Missing = None."""
    text = paragraph.strip()
    vitals = {
        "temperature": None,
        "heart_rate": None,
        "respiratory_rate": None,
        "blood_pressure": None,
        "oxygen_sat": None,
        "consciousness": "ALERT",
        "on_oxygen": False,
    }
    # Temperature: 37.2°C, 37.2 C, temp 38, 38C
    m = re.search(r"(?:temp(?:erature)?|T)\s*[=:]?\s*(\d+\.?\d*)\s*[°]?\s*[Cc]?", text, re.IGNORECASE)
    if m:
        try:
            vitals["temperature"] = float(m.group(1))
        except ValueError:
            pass
    # Heart rate: 88 bpm, HR 72, pulse 90
    m = re.search(r"(?:HR|heart\s*rate|pulse)\s*[=:]?\s*(\d+)\s*(?:bpm)?", text, re.IGNORECASE)
    if m:
        try:
            vitals["heart_rate"] = int(m.group(1))
        except ValueError:
            pass
    # Respiratory rate: 18/min, RR 20, respiratory 16
    m = re.search(r"(?:RR|resp(?:iratory)?\s*rate)\s*[=:]?\s*(\d+)\s*(?:/min)?", text, re.IGNORECASE)
    if m:
        try:
            vitals["respiratory_rate"] = int(m.group(1))
        except ValueError:
            pass
    # Blood pressure: 120/80, BP 145/92
    m = re.search(r"(?:BP|blood\s*pressure)\s*[=:]?\s*(\d+)\s*/\s*(\d+)", text, re.IGNORECASE)
    if not m:
        m = re.search(r"\b(\d{2,3})\s*/\s*(\d{2,3})\s*(?:mmHg)?", text)
    if m:
        vitals["blood_pressure"] = f"{m.group(1)}/{m.group(2)}"
    # SpO2: 98%, sats 95, oxygen sat 92
    m = re.search(r"(?:SpO2|sats?|oxygen\s*sat(?:uration)?)\s*[=:]?\s*(\d+)\s*%?", text, re.IGNORECASE)
    if m:
        try:
            vitals["oxygen_sat"] = float(m.group(1))
        except ValueError:
            pass
    if "on oxygen" in text.lower() or "supplemental oxygen" in text.lower():
        vitals["on_oxygen"] = True
    if "unresponsive" in text.lower() or "GCS" in text.lower():
        vitals["consciousness"] = "VOICE"  # or PAIN/UNRESPONSIVE
    return vitals


# -----------------------------------------------------------------------------
# NEWS2 score
# -----------------------------------------------------------------------------
def calculate_news2_score(
    temperature: Optional[float] = None,
    heart_rate: Optional[int] = None,
    respiratory_rate: Optional[int] = None,
    oxygen_sat: Optional[float] = None,
    blood_pressure: Optional[str] = None,
    consciousness: str = "ALERT",
    on_oxygen: bool = False,
) -> Dict[str, Any]:
    """Compute NEWS2 from vitals. Returns total_score, breakdown, risk_level, action_required, urgency."""
    score = 0
    breakdown = {}

    def add(name: str, value: Any, s: int, desc: str):
        nonlocal score
        score += s
        breakdown[name] = {"value": value, "score": s, "description": desc}

    if temperature is not None:
        if temperature <= 35.0:
            add("temperature", temperature, 3, "Critical - Severe hypothermia")
        elif temperature <= 36.0:
            add("temperature", temperature, 1, "Low - Hypothermia")
        elif temperature <= 38.0:
            add("temperature", temperature, 0, "Normal (afebrile)")
        elif temperature <= 39.0:
            add("temperature", temperature, 1, "Elevated - Low-grade pyrexia")
        else:
            add("temperature", temperature, 2, "High - Significant pyrexia")
    else:
        add("temperature", "Not recorded", 0, "Not recorded")

    if heart_rate is not None:
        if heart_rate <= 40:
            add("heart_rate", heart_rate, 3, "Critical - Severe bradycardia")
        elif heart_rate <= 50:
            add("heart_rate", heart_rate, 1, "Low - Bradycardia")
        elif heart_rate <= 90:
            add("heart_rate", heart_rate, 0, "Normal")
        elif heart_rate <= 110:
            add("heart_rate", heart_rate, 1, "Elevated - Mild tachycardia")
        elif heart_rate <= 130:
            add("heart_rate", heart_rate, 2, "High - Tachycardia")
        else:
            add("heart_rate", heart_rate, 3, "Critical - Severe tachycardia")
    else:
        add("heart_rate", "Not recorded", 0, "Not recorded")

    if respiratory_rate is not None:
        if respiratory_rate <= 8:
            add("respiratory_rate", respiratory_rate, 3, "Critical - Bradypnoea")
        elif respiratory_rate <= 11:
            add("respiratory_rate", respiratory_rate, 1, "Low")
        elif respiratory_rate <= 20:
            add("respiratory_rate", respiratory_rate, 0, "Normal")
        elif respiratory_rate <= 24:
            add("respiratory_rate", respiratory_rate, 2, "Elevated - Tachypnoea")
        else:
            add("respiratory_rate", respiratory_rate, 3, "Critical - Severe tachypnoea")
    else:
        add("respiratory_rate", "Not recorded", 0, "Not recorded")

    if oxygen_sat is not None:
        if oxygen_sat <= 91:
            add("oxygen_sat", oxygen_sat, 3, "Critical - Severe hypoxia")
        elif oxygen_sat <= 93:
            add("oxygen_sat", oxygen_sat, 2, "Low - Hypoxia")
        elif oxygen_sat <= 95:
            add("oxygen_sat", oxygen_sat, 1, "Borderline")
        else:
            add("oxygen_sat", oxygen_sat, 0, "Normal")
    else:
        add("oxygen_sat", "Not recorded", 0, "Not recorded")

    if blood_pressure and blood_pressure != "Not recorded":
        try:
            systolic = int(str(blood_pressure).split("/")[0].strip())
            if systolic <= 90:
                add("blood_pressure", blood_pressure, 3, "Critical - Hypotension")
            elif systolic <= 100:
                add("blood_pressure", blood_pressure, 2, "Low")
            elif systolic <= 110:
                add("blood_pressure", blood_pressure, 1, "Low-normal")
            elif systolic <= 219:
                add("blood_pressure", blood_pressure, 0, "Normal range")
            else:
                add("blood_pressure", blood_pressure, 3, "Critical - Severe hypertension")
        except Exception:
            add("blood_pressure", blood_pressure, 0, "Invalid format")
    else:
        add("blood_pressure", "Not recorded", 0, "Not recorded")

    if consciousness.upper() == "ALERT":
        add("consciousness", consciousness, 0, "Alert and oriented")
    else:
        add("consciousness", consciousness, 3, "Reduced consciousness")
    add("supplemental_oxygen", "Yes" if on_oxygen else "No", 2 if on_oxygen else 0, "On O2" if on_oxygen else "Room air")

    if score == 0:
        risk_level, action_required, urgency = "Low", "Routine monitoring", "LOW"
    elif score <= 4:
        risk_level, action_required, urgency = "Low-Medium", "Standard review", "LOW"
    elif score <= 6:
        risk_level, action_required, urgency = "Medium", "Prompt review", "MEDIUM"
    else:
        risk_level, action_required, urgency = "High", "Prompt assessment", "HIGH"

    return {
        "total_score": score,
        "breakdown": breakdown,
        "risk_level": risk_level,
        "action_required": action_required,
        "urgency": urgency,
    }


# -----------------------------------------------------------------------------
# Ollama API (raw + LangChain when available)
# -----------------------------------------------------------------------------
def call_ollama(prompt: str, base_url: str, model: str, max_tokens: int, think: Optional[bool] = None) -> str:
    """POST to Ollama /api/generate; return response text.
    think: if False, disables DeepSeek-R1 extended thinking (much faster). Default None = don't set.
    Uses temperature=0 for deterministic, slightly faster output; num_ctx from env if set.
    """
    url = f"{base_url.rstrip('/')}/api/generate"
    options: Dict[str, Any] = {
        "num_predict": max_tokens,
        "temperature": 0,  # deterministic, faster, better for clinical
    }
    if OLLAMA_NUM_CTX:
        try:
            options["num_ctx"] = int(OLLAMA_NUM_CTX)
        except ValueError:
            pass
    payload: Dict[str, Any] = {
        "model": model,
        "prompt": prompt,
        "stream": False,
        "options": options,
    }
    if think is False:
        payload["think"] = False  # R1 won't think — significantly reduces time
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.URLError as e:
        msg = str(e.reason) if getattr(e, "reason", None) else str(e)
        if "Connection refused" in msg or "refused" in msg.lower():
            raise SystemExit(
                f"Cannot connect to Ollama at {base_url}. Start it with: ollama serve"
            ) from e
        raise SystemExit(f"Cannot reach Ollama at {base_url}. Error: {msg}") from e
    except (OSError, socket.timeout) as e:
        if "timed out" in str(e).lower() or isinstance(e, socket.timeout):
            raise SystemExit(
                f"Ollama at {base_url} timed out. The model may be loading; try again in a minute."
            ) from e
        raise SystemExit(
            f"Cannot connect to Ollama at {base_url}. Is it running? Run: ollama serve. Error: {e}"
        ) from e
    except Exception as e:
        raise SystemExit(
            f"Cannot reach Ollama at {base_url}. Is it running? Run: ollama serve. Error: {e}"
        ) from e
    if "error" in data:
        err = data["error"]
        if "not found" in err.lower() or "model" in err.lower():
            raise SystemExit(
                f"Ollama model error: {err}. Pull the model with: ollama pull {model}"
            )
        raise SystemExit(f"Ollama error: {err}")
    return data.get("response", "")


def invoke_ollama_langchain(
    model: str,
    base_url: str,
    system_content: str,
    user_content: str,
    max_tokens: int,
    limit_thinking: bool = False,
) -> str:
    """Use LangChain ChatOllama so agents get full message context. Returns assistant content.

    limit_thinking: if True, instructs DeepSeek-R1 to use minimal reasoning (faster).
    """
    if not LANGCHAIN_AVAILABLE:
        return call_ollama(
            system_content + "\n\n" + user_content,
            base_url,
            model,
            max_tokens,
            think=False if limit_thinking else None,
        )
    kwargs: Dict[str, Any] = {
        "model": model,
        "base_url": base_url,
        "num_predict": max_tokens,
        "temperature": 0,  # deterministic, faster, better for clinical
    }
    if OLLAMA_NUM_CTX:
        try:
            kwargs["num_ctx"] = int(OLLAMA_NUM_CTX)
        except ValueError:
            pass
    # DeepSeek-R1: think=False so R1 won't think — reduces time a lot
    if limit_thinking:
        kwargs["think"] = False
    llm = ChatOllama(**kwargs)
    messages = [SystemMessage(content=system_content), HumanMessage(content=user_content)]
    response = llm.invoke(messages)
    return (response.content or "").strip()


# -----------------------------------------------------------------------------
# Triage prompt (chain-of-thought, no location)
# -----------------------------------------------------------------------------
TRIAGE_SYSTEM = """You are an experienced triage nurse. Be concise and clinical. Do NOT over-explain. Assess the clinical paragraph and output ONLY valid JSON — no preamble, no markdown.

Rules:
- Keep clinical_assessment under 200 words. State facts, not elaborations.
- thought_process: exactly 5 short bullet points (one sentence each, no padding).
- differential_diagnoses: 2-4 diagnoses maximum. Each reasoning field: one sentence only.
- Do not repeat information across fields.
- severity_score 1-5: 1=highest acuity, 5=lowest.

Output schema (start with {, end with }):
{
  "severity_score": 3,
  "is_red_flag": false,
  "clinical_assessment": "Concise clinical summary under 200 words.",
  "differential_diagnoses": [
    {"diagnosis": "Name", "reasoning": "One sentence linking specific symptom/vital to this diagnosis."}
  ],
  "thought_process": [
    "Chief complaint: [one sentence]",
    "Concerning findings: [one sentence]",
    "Vitals: [one sentence]",
    "Top differentials and why: [one sentence]",
    "Acuity/disposition: [one sentence]"
  ],
  "risk_factors": ["factor1", "factor2"]
}"""


def build_triage_prompt(paragraph: str, news2_result: Optional[Dict[str, Any]]) -> str:
    vitals_blob = "Not calculated (no vitals parsed from text)."
    if news2_result:
        n = news2_result
        vitals_blob = f"NEWS2={n['total_score']} ({n['urgency']}). Scores: {json.dumps({k: v['score'] for k, v in n['breakdown'].items()}, default=str)}"
    return f"""{TRIAGE_SYSTEM}

VITALS: {vitals_blob}
PARAGRAPH: {paragraph.strip()}

JSON output only:"""


def _extract_json_block(text: str) -> Optional[str]:
    """Extract JSON from markdown code block or first { ... }."""
    if not text:
        return None
    # Try ```json ... ``` or ```\n{ ... }
    for pattern in [r"```(?:json)?\s*(\{[\s\S]*?\})\s*```", r"(\{[\s\S]*\})"]:
        m = re.search(pattern, text)
        if m:
            return m.group(1)
    start = text.find("{")
    end = text.rfind("}") + 1
    if start >= 0 and end > start:
        return text[start:end]
    return None


def _extract_differentials_from_raw(raw_text: str) -> List[Dict[str, str]]:
    """Try to extract differential diagnoses from raw response when JSON missing."""
    out = []
    for line in raw_text.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        # "diagnosis": "X" or "Diagnosis: X" or "- X: reasoning"
        m = re.search(r'"diagnosis"\s*:\s*"([^"]+)"(?:\s*,\s*"reasoning"\s*:\s*"([^"]*)")?', line, re.IGNORECASE)
        if m:
            out.append({"diagnosis": m.group(1).strip(), "reasoning": (m.group(2) or "").strip()})
            continue
        m = re.match(r"Diagnosis\s*:\s*(.+)", line, re.IGNORECASE)
        if m:
            rest = m.group(1).strip()
            if " - " in rest or ":" in rest:
                diag, _, reason = rest.partition(":") if ":" in rest else (rest.partition(" - ")[0], "", rest.partition(" - ")[2])
                out.append({"diagnosis": diag.strip(), "reasoning": (reason or "").strip()})
            else:
                out.append({"diagnosis": rest, "reasoning": ""})
            continue
        if line.startswith("- ") and len(line) > 3:
            rest = line[2:].strip()
            if ":" in rest:
                diag, _, reason = rest.partition(":")
                out.append({"diagnosis": diag.strip(), "reasoning": reason.strip()})
            else:
                out.append({"diagnosis": rest, "reasoning": ""})
            continue
        m = re.match(r"^\d+\.\s*(.+)", line)
        if m:
            rest = m.group(1).strip()
            if ":" in rest:
                diag, _, reason = rest.partition(":")
                out.append({"diagnosis": diag.strip(), "reasoning": reason.strip()})
            else:
                out.append({"diagnosis": rest, "reasoning": ""})
    return out


def _thought_lines_from_raw(raw_text: str) -> List[str]:
    """From raw response, take lines that look like reasoning (steps, bullets), not JSON."""
    if not raw_text:
        return []
    lines = []
    for line in raw_text.splitlines():
        s = line.strip()
        if not s or len(s) < 4:
            continue
        if s.startswith("{") or s.startswith("}") or '"severity_score"' in s or '"clinical_assessment"' in s:
            continue
        if re.match(r"^\d+\.", s) or re.match(r"^Step\s+\d", s, re.IGNORECASE) or re.match(r"^[-*•]", s):
            lines.append(s)
        elif "reasoning" in s.lower() or "assessment" in s.lower() or "symptom" in s.lower() or "vital" in s.lower():
            lines.append(s)
    if not lines:
        lines = [s for s in (line.strip() for line in raw_text.splitlines() if line.strip()) if s and not s.startswith("{") and not s.startswith("}")][:50]
    # FIX 3: Raised cap from 20 to 50 — DeepSeek-R1 produces many reasoning steps
    return lines[:50]


def parse_triage_response(response: str) -> Dict[str, Any]:
    """Extract JSON from model response; fallback to raw text so assessment/differentials/thought_process are never empty."""
    raw_text = (response or "").strip()
    thought_lines = _thought_lines_from_raw(raw_text)
    if not thought_lines:
        thought_lines = [line.strip() for line in raw_text.splitlines() if line.strip()][:50] if raw_text else []
    differentials_from_raw = _extract_differentials_from_raw(raw_text)
    defaults = {
        "severity_score": 3,
        "is_red_flag": False,
        # FIX 2: Removed [:3000] truncation — clinical_assessment was silently cut off
        "clinical_assessment": raw_text if raw_text else "No assessment returned.",
        "thought_process": thought_lines if thought_lines else ["Assessment completed"],
        "risk_factors": [],
        "differential_diagnoses": differentials_from_raw if differentials_from_raw else [],
    }
    json_str = _extract_json_block(raw_text)
    if json_str:
        try:
            parsed = json.loads(json_str)
            for k, v in defaults.items():
                if k not in parsed or parsed[k] is None:
                    parsed[k] = v
            # FIX 2: Removed [:3000] truncation here as well
            if not (parsed.get("clinical_assessment") or "").strip():
                parsed["clinical_assessment"] = raw_text if raw_text else "No assessment returned."
            tp = parsed.get("thought_process")
            if isinstance(tp, list) and tp and not isinstance(tp[0], str):
                parsed["thought_process"] = [str(x) for x in tp]
            elif not isinstance(tp, list) or not tp:
                parsed["thought_process"] = thought_lines or ["Assessment completed"]
            if not (parsed.get("differential_diagnoses") or []) and differentials_from_raw:
                parsed["differential_diagnoses"] = differentials_from_raw
            return parsed
        except json.JSONDecodeError:
            pass
    return defaults


# -----------------------------------------------------------------------------
# Agent 1: Triage only (vitals + assessment + differentials)
# -----------------------------------------------------------------------------
def run_agent_triage(
    paragraph: str,
    base_url: str = DEFAULT_OLLAMA_URL,
    triage_model: str = TRIAGE_MODEL,
    verbose: bool = True,
    debug: bool = False,
) -> Dict[str, Any]:
    """Agent 1: Parse vitals, compute score, run chain-of-thought triage. Returns triage result (no ICD)."""
    paragraph = paragraph.strip()
    if not paragraph:
        return {"error": "Empty paragraph"}

    vitals = parse_vitals_from_paragraph(paragraph)
    news2_result = None
    if any(vitals.get(k) is not None for k in ("temperature", "heart_rate", "respiratory_rate", "oxygen_sat", "blood_pressure")):
        news2_result = calculate_news2_score(
            temperature=vitals.get("temperature"),
            heart_rate=vitals.get("heart_rate"),
            respiratory_rate=vitals.get("respiratory_rate"),
            oxygen_sat=vitals.get("oxygen_sat"),
            blood_pressure=vitals.get("blood_pressure"),
            consciousness=vitals.get("consciousness", "ALERT"),
            on_oxygen=vitals.get("on_oxygen", False),
        )
        if verbose:
            print(f"Agent 1 (Triage): Vital signs score {news2_result['total_score']} ({news2_result['urgency']})", file=sys.stderr)

    if verbose:
        print(f"Agent 1 (Triage): Running {triage_model}" + (" (LangChain)" if LANGCHAIN_AVAILABLE else "") + "...", file=sys.stderr)
    vitals_blob = "Not calculated (no vitals parsed from text)."
    if news2_result:
        n = news2_result
        vitals_blob = f"Vital signs severity score: {n['total_score']}. Risk: {n['risk_level']}. Urgency: {n['urgency']}. Breakdown: {json.dumps(n['breakdown'], default=str)}"
    system_content = TRIAGE_SYSTEM + "\n\n=== VITAL SIGNS (if available) ===\n" + vitals_blob
    user_content = "=== CLINICAL PARAGRAPH ===\n\n" + paragraph + "\n\nOutput ONLY valid JSON (start with {, end with }). No markdown or extra text."
    triage_response = invoke_ollama_langchain(
        triage_model,
        base_url,
        system_content,
        user_content,
        TRIAGE_MAX_TOKENS,
        limit_thinking=True,  # think=False: R1 won't think, reduces time a lot
    )
    if debug:
        # FIX: increased debug preview from 2000 to 4000 chars so truncation is visible
        print("\n[DEBUG] Agent 1 raw response (first 4000 chars):\n" + (triage_response[:4000] or "(empty)") + "\n[DEBUG] end\n", file=sys.stderr)
    triage_result = parse_triage_response(triage_response)

    return {
        "news2": news2_result,
        "vitals_parsed": vitals,
        "triage": triage_result,
    }


def print_triage_output(result: Dict[str, Any]) -> None:
    """Display Agent 1 output as soon as triage is done."""
    if result.get("error"):
        return
    print("\n" + "=" * 60)
    print("AGENT 1 — TRIAGE (complete)")
    print("=" * 60)
    if result.get("news2"):
        n = result["news2"]
        print(f"Vital signs score: {n['total_score']}  |  {n['risk_level']}  |  {n['urgency']}")
    else:
        print("Vital signs score: Not calculated (no vitals parsed from text)")
    triage = result.get("triage", {})
    print(f"Severity: {triage.get('severity_score', '?')}  |  Concerning findings: {triage.get('is_red_flag', False)}")
    diffs = triage.get("differential_diagnoses") or []
    print("\nDifferential diagnoses (with reasoning):")
    if diffs:
        for d in diffs:
            if isinstance(d, dict):
                name = d.get("diagnosis", "—")
                reason = d.get("reasoning", "")
                print(f"  • {name}")
                if reason:
                    print(f"    → {reason}")
            else:
                print(f"  • {d}")
    else:
        print("  (None)")
    print(f"\nClinical assessment:\n{triage.get('clinical_assessment', 'N/A')}")
    print("\nThought process:")
    for step in triage.get("thought_process", []):
        print(f"  - {step}")
    print("=" * 60 + "\n")


# -----------------------------------------------------------------------------
# Full triage context for Agent 2 (entire Agent 1 / DeepSeek output)
# -----------------------------------------------------------------------------
def _full_triage_context_for_agent2(triage_output: Dict[str, Any]) -> str:
    """Serialize full Agent 1 (triage/DeepSeek) output so Agent 2 has complete context."""
    parts = []

    if triage_output.get("news2"):
        n = triage_output["news2"]
        parts.append("VITAL SIGNS SCORE: " + str(n.get("total_score", "")) + " | Risk: " + str(n.get("risk_level", "")) + " | " + str(n.get("urgency", "")))
        parts.append("Breakdown: " + json.dumps(n.get("breakdown", {}), default=str))

    if triage_output.get("vitals_parsed"):
        v = triage_output["vitals_parsed"]
        parts.append("Vitals parsed: " + json.dumps({k: v for k, v in v.items() if v is not None}, default=str))

    triage = triage_output.get("triage") or {}
    parts.append("Severity score (1-5): " + str(triage.get("severity_score", "")))
    parts.append("Concerning findings (red flag): " + str(triage.get("is_red_flag", "")))
    if triage.get("risk_factors"):
        parts.append("Risk factors: " + ", ".join(triage["risk_factors"]))
    if triage.get("clinical_assessment"):
        parts.append("\nCLINICAL ASSESSMENT:\n" + (triage["clinical_assessment"] or ""))
    if triage.get("thought_process"):
        parts.append("\nTHOUGHT PROCESS:")
        for step in triage["thought_process"]:
            parts.append("  - " + str(step))
    if triage.get("differential_diagnoses"):
        parts.append("\nDIFFERENTIAL DIAGNOSES:")
        for d in triage["differential_diagnoses"]:
            if isinstance(d, dict):
                name = d.get("diagnosis", "")
                reason = d.get("reasoning", "")
                parts.append("  - " + str(name) + (": " + str(reason) if reason else ""))
            else:
                parts.append("  - " + str(d))

    return "\n".join(parts) if parts else ""


# -----------------------------------------------------------------------------
# Agent 2: Care plan — one focused API call per section
# -----------------------------------------------------------------------------

# Shared system role for all section calls
_AGENT2_SYSTEM = (
    "You are a clinical physician. Answer only what is asked. "
    "No questions. No dialogue. No preamble. Output only the requested clinical information."
)

# Per-section prompts — each asks for exactly one thing
_SECTION_PROMPTS = {
    "TREATMENT PLAN": (
        "List the treatment steps for this patient as a numbered list. "
        "Each step must be one specific clinical action. "
        "End the list with the red flag symptoms that should prompt an immediate return to the ED. "
        "No questions. No dialogue. Start directly with '1.'"
    ),
    "RECOMMENDED MEDICATIONS": (
        "List every medication this patient should receive. "
        "One medication per line in this exact format: "
        "[generic name] [dose] [route] [frequency] [duration] | Indication: [why] | Monitor: [what to watch] "
        "No questions. No dialogue. No intro sentence. Start directly with the first medication."
    ),
    "LAB TESTS": (
        "List every lab test and investigation that should be ordered for this patient. "
        "One test per line in this exact format: "
        "[exact test name] | [specific clinical reason for this patient] | [STAT / routine / fasting] "
        "No questions. No dialogue. No intro sentence. Start directly with the first test."
    ),
    "ICD-10 CODES": (
        "You are an expert medical coder. Based on the patient context, assign ICD-10-CM codes. "
        "Rules: "
        "(1) Assign ONE code for the most likely primary diagnosis — choose the most specific code available, not a general parent code. "
        "For example: use K80.20 (Calculus of gallbladder without cholecystitis) not K80 alone; use J18.9 not J18; use E11.649 not E11.9. "
        "(2) Assign one code for EACH differential diagnosis listed in the triage. "
        "(3) If a symptom has no confirmed diagnosis yet, use the symptom code (e.g. R17 for jaundice, R10.9 for abdominal pain). "
        "(4) Do NOT invent diagnoses not mentioned in the triage. "
        "(5) Output one code per line in this exact format: [code] — [full description] "
        "No questions. No dialogue. No intro sentence. Start directly with the first code."
    ),
    "DIET & LIFESTYLE": (
        "List specific diet and lifestyle recommendations for this patient based on their diagnosis and presentation. "
        "Cover: foods to eat, foods to avoid, physical activity guidance, sleep, stress management, smoking/alcohol if relevant, and any disease-specific habits. "
        "One recommendation per line. Be specific to this patient — not generic advice. "
        "No questions. No dialogue. No intro sentence. Start directly with the first recommendation."
    ),
    "NEXT VISIT": (
        "State in one sentence when this patient should return and the specific clinical reason why. "
        "No questions. No dialogue. No intro. Just the one sentence."
    ),
}


# Token budgets per section — ICD and diet need more room
_SECTION_MAX_TOKENS = {
    "TREATMENT PLAN": 512,
    "RECOMMENDED MEDICATIONS": 600,
    "LAB TESTS": 400,
    "ICD-10 CODES": 700,   # more codes = more lines needed
    "DIET & LIFESTYLE": 600,
    "NEXT VISIT": 128,
}


def _call_section(
    section_name: str,
    prompt: str,
    context: str,
    model: str,
    base_url: str,
    debug: bool = False,
) -> str:
    """Make a single focused API call for one care plan section. Returns cleaned text."""
    user_msg = f"PATIENT CONTEXT:\n{context}\n\nTASK: {prompt}"
    max_tok = _SECTION_MAX_TOKENS.get(section_name, 512)
    raw = invoke_ollama_langchain(
        model, base_url, _AGENT2_SYSTEM, user_msg, max_tokens=max_tok
    )
    if debug:
        print(f"\n[DEBUG] {section_name} raw:\n{raw[:1000]}\n[DEBUG end]\n", file=sys.stderr)
    return _strip_dialogue(raw).strip()


# Artifact tags the model may echo from its training data
_ARTIFACT_TAGS = re.compile(r"\[/?Patient\]|\[/?INST\]|<<SYS>>|<</SYS>>", re.IGNORECASE)

# Trailing filler phrases that appear after the real content
_FILLER_STARTS = re.compile(
    r"^(it's essential|it is essential|it is important|further investigations|"
    r"note that|please note|this is not|disclaimer|the above|the medications? (listed|above)|"
    r"the (lab|laboratory) tests? (listed|above)|the icd|in summary|to summarize|"
    r"remember to|always consult)",
    re.IGNORECASE,
)

def _strip_dialogue(text: str) -> str:
    """Remove artifact tags, duplicate lines, dialogue, questions, and trailing filler."""
    if not text:
        return ""

    # Remove inline artifact tags
    text = _ARTIFACT_TAGS.sub("", text).strip()

    skip_phrases = [
        "thank you", "let's", "let us", "we need to", "we should",
        "we must", "we can", "as a physician", "as a clinician",
        "in this case", "great question", "of course", "certainly",
        "i will", "i would", "please note", "please be aware",
        "the medications this patient", "the lab tests", "the following medications",
        "here are", "here is",
    ]

    seen_content: set = set()   # deduplicate by normalised line content
    clean_lines = []
    for line in text.splitlines():
        stripped = line.strip()

        # Skip blank lines until we have real content, preserve them after
        if not stripped:
            if clean_lines:
                clean_lines.append("")
            continue

        # Drop artifact tag lines that weren't fully caught by regex
        if _ARTIFACT_TAGS.search(stripped):
            continue

        # Drop questions
        if stripped.endswith("?"):
            continue

        lower = stripped.lower()

        # Drop dialogue/filler openers
        if any(lower.startswith(p) for p in skip_phrases):
            continue

        # Drop trailing filler paragraphs (once one appears, everything after is noise)
        if _FILLER_STARTS.match(stripped):
            break

        # Deduplicate: normalise the line (strip numbering, punctuation, lowercase)
        normalised = re.sub(r"^[\d]+[.)]\s*", "", lower).strip()
        normalised = re.sub(r"\s+", " ", normalised)
        if normalised and normalised in seen_content:
            continue
        if normalised:
            seen_content.add(normalised)

        clean_lines.append(line)

    # Strip trailing blank lines
    while clean_lines and not clean_lines[-1].strip():
        clean_lines.pop()

    return "\n".join(clean_lines).strip()


def run_agent_care_plan(
    triage_output: Dict[str, Any],
    base_url: str = DEFAULT_OLLAMA_URL,
    model: str = ICD_MODEL,
    max_tokens: int = AGENT2_MAX_TOKENS,
    verbose: bool = True,
    debug: bool = False,
    paragraph: Optional[str] = None,
) -> Dict[str, str]:
    """Agent 2: One focused API call per section. Returns dict of section_name -> content."""
    full_context = _full_triage_context_for_agent2(triage_output)
    if (paragraph or "").strip():
        full_context = (
            "ORIGINAL CLINICAL PARAGRAPH:\n" + paragraph.strip() + "\n\n" +
            ("TRIAGE ASSESSMENT:\n" + full_context if full_context.strip()
             else "No triage assessment available.")
        )
    if not full_context.strip():
        if verbose:
            print("Agent 2 (Care plan): No context — skipping.", file=sys.stderr)
        return {s: "(No context available.)" for s in _SECTION_PROMPTS}

    # Run all section calls in parallel for speed (Ollama can handle multiple concurrent requests)
    max_workers = int(os.environ.get("CLINICAL_CARE_PARALLEL", "6"))
    results: Dict[str, str] = {}
    if verbose:
        print("  Agent 2: generating all sections in parallel...", file=sys.stderr)
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_section = {
            executor.submit(
                _call_section, section_name, prompt, full_context, model, base_url, debug
            ): section_name
            for section_name, prompt in _SECTION_PROMPTS.items()
        }
        for future in as_completed(future_to_section):
            section_name = future_to_section[future]
            try:
                results[section_name] = future.result()
            except Exception as e:
                results[section_name] = f"(Error: {e})"
    return results


def print_care_plan_output(care_plan: Dict[str, str]) -> None:
    """Display Agent 2 care plan section by section."""
    print("\n" + "=" * 60)
    print("AGENT 2 — CARE PLAN (complete)")
    print("=" * 60)
    for section_name, content in care_plan.items():
        print(f"\n{section_name}:")
        print(content if content else "  (None)")
    print("\n" + "=" * 60 + "\n")


# -----------------------------------------------------------------------------
# CLI
# -----------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(
        description="Two agents: (1) Triage (2) Care plan (treatment, meds, labs, ICD-10, next visit). Full context to Agent 2."
    )
    parser.add_argument("input", nargs="?", default=None, help="Clinical paragraph. If omitted, read from stdin.")
    parser.add_argument("--url", type=str, default=DEFAULT_OLLAMA_URL, help="Ollama base URL")
    parser.add_argument("--triage-model", type=str, default=TRIAGE_MODEL, help="Ollama model for Agent 1 (triage)")
    parser.add_argument("--care-plan-model", type=str, default=ICD_MODEL, help="Ollama model for Agent 2 (care plan)")
    parser.add_argument("--json", action="store_true", help="At end, print combined JSON (agents still display as they finish)")
    parser.add_argument("--quiet", action="store_true", help="Less stderr output")
    parser.add_argument("--debug", action="store_true", help="Print raw model responses (Agent 1 and 2) to stderr before parsing")
    args = parser.parse_args()

    paragraph = args.input if args.input is not None else sys.stdin.read()
    if not paragraph.strip():
        print("No input paragraph provided.", file=sys.stderr)
        sys.exit(1)

    verbose = not args.quiet

    try:
        # --- Agent 1: Triage (DeepSeek) ---
        triage_result = run_agent_triage(
            paragraph,
            base_url=args.url,
            triage_model=args.triage_model,
            verbose=verbose,
            debug=args.debug,
        )
        if triage_result.get("error"):
            print(triage_result["error"], file=sys.stderr)
            sys.exit(1)
        if not args.quiet:
            print_triage_output(triage_result)

        # --- Agent 2: Care plan (one focused call per section) ---
        care_plan = run_agent_care_plan(
            triage_result,
            base_url=args.url,
            model=args.care_plan_model,
            max_tokens=AGENT2_MAX_TOKENS,
            verbose=verbose,
            debug=args.debug,
            paragraph=paragraph,
        )
        if not args.quiet:
            print_care_plan_output(care_plan)

        if args.json:
            combined = {
                "paragraph_summary": paragraph[:200] + ("..." if len(paragraph) > 200 else ""),
                "agent1_triage": triage_result,
                "agent2_care_plan": care_plan,  # Dict[str, str] — one key per section
            }
            # Single line when --quiet so the app can parse stdout reliably
            if args.quiet:
                print(json.dumps(combined, default=str))
            else:
                print(json.dumps(combined, indent=2, default=str))
    except SystemExit:
        raise
    except Exception as e:
        msg = str(e).strip() or "Model run failed."
        if "ollama" not in msg.lower() and "pull" not in msg.lower():
            msg = f"{msg}\nEnsure Ollama is running (ollama serve) and model is pulled: ollama pull mistral."
        print(msg, file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
