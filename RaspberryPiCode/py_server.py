import asyncio
import websockets
import smbus2
import numpy as np
from scipy.signal import butter, filtfilt, find_peaks
import json
import base64
import time
import subprocess
import speech_recognition as sr

bus     = smbus2.SMBus(1)
address = 0x57

def setup_sensor():
    bus.write_byte_data(address, 0x09, 0x40)
    time.sleep(1)
    bus.write_byte_data(address, 0x09, 0x03)
    bus.write_byte_data(address, 0x0A, 0x27)
    bus.write_byte_data(address, 0x0C, 0x3F)
    bus.write_byte_data(address, 0x0D, 0x3F)

def read_sample():
    data = bus.read_i2c_block_data(address, 0x07, 6)
    red = (data[0] << 16 | data[1] << 8 | data[2]) & 0x3FFFF
    ir  = (data[3] << 16 | data[4] << 8 | data[5]) & 0x3FFFF
    return red, ir

def bandpass_filter(data, lowcut=0.5, highcut=4.0, fs=100):
    nyq = fs / 2
    b, a = butter(2, [lowcut/nyq, highcut/nyq], btype='band')
    return filtfilt(b, a, data)

def calculate_hrv(ir_buffer, red_buffer, fs=100):
    if len(ir_buffer) < 50:
        return None
    ir_arr   = np.array(ir_buffer, dtype=float)
    red_arr  = np.array(red_buffer, dtype=float)
    filtered = bandpass_filter(ir_arr, fs=fs)
    peaks, _ = find_peaks(filtered, distance=40, prominence=100)
    if len(peaks) < 2:
        return None
    rr_intervals = np.diff(peaks) * (1000 / fs)
    bpm   = round(60000 / np.mean(rr_intervals), 1)
    rmssd = round(np.sqrt(np.mean(np.diff(rr_intervals) ** 2)), 1)
    sdnn  = round(np.std(rr_intervals), 1)
    r     = (np.std(red_arr)/np.mean(red_arr)) / (np.std(ir_arr)/np.mean(ir_arr))
    spo2  = round(min(max(110 - 25 * r, 0), 100), 1)
    return {
        "bpm"  : bpm,
        "spo2" : spo2,
        "rmssd": rmssd,
        "sdnn" : sdnn
    }

async def handler(websocket):
    print("Backend connected — waiting for commands...")
    is_running   = False
    ir_buf       = []
    red_buf      = []
    ir_full      = []
    red_full     = []
    fs           = 100
    proc         = None
    audio_file_f = None
    collect_task = None

    SOURCE      = "bluez_input.AC:12:2F:70:12:65"
    OUTPUT_FILE = "recording.wav"

    def start_audio():
        nonlocal proc, audio_file_f
        audio_file_f = open("raw_audio.pcm", "wb")
        proc = subprocess.Popen([
            "parec",
            "--device", SOURCE,
            "--format=s16le",
            "--rate=48000",
            "--channels=1",
            "--latency-msec=1"
        ], stdout=audio_file_f)

    def stop_audio():
        nonlocal proc, audio_file_f
        if proc:
            proc.terminate()
            proc = None
        if audio_file_f:
            audio_file_f.close()
            audio_file_f = None

        subprocess.run([
            "ffmpeg", "-y",
            "-f", "s16le",
            "-ar", "48000",
            "-ac", "1",
            "-i", "raw_audio.pcm",
            OUTPUT_FILE
        ], capture_output=True)

    def transcribe():
        recognizer = sr.Recognizer()
        try:
            with sr.AudioFile(OUTPUT_FILE) as source:
                recognizer.adjust_for_ambient_noise(source, duration=0.5)
                audio = recognizer.record(source)
            return recognizer.recognize_google(audio)
        except sr.UnknownValueError:
            return "Could not understand audio"
        except Exception as e:
            return f"Error: {e}"

    async def collect_and_send():
        while is_running:
            red, ir = read_sample()
            ir_buf.append(ir)
            red_buf.append(red)

            if len(ir_buf) >= fs:
                hrv = calculate_hrv(ir_buf, red_buf)
                if hrv:
                    await websocket.send(json.dumps({
                        "type": "hrv",
                        "data": hrv
                    }))
                ir_buf.clear()
                red_buf.clear()

            await asyncio.sleep(0.01)

    try:
        async for message in websocket:
            command = message.strip()
            print(f"Received: {command}")

            if command == "start":
                is_running = True
                ir_buf     = []
                red_buf    = []
                start_audio()
                collect_task = asyncio.create_task(collect_and_send())
                await websocket.send(json.dumps({
                    "type"   : "status",
                    "message": "Recording started"
                }))

            elif command == "stop":
                is_running = False
                if collect_task:
                    collect_task.cancel()

                # Stop audio and transcribe
                stop_audio()
                print("Transcribing...")
                transcript = await asyncio.get_event_loop().run_in_executor(
                    None, transcribe
                )

                # Final HRV
                hrv = calculate_hrv(ir_buf, red_buf)

                await websocket.send(json.dumps({
                    "type"      : "final",
                    "hrv"       : hrv,
                    "transcript": transcript,
                    "timestamp" : time.strftime("%Y-%m-%d %H:%M:%S")
                }))

            elif command == "ping":
                await websocket.send(json.dumps({
                    "type"   : "status",
                    "message": "pong"
                }))

    except websockets.exceptions.ConnectionClosed:
        print("Backend disconnected")
        is_running = False
        stop_audio()
        if collect_task:
            collect_task.cancel()

    except websockets.exceptions.ConnectionClosed:
        print("Backend disconnected")
        is_running = False
        if collect_task:
            collect_task.cancel()

async def main():
    setup_sensor()
    print("Pi WebSocket server ready on ws://0.0.0.0:5000")
    print("Waiting for backend to connect...")
    async with websockets.serve(handler, "0.0.0.0", 5000):
        await asyncio.Future()

asyncio.run(main())
