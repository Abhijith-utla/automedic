import asyncio
import json
import logging
from typing import Any

import websockets

from app.api.device_ws import ingest_device_payload
from app.config import settings

log = logging.getLogger(__name__)
_pi_ws: Any | None = None
_pi_ws_lock = asyncio.Lock()


async def send_pi_command(command: str) -> bool:
    """
    Send a plain-text command to Raspberry Pi websocket.
    Expected commands: "start", "stop", "ping".
    """
    cmd = (command or "").strip().lower()
    if cmd not in {"start", "stop", "ping"}:
        return False
    async with _pi_ws_lock:
        if _pi_ws is None:
            return False
        try:
            await _pi_ws.send(cmd)
            return True
        except Exception:
            return False


async def run_pi_bridge() -> None:
    """
    Connect to Raspberry Pi websocket and forward payloads into device pipeline.
    Uses:
      PI_WS_URL
      PI_WS_ENCOUNTER_ID
      PI_WS_AUTO_START
    """
    ws_url = (settings.PI_WS_URL or "").strip()
    encounter_id = (settings.PI_WS_ENCOUNTER_ID or "").strip()
    if not ws_url or not encounter_id:
        return

    while True:
        try:
            async with websockets.connect(ws_url, ping_interval=20, ping_timeout=20) as ws:
                global _pi_ws
                async with _pi_ws_lock:
                    _pi_ws = ws
                log.info("PI bridge connected: %s", ws_url)
                if settings.PI_WS_AUTO_START:
                    await ws.send("start")
                async for raw in ws:
                    try:
                        payload = json.loads(raw)
                        if isinstance(payload, dict):
                            payload["encounter_id"] = payload.get("encounter_id") or encounter_id
                            await ingest_device_payload(payload, fallback_encounter_id=encounter_id, default_source="pi_bridge")
                    except Exception as e:
                        log.warning("PI bridge payload parse failed: %s", e)
        except Exception as e:
            log.warning("PI bridge disconnected (%s). Reconnecting in 3s", e)
            async with _pi_ws_lock:
                _pi_ws = None
            await asyncio.sleep(3)
