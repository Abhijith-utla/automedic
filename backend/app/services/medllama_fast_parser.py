"""
Fast parser: MedLlama text output → structured JSON for all dashboard components.

Takes the raw text sections returned by MedLlama (Agent 2) and parses them into
the exact shapes expected by the dashboard: treatment_steps, medications,
lab_tests, icd_codes, diet_lifestyle, next_visit. Handles format variations
(numbering, bullets, pipe vs. colon, em-dash vs hyphen) so the dashboard
always receives usable data.
"""

import re
from typing import Any, Dict, List, Optional

# Section keys as returned by almost.py Agent 2
SECTION_KEYS = [
    "TREATMENT PLAN",
    "RECOMMENDED MEDICATIONS",
    "LAB TESTS",
    "ICD-10 CODES",
    "DIET & LIFESTYLE",
    "NEXT VISIT",
]

# Alternate headers for splitting a single blob (case-insensitive)
SECTION_HEADERS = [
    (r"treatment\s*plan", "TREATMENT PLAN"),
    (r"recommended\s*medications?", "RECOMMENDED MEDICATIONS"),
    (r"lab\s*tests?", "LAB TESTS"),
    (r"icd[- ]?10\s*codes?", "ICD-10 CODES"),
    (r"diet\s*[& and]*\s*lifestyle", "DIET & LIFESTYLE"),
    (r"next\s*visit", "NEXT VISIT"),
]


def split_blob_into_sections(blob: str) -> Dict[str, str]:
    """If MedLlama returns one text block, split by section headers. Returns section_key -> text."""
    if not (blob or "").strip():
        return {}
    text = blob.strip()
    sections: Dict[str, str] = {}
    header_pattern = re.compile(
        r"(?m)^\s*(Treatment\s+plan|Recommended\s+medications?|Lab\s+tests?|ICD[- ]?10\s*codes?|Diet\s*[& and]+\s*lifestyle|Next\s+visit)\s*:?\s*$",
        re.IGNORECASE,
    )
    compiled = [(re.compile(pat, re.IGNORECASE), key) for pat, key in SECTION_HEADERS]
    last_end = 0
    last_key: Optional[str] = None
    for m in header_pattern.finditer(text):
        if last_key:
            sections[last_key] = text[last_end : m.start()].strip()
        for pat, key in compiled:
            if pat.search(m.group(0)):
                last_key = key
                break
        last_end = m.end()
    if last_key:
        sections[last_key] = text[last_end:].strip()
    return sections


def _normalize_care_plan_keys(care_plan: Dict[str, str]) -> Dict[str, str]:
    """Map alternate keys to SECTION_KEYS so we can use get() with canonical names."""
    normalized: Dict[str, str] = {}
    key_aliases = {
        "TREATMENT PLAN": ["TREATMENT PLAN", "Treatment Plan", "treatment plan"],
        "RECOMMENDED MEDICATIONS": ["RECOMMENDED MEDICATIONS", "Recommended Medications", "RECOMMENDED MEDICATION"],
        "LAB TESTS": ["LAB TESTS", "Lab Tests", "LAB TESTS AND IMAGING"],
        "ICD-10 CODES": ["ICD-10 CODES", "ICD-10", "ICD10 CODES"],
        "DIET & LIFESTYLE": ["DIET & LIFESTYLE", "Diet & Lifestyle", "Diet and Lifestyle"],
        "NEXT VISIT": ["NEXT VISIT", "Next Visit", "Follow-up", "Follow up"],
    }
    for raw_key, value in care_plan.items():
        if not (value or "").strip():
            continue
        k_upper = (raw_key or "").strip().upper()
        matched = False
        for canonical, aliases in key_aliases.items():
            if raw_key in aliases or canonical == raw_key or k_upper == canonical.replace(" ", "").replace("&", "AND"):
                normalized[canonical] = (normalized.get(canonical) or "").strip() + "\n" + (value or "").strip()
                matched = True
                break
            if canonical.lower() in (raw_key or "").lower():
                normalized[canonical] = (normalized.get(canonical) or "").strip() + "\n" + (value or "").strip()
                matched = True
                break
        if not matched and raw_key in SECTION_KEYS:
            normalized[raw_key] = (normalized.get(raw_key) or "").strip() + "\n" + (value or "").strip()
    for k in SECTION_KEYS:
        if k in care_plan and k not in normalized:
            normalized[k] = (care_plan[k] or "").strip()
    return normalized


# ----- Treatment plan -----
def parse_treatment_steps(text: str) -> List[str]:
    """Numbered list (1. 1) or bullet lines. Cap 30."""
    if not (text or "").strip():
        return []
    steps = []
    for line in (text or "").strip().splitlines():
        line = line.strip()
        if not line or len(line) < 2:
            continue
        # Numbered: 1. step or 1) step
        m = re.match(r"^\d+[.)]\s*(.+)", line)
        if m:
            steps.append(m.group(1).strip())
            continue
        # Bullet: - step or * step or • step
        if re.match(r"^[-*•]\s+", line):
            steps.append(re.sub(r"^[-*•]\s+", "", line).strip())
            continue
        if not line.startswith("(") and line.lower() not in ("none", "n/a", "na"):
            steps.append(line)
    return steps[:30]


# ----- Medications -----
def parse_medications(text: str) -> List[Dict[str, Any]]:
    """Pipe-separated or 'Indication:' / 'Monitor:' on same line. Format: name dose route freq | Indication: ... | Monitor: ..."""
    if not (text or "").strip():
        return []
    out = []
    for line in (text or "").strip().splitlines():
        line = line.strip()
        if not line or re.match(r"^\d+[.)]\s*$", line):
            continue
        # Remove leading number
        line = re.sub(r"^\d+[.)]\s*", "", line).strip()
        if not line:
            continue
        parts = [p.strip() for p in line.split("|")]
        name_dose = (parts[0] or "").strip()
        indication = ""
        monitor = ""
        for p in parts[1:]:
            if re.match(r"indication\s*:", p, re.IGNORECASE):
                indication = re.sub(r"^indication\s*:\s*", "", p, flags=re.IGNORECASE).strip()
            elif re.match(r"monitor\s*:", p, re.IGNORECASE):
                monitor = re.sub(r"^monitor\s*:\s*", "", p, flags=re.IGNORECASE).strip()
        if not name_dose:
            continue
        out.append({"name_dose": name_dose, "indication": indication, "monitor": monitor})
    return out[:25]


# ----- Lab tests -----
def parse_lab_tests(text: str) -> List[Dict[str, Any]]:
    """Format: Test name | reason | STAT/routine/fasting. Fields: name, reason, priority, note."""
    if not (text or "").strip():
        return []
    out = []
    for line in (text or "").strip().splitlines():
        line = line.strip()
        if not line:
            continue
        line = re.sub(r"^\d+[.)]\s*", "", line).strip()
        if not line:
            continue
        parts = [p.strip() for p in line.split("|")]
        name = (parts[0] or "").strip()
        if not name:
            continue
        reason = (parts[1] if len(parts) > 1 else "").strip()
        priority_note = (parts[2] if len(parts) > 2 else "").strip()
        priority = "Routine"
        ln = priority_note.lower()
        if "stat" in ln or "urgent" in ln or "asap" in ln:
            priority = "Urgent"
        elif "elective" in ln or "routine" in ln:
            priority = "Routine" if "routine" in ln else "Elective"
        out.append({"name": name, "reason": reason, "priority": priority, "note": priority_note})
    return out[:30]


# ----- ICD-10 -----
def parse_icd_codes(text: str) -> List[Dict[str, str]]:
    """Format: K80.20 — Description or K80.20  Description. Accept em-dash, hyphen, colon."""
    if not (text or "").strip():
        return []
    out = []
    # ICD-10 pattern: letter + 2+ digits, optional . and more digits
    code_pat = re.compile(r"^([A-Z]\d{2}(?:\.\d{2,4})?)\s*[—\-–:\s]+\s*(.+)", re.IGNORECASE)
    for line in (text or "").strip().splitlines():
        line = line.strip()
        if not line:
            continue
        line = re.sub(r"^\d+[.)]\s*", "", line).strip()
        m = code_pat.match(line)
        if m:
            out.append({"code": m.group(1).strip().upper(), "description": m.group(2).strip()})
            continue
        # Code followed by space and rest
        m = re.match(r"^([A-Z]\d{2}(?:\.\d{2,4})?)\s+(.+)", line, re.IGNORECASE)
        if m:
            out.append({"code": m.group(1).strip().upper(), "description": m.group(2).strip()})
    return out[:25]


# ----- Diet & lifestyle -----
def parse_diet_lifestyle(text: str) -> Dict[str, List[str]]:
    """Bullet or numbered lines → list of recommendations."""
    if not (text or "").strip():
        return {"recommendations": []}
    recs = []
    for line in (text or "").strip().splitlines():
        line = line.strip()
        if len(line) < 3:
            continue
        line = re.sub(r"^\d+[.)]\s*", "", line).strip()
        line = re.sub(r"^[-*•]\s*", "", line).strip()
        if line and line.lower() not in ("none", "n/a", "na"):
            recs.append(line)
    return {"recommendations": recs[:40]}


# ----- Next visit -----
def parse_next_visit(text: str) -> str:
    """Single sentence or first line."""
    if not (text or "").strip():
        return ""
    first = (text or "").strip().split("\n")[0].strip()
    # Take first sentence if long
    if len(first) > 200:
        dot = first.find(". ", 0, 220)
        if dot > 0:
            first = first[: dot + 1]
    return first


def medllama_care_plan_to_structured(care_plan_raw: Optional[Dict[str, str]] = None, blob: Optional[str] = None) -> Dict[str, Any]:
    """
    Parse MedLlama text into dashboard-ready structured JSON.

    Args:
        care_plan_raw: Section name -> text (from almost.py agent2_care_plan).
        blob: If provided and care_plan_raw is empty, split this single text into sections first.

    Returns:
        Dict with treatment_steps, medications, lab_tests, icd_codes, diet_lifestyle, next_visit, raw.
        Matches CarePlanStructured for frontend (TriageOverview, LabsExplorer, CarePathway, ICDLens, LifestyleBoard, ReportInsights).
    """
    empty = {
        "treatment_steps": [],
        "medications": [],
        "lab_tests": [],
        "icd_codes": [],
        "diet_lifestyle": {"recommendations": []},
        "next_visit": "",
        "raw": {},
    }
    sections = care_plan_raw or {}
    if not sections and (blob or "").strip():
        sections = split_blob_into_sections(blob)
    if not sections:
        return empty

    sections = _normalize_care_plan_keys(sections)
    raw = dict(sections)

    treatment_text = sections.get("TREATMENT PLAN") or ""
    meds_text = sections.get("RECOMMENDED MEDICATIONS") or ""
    labs_text = sections.get("LAB TESTS") or ""
    icd_text = sections.get("ICD-10 CODES") or ""
    diet_text = sections.get("DIET & LIFESTYLE") or ""
    next_text = sections.get("NEXT VISIT") or ""

    return {
        "treatment_steps": parse_treatment_steps(treatment_text),
        "medications": parse_medications(meds_text),
        "lab_tests": parse_lab_tests(labs_text),
        "icd_codes": parse_icd_codes(icd_text),
        "diet_lifestyle": parse_diet_lifestyle(diet_text),
        "next_visit": parse_next_visit(next_text),
        "raw": raw,
    }


def main() -> None:
    """CLI: read MedLlama text (section-keyed JSON or raw blob) from stdin; print dashboard JSON to stdout."""
    import json
    import sys
    raw = (sys.stdin.read() or "").strip()
    if not raw:
        print(json.dumps(medllama_care_plan_to_structured(), indent=2))
        return
    # Try as JSON first (section key -> text)
    try:
        obj = json.loads(raw)
        if isinstance(obj, dict) and any(isinstance(v, str) for v in obj.values()):
            out = medllama_care_plan_to_structured(care_plan_raw=obj)
        else:
            out = medllama_care_plan_to_structured(blob=raw)
    except json.JSONDecodeError:
        out = medllama_care_plan_to_structured(blob=raw)
    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    main()
