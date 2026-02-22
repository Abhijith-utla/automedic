"""
WebSocket endpoint for device (e.g. Raspberry Pi) data stream.

Connect from the Pi and send JSON or binary data. The backend can forward
this to transcription, vision, or store for the encounter pipeline.

Example from Raspberry Pi (Python):
  import asyncio
  import websockets
  import json

  async def send_data():
      uri = "ws://<BACKEND_IP>:8000/api/ws/device"
      async with websockets.connect(uri) as ws:
          await ws.send(json.dumps({"type": "audio_chunk", "data": "<base64 or raw>"}))
          # or sensor data: {"type": "vitals", "hr": 72, "spo2": 98}

  asyncio.run(send_data())
"""

import json
from collections import defaultdict
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from app.api.auth import get_current_user_id

router = APIRouter()

# In-memory buffers keyed by encounter id.
_device_buffer: dict[str, list[dict[str, Any]]] = defaultdict(list)
_latest_vitals: dict[str, dict[str, Any]] = {}
_monitor_clients: dict[str, set[WebSocket]] = defaultdict(set)
BUFFER_MAX = 100


def _enc_id(msg: dict[str, Any], fallback: str | None = None) -> str:
    raw = msg.get("encounter_id") or fallback
    return str(raw).strip() if raw else ""


def _normalize_vitals_payload(msg: dict[str, Any]) -> dict[str, Any]:
    """
    Normalize incoming device message into a stable vitals shape.
    Supports keys from Raspberry Pi payloads:
      heart_rate/hr/bpm, spo2/oxy, hrv, rr_intervals_ms, sdnn, rmssd, pnn50, text, images...
    """
    heart_rate = msg.get("heart_rate", msg.get("hr", msg.get("bpm")))
    spo2 = msg.get("spo2", msg.get("oxy", msg.get("oxygen_sat")))
    hrv = msg.get("hrv")
    rr_intervals_ms = msg.get("rr_intervals_ms")
    sdnn = msg.get("sdnn")
    rmssd = msg.get("rmssd")
    pnn50 = msg.get("pnn50")
    return {
        "type": "vitals",
        "encounter_id": msg.get("encounter_id"),
        "source": msg.get("source", "hrv_sensor"),
        "heart_rate": heart_rate,
        "spo2": spo2,
        "hrv": hrv,
        "rr_intervals_ms": rr_intervals_ms,
        "sdnn": sdnn,
        "rmssd": rmssd,
        "pnn50": pnn50,
        "text": msg.get("text"),
        "images_count": len(msg.get("images") or []) if isinstance(msg.get("images"), list) else 0,
        "ts": msg.get("ts"),
    }


def _normalize_pi_hrv_payload(msg: dict[str, Any]) -> dict[str, Any]:
    data = msg.get("data") if isinstance(msg.get("data"), dict) else {}
    return {
        "type": "vitals",
        "encounter_id": msg.get("encounter_id"),
        "source": msg.get("source", "pi"),
        "heart_rate": data.get("bpm"),
        "spo2": data.get("spo2"),
        "hrv": data.get("hrv"),
        "rmssd": data.get("rmssd"),
        "sdnn": data.get("sdnn"),
        "pnn50": data.get("pnn50"),
        "ts": msg.get("timestamp") or msg.get("ts"),
    }


def _push_device_message(encounter_id: str, msg: dict[str, Any]) -> None:
    if not encounter_id:
        return
    _device_buffer[encounter_id].append(msg)
    _device_buffer[encounter_id] = _device_buffer[encounter_id][-BUFFER_MAX:]
    if msg.get("type") == "vitals":
        _latest_vitals[encounter_id] = msg


async def _broadcast_to_monitors(encounter_id: str, msg: dict[str, Any]) -> None:
    if not encounter_id:
        return
    clients = list(_monitor_clients.get(encounter_id, set()))
    stale: list[WebSocket] = []
    for ws in clients:
        try:
            await ws.send_json(msg)
        except Exception:
            stale.append(ws)
    for ws in stale:
        _monitor_clients[encounter_id].discard(ws)


async def ingest_device_payload(
    data: dict[str, Any],
    fallback_encounter_id: str | None = None,
    default_source: str = "hrv_sensor",
) -> dict[str, Any]:
    eid = _enc_id(data, fallback=fallback_encounter_id)
    if not eid:
        return {"ok": False, "error": "encounter_id is required"}

    msg_type = str(data.get("type") or "").strip().lower()
    if msg_type == "hrv":
        normalized = _normalize_pi_hrv_payload({**data, "encounter_id": eid, "source": data.get("source", default_source)})
        _push_device_message(eid, normalized)
        await _broadcast_to_monitors(eid, normalized)
        return {"ok": True, "received_type": "vitals", "encounter_id": eid}

    if msg_type == "hrv_complete":
        final_hrv = data.get("hrv") if isinstance(data.get("hrv"), dict) else {}
        normalized = _normalize_vitals_payload({
            "type": "vitals",
            "encounter_id": eid,
            "source": data.get("source", default_source),
            "heart_rate": final_hrv.get("bpm"),
            "spo2": final_hrv.get("spo2"),
            "rmssd": final_hrv.get("rmssd"),
            "sdnn": final_hrv.get("sdnn"),
            "hrv": final_hrv.get("hrv"),
            "ts": data.get("timestamp"),
        })
        _push_device_message(eid, normalized)
        await _broadcast_to_monitors(eid, {"type": "hrv_complete", "encounter_id": eid, "hrv": final_hrv, "timestamp": data.get("timestamp")})
        await _broadcast_to_monitors(eid, normalized)
        return {"ok": True, "received_type": "hrv_complete", "encounter_id": eid}

    if msg_type == "final":
        final_msg = {
            "type": "final",
            "encounter_id": eid,
            "source": data.get("source", default_source),
            "transcript": data.get("transcript"),
            "timestamp": data.get("timestamp"),
        }
        _push_device_message(eid, final_msg)
        await _broadcast_to_monitors(eid, final_msg)
        return {"ok": True, "received_type": "final", "encounter_id": eid}

    if msg_type == "vitals" or any(k in data for k in ("heart_rate", "hr", "bpm", "spo2", "oxy", "hrv")):
        normalized = _normalize_vitals_payload({**data, "encounter_id": eid, "source": data.get("source", default_source)})
        _push_device_message(eid, normalized)
        await _broadcast_to_monitors(eid, normalized)
        return {"ok": True, "received_type": "vitals", "encounter_id": eid}

    data["encounter_id"] = eid
    data["source"] = data.get("source", default_source)
    _push_device_message(eid, data)
    await _broadcast_to_monitors(eid, data)
    return {"ok": True, "received_type": data.get("type"), "encounter_id": eid}


@router.websocket("/ws/device")
async def websocket_device(websocket: WebSocket):
    """
    Accept WebSocket connections from Raspberry Pi (or any device).
    Expects JSON messages, e.g.:
      {"type": "audio_chunk", "data": "<base64>"}
      {"type": "vitals", "heart_rate": 72, "spo2": 98}
      {"type": "sensor", "temperature": 36.5}
    You can then wire this into STT, vision, or encounter logic.
    """
    encounter_id = (websocket.query_params.get("encounter_id") or "").strip()
    default_source = (websocket.query_params.get("source") or "hrv_sensor").strip()
    await websocket.accept()
    try:
        await websocket.send_json({
            "status": "connected",
            "message": "Device stream ready",
            "encounter_id": encounter_id or None,
        })
        while True:
            try:
                raw = await websocket.receive()
                if "text" in raw:
                    data = json.loads(raw["text"])
                    ack = await ingest_device_payload(data, fallback_encounter_id=encounter_id, default_source=default_source)
                    await websocket.send_json(ack)
                elif "bytes" in raw:
                    eid = encounter_id
                    if not eid:
                        await websocket.send_json({"ok": False, "error": "encounter_id is required for binary payload"})
                        continue
                    msg = {"type": "binary", "encounter_id": eid, "source": default_source, "size": len(raw["bytes"])}
                    _push_device_message(eid, msg)
                    await _broadcast_to_monitors(eid, msg)
                    await websocket.send_json({"ok": True, "received_type": "binary", "encounter_id": eid})
            except json.JSONDecodeError:
                await websocket.send_json({"ok": False, "error": "Invalid JSON"})
    except WebSocketDisconnect:
        pass


@router.websocket("/ws/device/monitor")
async def websocket_device_monitor(websocket: WebSocket):
    """
    Clinician/Frontend monitor socket.
    Query params:
      - encounter_id: required
    Receives live device events for that encounter (especially normalized vitals).
    """
    encounter_id = (websocket.query_params.get("encounter_id") or "").strip()
    await websocket.accept()
    if not encounter_id:
        await websocket.send_json({"ok": False, "error": "encounter_id is required"})
        await websocket.close()
        return
    _monitor_clients[encounter_id].add(websocket)
    try:
        await websocket.send_json({
            "status": "connected",
            "message": "Device monitor ready",
            "encounter_id": encounter_id,
            "latest_vitals": _latest_vitals.get(encounter_id),
        })
        while True:
            # Keep connection alive; monitor channel is server-push first.
            _ = await websocket.receive_text()
    except WebSocketDisconnect:
        _monitor_clients[encounter_id].discard(websocket)


def get_last_device_messages(encounter_id: str, limit: int = 10) -> list[dict[str, Any]]:
    """Return last device messages for a specific encounter (for pipeline or API)."""
    return (_device_buffer.get(encounter_id) or [])[-limit:]


def get_latest_vitals(encounter_id: str) -> dict[str, Any] | None:
    """Return the latest normalized vitals payload for an encounter."""
    return _latest_vitals.get(encounter_id)


class DeviceCommandRequest(BaseModel):
    command: str


@router.post("/device/command")
async def send_device_command(
    body: DeviceCommandRequest,
    _user_id: str = Depends(get_current_user_id),
):
    """
    Send control command to Raspberry Pi bridge.
    Commands supported: start, stop, ping.
    """
    from app.services.pi_bridge import send_pi_command

    ok = await send_pi_command(body.command)
    if not ok:
        raise HTTPException(status_code=503, detail="Raspberry Pi bridge is not connected")
    return {"ok": True, "command": body.command.strip().lower()}
