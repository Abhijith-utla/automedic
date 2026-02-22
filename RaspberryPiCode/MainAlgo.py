import subprocess
import smbus2
import time
import numpy as np
from scipy.signal import butter, filtfilt, find_peaks
import speech_recognition as sr
import base64
import json

recognizer = sr.Recognizer()
audio_file = "recording.wav"

bus = smbus2.SMBus(1)
address = 0x57

OUPUT_FILE = "recording.wav"
SOURCE = "bluez_input.AC:12:2F:70:12:65"

cmd = [
        "parec",
        "--device", SOURCE,
        "--format=s16le",
        "--rate=48000",
        "--channels=1",
        "--latency-msec=1"
]

import smbus2
import numpy as np
from scipy.signal import butter, filtfilt, find_peaks, welch
from scipy.interpolate import interp1d
import json
import time

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

def imgToBase64(img):
    return base64.b64encode(img.tobytes()).decode("utf-8")

setup_sensor()

ir_buffer  = []
red_buffer = []
fs         = 100

print("Setup complete!")

imgs = []

def makeImageToBase

def SendData(socket, heartRate, o2):
    with sr.AudioFile(audio_file) as source:
        recognizer.adjust_for_ambient_noise(source, duration = 0.5)
        audio = recognizer.record(source)

    try:
        text = recognizer.recognize_google(audio)
    except sr.UnknownValueError:
        print("uh oh")
    except sr.RequestError as e:
        print(f"API error: {e}")

    stringifiedImages = [imgToBase64(img) for img in imgs]

    jsonPayload = {
            "text": text,
            "heart_rate": heartRate,
            "oxy": o2,
            "images": stringifiedImages
            "image_shapes": [img.shape for img in imgs]

    }

    strLoad = json.dumps(payload)

    socket.send(strLoad.encode('utf-8')

def MainFunction(socket):
    imgTimer = datetime.now().microsecond // 1000
    sensorTime = datetime.now().microsecond // 1000

    imgCaptureRate = 5000
    sensorCaptureRate = 100

    with open("raw_audio.pcm", "wb") as f:
        proc = subprocess.Popen(cmd, stdout = f)

    while True:
        try:
            data = cocket.recv(100)
            data = data.decode()
            print(data)
            if(data == "finish"):
                proc.terminate()

                subprocess.run([
                    "ffmpg", "-y",
                    "-f", "s16le",
                    "-ar", "48000",
                    "-ac", "1",
                    "-i", "-raw_audio.pcm",
                    OUTPUT_FILE
                ])

                ir_arr = np.array(ir_buffer, dtype = float)
                red_arr = np.array(red_buffer, dtype = float)
                filtered = bandpass_filter(ir_array, fs = fs)
                peaks, _ = find_peaks(filtered, distance = 40, prominence = 100)
                rr_intervals = np.diff(peaks) * (1000 / fs)

                bpm = round(60000, / np.mean(rr_intervals), 1)
                r = (np.std(red_array) / np.mean(red_array)) / (np.std(ir_array) / np.mean(ir_array))
                spo2 = round(min(max(110 - 25 * r, 0), 100), 1)

                SendData(socket, bpm, spo2)
                break
        except BlockingIOError:
            nowImgTimer = datetime.now().microsecond // 1000
            nowSensorTimer = datetime.now().microsecond // 1000
            if(nowSensorTimer - sensorTime > sensorCaptureRate):
                red, ir = read_sample()
                ir_buffer.append(ir)
                red_buffer.append(red)
            if(nowImgTimer - imgTimer > imgCapture):
                imgs.append(GetImage())
