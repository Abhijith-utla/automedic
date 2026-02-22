# Sending data from Raspberry Pi via WebSocket

Yes. The backend accepts WebSocket connections from a Raspberry Pi (or any device) so you can stream audio, sensor data, or other payloads into the pipeline.

## Endpoint

- **URL:** `ws://<BACKEND_HOST>:8000/api/ws/device`
- **Example (same machine):** `ws://localhost:8000/api/ws/device`
- **Example (Pi → laptop):** `ws://192.168.1.100:8000/api/ws/device` (use your backend machine’s IP)

No auth is required for this endpoint by default. Add a query param or header check in code if you want to secure it.

## Message format

Send **JSON** messages. Suggested `type` values:

| `type`        | Use case        | Example body |
|---------------|-----------------|--------------|
| `audio_chunk` | Raw or base64 audio for STT | `{"type": "audio_chunk", "data": "<base64>", "sample_rate": 16000}` |
| `vitals`      | Heart rate, SpO2, etc.      | `{"type": "vitals", "heart_rate": 72, "spo2": 98}` |
| `sensor`      | Temperature, other sensors  | `{"type": "sensor", "temperature": 36.5}` |
| (custom)      | Any other payload           | `{"type": "custom", "key": "value"}` |

You can also send **binary** frames (e.g. raw PCM); the server will acknowledge them.

## Python example (on the Pi)

Install a WebSocket client:

```bash
pip install websockets
```

Then:

```python
import asyncio
import websockets
import json

async def stream_from_pi():
    uri = "ws://192.168.1.100:8000/api/ws/device"  # your backend IP
    async with websockets.connect(uri) as ws:
        # Wait for "connected" message
        msg = await ws.recv()
        print(msg)

        # Send JSON
        await ws.send(json.dumps({
            "type": "vitals",
            "heart_rate": 72,
            "spo2": 98
        }))
        print(await ws.recv())  # {"ok": true, "received_type": "vitals"}

        # Send another type
        await ws.send(json.dumps({
            "type": "audio_chunk",
            "data": "<base64_audio_or_metadata>",
            "sample_rate": 16000
        }))
        print(await ws.recv())

asyncio.run(stream_from_pi())
```

## Wiring into your pipeline

- **Device WebSocket** is in `backend/app/api/device_ws.py`. It accepts connections and stores the last 100 messages in a buffer.
- To **feed transcription**: have the backend read from this buffer (or from the live WebSocket) and push into your STT/Whisper pipeline, then send results to the existing `/api/ws/transcription` for the frontend.
- To **feed vitals into encounters**: when you start/end an encounter, you can read `get_last_device_messages()` from `device_ws` and attach that data to the encounter or diagnosis.

## Network notes

- Pi and backend must be on the same network (or backend reachable from Pi).
- If the backend runs on your laptop, use the laptop’s LAN IP (e.g. `192.168.x.x`) in the Pi’s `ws://...` URL.
- For production, use `wss://` and a proper hostname; you may need to allow the device WebSocket through your reverse proxy.
