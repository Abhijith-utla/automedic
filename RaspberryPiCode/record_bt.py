import subprocess
import time

OUTPUT_FILE = "bt_recording.wav"
DURATION    = 5  # seconds
SOURCE      = "bluez_input.41:42:FF:92:67:7E"

print(f"Recording for {DURATION} seconds... speak now!")

cmd = [
    "parec",
    "--device", SOURCE,
    "--format=s16le",
    "--rate=48000",
    "--channels=1",
    "--latency-msec=1"
]

with open("raw_audio.pcm", "wb") as f:
    proc = subprocess.Popen(cmd, stdout=f)
    time.sleep(DURATION)
    proc.terminate()

print("Converting to WAV...")

subprocess.run([
    "ffmpeg", "-y",
    "-f", "s16le",
    "-ar", "48000",
    "-ac", "1",
    "-i", "raw_audio.pcm",
    OUTPUT_FILE
])

print(f"Saved as {OUTPUT_FILE}")