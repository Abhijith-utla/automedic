"""
Vision API: screenshot assessment using OpenCV heuristics.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.api.auth import get_current_user_id
from app.services.vision import assess_wound_screenshot

router = APIRouter()


class VisionScreenshotRequest(BaseModel):
    image_base64: str


@router.post("/vision/screenshot-assess")
def screenshot_assess(
    body: VisionScreenshotRequest,
    _user_id: str = Depends(get_current_user_id),
):
    img = (body.image_base64 or "").strip()
    if not img:
        raise HTTPException(status_code=400, detail="image_base64 is required")
    try:
        result = assess_wound_screenshot(img)
        return {"ok": True, **result}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Vision assessment failed: {e}") from e
