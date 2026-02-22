"""
Parse Agent 2 care plan text sections into structured data for the dashboard.
"""

import re
from typing import Any, Dict, List


def parse_treatment_plan(text: str) -> List[str]:
    """Extract numbered treatment steps. Returns list of step strings."""
    if not (text or "").strip():
        return []
    steps = []
    for line in (text or "").strip().splitlines():
        line = line.strip()
        if not line:
            continue
        # Remove leading "1." or "1)" etc.
        m = re.match(r"^\d+[.)]\s*(.+)", line)
        if m:
            steps.append(m.group(1).strip())
        elif line and not line.startswith("("):
            steps.append(line)
    return steps[:30]  # cap


def parse_medications(text: str) -> List[Dict[str, Any]]:
    """Parse lines like: [name] dose route freq | Indication: ... | Monitor: ..."""
    if not (text or "").strip():
        return []
    out = []
    for line in (text or "").strip().splitlines():
        line = line.strip()
        if not line or re.match(r"^\d+[.)]\s*$", line):
            continue
        parts = [p.strip() for p in line.split("|")]
        name_dose = (parts[0] or "").strip()
        indication = ""
        monitor = ""
        for p in parts[1:]:
            if p.lower().startswith("indication:"):
                indication = p[10:].strip()
            elif p.lower().startswith("monitor:"):
                monitor = p[8:].strip()
        out.append({
            "name_dose": name_dose,
            "indication": indication,
            "monitor": monitor,
        })
    return out[:20]


def parse_lab_tests(text: str) -> List[Dict[str, Any]]:
    """Parse lines like: Test name | reason | Routine/Urgent/Elective, fasting."""
    if not (text or "").strip():
        return []
    out = []
    for line in (text or "").strip().splitlines():
        line = line.strip()
        if not line:
            continue
        parts = [p.strip() for p in line.split("|")]
        name = (parts[0] or "").strip()
        if not name or re.match(r"^\d+[.)]\s*$", name):
            continue
        reason = parts[1] if len(parts) > 1 else ""
        priority_note = parts[2] if len(parts) > 2 else ""
        priority = "Routine"
        if "urgent" in priority_note.lower():
            priority = "Urgent"
        elif "elective" in priority_note.lower():
            priority = "Elective"
        out.append({"name": name, "reason": reason, "priority": priority, "note": priority_note})
    return out[:30]


def parse_icd_codes(text: str) -> List[Dict[str, str]]:
    """Parse lines like: K80.20 — Description or K80.20 Description."""
    if not (text or "").strip():
        return []
    out = []
    for line in (text or "").strip().splitlines():
        line = line.strip()
        if not line:
            continue
        # Code — Description or Code Description
        m = re.match(r"^([A-Z]\d{2}(?:\.\d{2,4})?)\s*[—\-:]\s*(.+)", line, re.IGNORECASE)
        if m:
            out.append({"code": m.group(1).strip(), "description": m.group(2).strip()})
            continue
        m = re.match(r"^([A-Z]\d{2}(?:\.\d{2,4})?)\s+(.+)", line, re.IGNORECASE)
        if m:
            out.append({"code": m.group(1).strip(), "description": m.group(2).strip()})
    return out[:20]


def parse_diet_lifestyle(text: str) -> Dict[str, List[str]]:
    """Split into categories by common headers or return single list."""
    if not (text or "").strip():
        return {"recommendations": []}
    lines = [ln.strip() for ln in (text or "").strip().splitlines() if ln.strip()]
    recommendations = []
    for line in lines:
        if len(line) < 3:
            continue
        # Remove leading numbers/bullets
        line = re.sub(r"^\d+[.)]\s*", "", line).strip()
        if line:
            recommendations.append(line)
    return {"recommendations": recommendations[:40]}


def parse_next_visit(text: str) -> str:
    """Single sentence."""
    if not (text or "").strip():
        return ""
    return (text or "").strip().split("\n")[0].strip()


def parse_care_plan_sections(care_plan: Dict[str, str]) -> Dict[str, Any]:
    """Turn raw Agent 2 section text into structured data for the frontend."""
    if not care_plan:
        return {
            "treatment_steps": [],
            "medications": [],
            "lab_tests": [],
            "icd_codes": [],
            "diet_lifestyle": {"recommendations": []},
            "next_visit": "",
        }
    return {
        "treatment_steps": parse_treatment_plan(care_plan.get("TREATMENT PLAN") or ""),
        "medications": parse_medications(care_plan.get("RECOMMENDED MEDICATIONS") or ""),
        "lab_tests": parse_lab_tests(care_plan.get("LAB TESTS") or ""),
        "icd_codes": parse_icd_codes(care_plan.get("ICD-10 CODES") or ""),
        "diet_lifestyle": parse_diet_lifestyle(care_plan.get("DIET & LIFESTYLE") or ""),
        "next_visit": parse_next_visit(care_plan.get("NEXT VISIT") or ""),
        "raw": care_plan,  # keep for fallback display
    }
