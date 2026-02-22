"""
OpenCV vision analysis for encounter screenshots.
Used to assess possible wound/inflammation signals from a captured frame.
"""

import base64
from typing import Any, AsyncIterator

try:
    import cv2
    import numpy as np
except Exception:  # pragma: no cover - handled at runtime
    cv2 = None
    np = None


def _decode_data_url_to_bgr(image_base64: str) -> Any:
    if cv2 is None or np is None:
        raise RuntimeError("OpenCV dependencies are missing. Install: pip install opencv-python numpy")
    raw = (image_base64 or "").strip()
    if "," in raw and raw.lower().startswith("data:image"):
        raw = raw.split(",", 1)[1]
    arr = np.frombuffer(base64.b64decode(raw), dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Could not decode image")
    return img


def assess_wound_screenshot(image_base64: str) -> dict[str, Any]:
    """
    Return clinical-style visual findings from one screenshot.
    Heuristic OpenCV signals only; not a diagnosis.
    """
    frame = _decode_data_url_to_bgr(image_base64)
    resized = cv2.resize(frame, (640, int(frame.shape[0] * (640 / frame.shape[1]))))

    hsv = cv2.cvtColor(resized, cv2.COLOR_BGR2HSV)
    gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)

    # Redness / erythema proxy.
    red1 = cv2.inRange(hsv, np.array([0, 50, 40]), np.array([12, 255, 255]))
    red2 = cv2.inRange(hsv, np.array([168, 50, 40]), np.array([180, 255, 255]))
    red_mask = cv2.bitwise_or(red1, red2)
    redness_pct = float(np.count_nonzero(red_mask) / red_mask.size * 100.0)

    # Brightness + texture proxies.
    brightness = float(np.mean(gray))
    lap_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    edges = cv2.Canny(gray, 80, 160)
    edge_density = float(np.count_nonzero(edges) / edges.size * 100.0)

    tags: list[str] = []
    notes: list[str] = []
    severity = "low"

    if redness_pct >= 20:
        tags.extend(["marked-redness", "possible-inflammation"])
        notes.append("high visible erythema")
        severity = "high"
    elif redness_pct >= 10:
        tags.extend(["moderate-redness"])
        notes.append("moderate visible erythema")
        severity = "moderate"
    elif redness_pct >= 4:
        tags.append("mild-redness")
        notes.append("mild visible erythema")

    if edge_density >= 11:
        tags.append("surface-irregularity")
        notes.append("high texture irregularity")
        if severity == "low":
            severity = "moderate"

    if lap_var < 40:
        tags.append("blurred-image")
        notes.append("image clarity limited")

    if brightness < 55:
        tags.append("low-light")
    elif brightness > 205:
        tags.append("overexposed")

    if not tags:
        tags = ["no-obvious-skin-abnormality"]
        notes = ["no prominent redness or irregularity detected"]

    summary = (
        f"visual assessment: {severity} concern; "
        f"redness {redness_pct:.1f}%; texture {edge_density:.1f}%; "
        + ", ".join(notes[:3])
    )

    keywords = [*tags, severity, "wound-image"]
    if redness_pct >= 10:
        keywords.extend(["erythema", "inflammation"])

    # De-duplicate while preserving order.
    dedup_keywords: list[str] = []
    seen = set()
    for k in keywords:
        kk = str(k).strip().lower()
        if not kk or kk in seen:
            continue
        seen.add(kk)
        dedup_keywords.append(kk)

    return {
        "summary": summary,
        "severity": severity,
        "keywords": dedup_keywords[:20],
        "metrics": {
            "redness_pct": round(redness_pct, 2),
            "brightness": round(brightness, 2),
            "edge_density_pct": round(edge_density, 2),
            "laplacian_variance": round(lap_var, 2),
        },
    }


async def vision_observations(frame_stream: AsyncIterator[bytes]) -> AsyncIterator[str]:
    """
    Reserved for future stream processing.
    """
    if False:
        yield ""  # pragma: no cover
