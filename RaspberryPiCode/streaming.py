import os
import queue
import json
import sounddevice as sd
from vosk import Model, KaldiRecognizer
import argostranslate.package
import argostranslate.translate

# --- SETTINGS ---
# Use 'pactl list sources short' to find the exact name if this fails
SOURCE_NAME = "bluez_input.41:42:FF:92:67:7E" 
MODEL_PATH = "model"  # Path to your unzipped Vosk model
SAMPLE_RATE = 16000   # Vosk works best at 16k
q = queue.Queue()

# --- OFFLINE TRANSLATION SETUP ---
def install_translator(from_code, to_code):
    argostranslate.package.update_package_index()
    available_packages = argostranslate.package.get_available_packages()
    package_to_install = next(
        filter(lambda x: x.from_code == from_code and x.to_code == to_code, available_packages)
    )
    argostranslate.package.install_from_path(package_to_install.download())

# Example: If your model is Spanish, install Spanish -> English
# install_translator("es", "en") 

# --- STREAMING LOGIC ---
def audio_callback(indata, frames, time, status):
    """Callback to feed audio chunks into the queue"""
    q.put(bytes(indata))

# Initialize Vosk
if not os.path.exists(MODEL_PATH):
    print("Please download a model from alphacephei.com/vosk/models")
    exit(1)

model = Model(MODEL_PATH)
rec = KaldiRecognizer(model, SAMPLE_RATE)

print(f"Starting real-time stream from {SOURCE_NAME}...")

try:
    # Open the Bluetooth stream directly
    with sd.RawInputStream(samplerate=SAMPLE_RATE, blocksize=8000, device=SOURCE_NAME,
                            dtype='int16', channels=1, callback=audio_callback):
        
        while True:
            data = q.get()
            if rec.AcceptWaveform(data):
                # result is a JSON string
                result_dict = json.loads(rec.Result())
                original_text = result_dict.get("text", "")
                
                if original_text:
                    # Translate to English (Change 'es' to your model's language)
                    translated = argostranslate.translate.translate(original_text, "es", "en")
                    print(f"\n[Original]: {original_text}")
                    print(f"[English]: {translated}\n")
            else:
                # Partial results for live feedback
                partial = json.loads(rec.PartialResult())
                if partial.get("partial"):
                    print(f"Live: {partial['partial']}", end="\r")

except KeyboardInterrupt:
    print("\nStopping...")
