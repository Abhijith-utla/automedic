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
_active_encounter_id: str = ""
_active_encounter_id_lock = asyncio.Lock()


async def _set_active_encounter_id(encounter_id: str | None) -> None:
    if not encounter_id:
        return
    eid = str(encounter_id).strip()
    if not eid:
        return
    async with _active_encounter_id_lock:
        global _active_encounter_id
        _active_encounter_id = eid


async def get_active_encounter_id() -> str:
    async with _active_encounter_id_lock:
        return _active_encounter_id


async def get_pi_bridge_status() -> dict[str, Any]:
    async with _pi_ws_lock:
        connected = _pi_ws is not None
    active_eid = await get_active_encounter_id()
    return {
        "connected": connected,
        "active_encounter_id": active_eid or None,
        "ws_url": (settings.PI_WS_URL or "").strip() or None,
    }


async def send_pi_command(command: str, encounter_id: str | None = None) -> bool:
    """
    Send a plain-text command to Raspberry Pi websocket.
    Supports command strings such as: "start", "stop", "ping", "get_vitals".
    """
    cmd = (command or "").strip()
    if not cmd:
        return False
    await _set_active_encounter_id(encounter_id)
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
    configured_encounter_id = (settings.PI_WS_ENCOUNTER_ID or "").strip()
    if not ws_url:
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
                            active_eid = await get_active_encounter_id()
                            fallback_eid = active_eid or configured_encounter_id
                            payload["encounter_id"] = payload.get("encounter_id") or fallback_eid
                            await ingest_device_payload(payload, fallback_encounter_id=fallback_eid, default_source="pi_bridge")
                    except Exception as e:
                        log.warning("PI bridge payload parse failed: %s", e)
        except Exception as e:
            log.warning("PI bridge disconnected (%s). Reconnecting in 3s", e)
            async with _pi_ws_lock:
                _pi_ws = None
            await asyncio.sleep(3)
