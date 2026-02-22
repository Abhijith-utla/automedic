"""
WebSocket endpoint for live transcription stream (mock).
"""

import asyncio
import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()

# Mock phrases to simulate incremental transcript
MOCK_PHRASES = [
    {"text": "Patient states ", "key_terms": []},
    {"text": "chest pain ", "key_terms": ["chest pain"]},
    {"text": "and heaviness ", "key_terms": []},
    {"text": "for about two hours. ", "key_terms": []},
    {"text": "No prior cardiac history. ", "key_terms": []},
    {"text": "Denies shortness of breath. ", "key_terms": ["shortness of breath"]},
]


@router.websocket("/ws/transcription")
async def websocket_transcription(websocket: WebSocket):
    """
    Live transcription stream (mock).
    Sends { "text": "...", "key_terms": ["..."] } chunks.
    Replace with real Whisper/Arduino pipeline later.
    """
    await websocket.accept()
    try:
        for phrase in MOCK_PHRASES:
            await websocket.send_json(phrase)
            await asyncio.sleep(0.8)
        # Keep connection open; frontend can send "ping" or "pause"
        while True:
            try:
                msg = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
                data = json.loads(msg) if msg else {}
                if data.get("pause"):
                    await asyncio.sleep(1)
                    continue
            except asyncio.TimeoutError:
                await websocket.send_json({"heartbeat": True})
    except WebSocketDisconnect:
        pass
