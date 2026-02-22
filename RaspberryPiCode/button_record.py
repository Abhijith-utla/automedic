import RPi.GPIO as GPIO
import subprocess
import speech_recognition as sr
import time
import os

BUTTON_PIN = 21
SOURCE     = "bluez_input.41:42:FF:92:67:7E"

GPIO.setmode(GPIO.BCM)
GPIO.setup(BUTTON_PIN, GPIO.IN, pull_up_down=GPIO.PUD_UP)

recording_proc = None
is_recording   = False

def start_recording():
    global recording_proc
    print("Recording started... press button to stop.")
    f = open("raw_audio.pcm", "wb")
    recording_proc = subprocess.Popen([
        "parec",
        "--device", SOURCE,
        "--format=s16le",
        "--rate=48000",
        "--channels=1",
        "--latency-msec=1"
    ], stdout=f)

def stop_recording():
    global recording_proc
    print("Recording stopped. Transcribing...")
    recording_proc.terminate()
    recording_proc = None

    subprocess.run([
        "ffmpeg", "-y",
        "-f", "s16le",
        "-ar", "48000",
        "-ac", "1",
        "-i", "raw_audio.pcm",
        "bt_recording.wav"
    ], capture_output=True)

    transcribe()

def transcribe():
    recognizer = sr.Recognizer()
    with sr.AudioFile("bt_recording.wav") as source:
        recognizer.adjust_for_ambient_noise(source, duration=0.5)
        audio = recognizer.record(source)
    try:
        text = recognizer.recognize_google(audio)
        print(f"\nTranscription:\n{text}")
        with open("transcription.txt", "w") as f:
            f.write(text)
        print("Saved to transcription.txt")
    except sr.UnknownValueError:
        print("Could not understand audio")
    except sr.RequestError as e:
        print(f"API error: {e}")

print("Ready — press button to start recording.")

def handle_button():
    global is_recording
    if not is_recording:
        is_recording = True
        start_recording()
    else:
        is_recording = False
        stop_recording()

try:
    while True:
        if GPIO.input(BUTTON_PIN) == GPIO.LOW:
            time.sleep(0.05)  # debounce
            if GPIO.input(BUTTON_PIN) == GPIO.LOW:
                handle_button()
                while GPIO.input(BUTTON_PIN) == GPIO.LOW:
                    time.sleep(0.05)
        time.sleep(0.1)

except KeyboardInterrupt:
    print("\nExiting.")
    if recording_proc:
        recording_proc.terminate()
    GPIO.cleanup()
