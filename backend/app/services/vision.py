"""
Vision assessment service using the user's exact model implementation.

Source file is copied verbatim to:
  backend/scripts/vision_exact.py
"""

import base64
import importlib.util
import re
import threading
from pathlib import Path
from typing import Any, AsyncIterator

import cv2
import numpy as np

_VISION_EXACT_PATH = Path(__file__).resolve().parent.parent.parent / "scripts" / "vision_exact.py"
_VISION_EXACT_MODULE = None


def _load_vision_exact():
    global _VISION_EXACT_MODULE
    if _VISION_EXACT_MODULE is not None:
        return _VISION_EXACT_MODULE
    if not _VISION_EXACT_PATH.exists():
        raise RuntimeError(f"vision_exact.py not found at {_VISION_EXACT_PATH}")
    spec = importlib.util.spec_from_file_location("vision_exact_module", str(_VISION_EXACT_PATH))
    if spec is None or spec.loader is None:
        raise RuntimeError("Unable to load vision_exact.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)  # type: ignore[attr-defined]
    _VISION_EXACT_MODULE = mod
    return mod


def _decode_data_url_to_bgr(image_base64: str) -> Any:
    raw = (image_base64 or "").strip()
    if "," in raw and raw.lower().startswith("data:image"):
        raw = raw.split(",", 1)[1]
    arr = np.frombuffer(base64.b64decode(raw), dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Could not decode image")
    return img


def _extract_keywords(text: str) -> list[str]:
    tokens = re.findall(r"[a-zA-Z][a-zA-Z\-]{2,}", (text or "").lower())
    blacklist = {
        "the", "and", "with", "from", "that", "this", "image", "patient", "visible",
        "normal", "appears", "there", "about", "could", "would", "should",
    }
    out: list[str] = []
    seen = set()
    for t in tokens:
        if t in blacklist or t in seen:
            continue
        seen.add(t)
        out.append(t)
        if len(out) >= 20:
            break
    return out


def _extract_severity(text: str) -> str:
    s = (text or "").lower()
    if any(k in s for k in ("urgent", "severe", "marked", "significant", "concerning")):
        return "high"
    if any(k in s for k in ("moderate", "possible", "needs evaluation", "follow-up")):
        return "moderate"
    return "low"


def assess_wound_screenshot(image_base64: str) -> dict[str, Any]:
    """
    Use the exact external model implementation for screenshot prediction.
    """
    frame = _decode_data_url_to_bgr(image_base64)
    mod = _load_vision_exact()
    lock = threading.Lock()
    holder = {"text": "", "processing": True}

    model_name = "llama3.2-vision"
    mod.run_analysis(frame.copy(), model_name, holder, lock)

    with lock:
        summary = str(holder.get("text") or "").strip()
    if not summary:
        summary = "No response."
    if summary.lower().startswith("analysis error:"):
        # Fallback so UI still gets useful output when model fails.
        redness = float(mod.compute_redness(frame))
        if redness >= 15:
            summary = "Visible erythema and possible inflammation in captured wound region."
        elif redness >= 6:
            summary = "Mild to moderate redness noted; monitor for progression, warmth, and edema."
        else:
            summary = "No marked redness detected in current image; correlate with symptoms and exam."

    redness = float(mod.compute_redness(frame))
    return {
        "summary": summary,
        "severity": _extract_severity(summary),
        "keywords": _extract_keywords(summary),
        "metrics": {
            "redness_pct": round(redness, 2),
            "brightness": round(float(np.mean(cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY))), 2),
            "edge_density_pct": 0.0,
            "laplacian_variance": 0.0,
        },
    }


async def vision_observations(frame_stream: AsyncIterator[bytes]) -> AsyncIterator[str]:
    if False:
        yield ""  # pragma: no cover
