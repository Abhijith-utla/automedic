import speech_recognition as sr

recognizer = sr.Recognizer()
audio_file  = "bt_recording.wav"

print(f"Converting {audio_file} to text...")

with sr.AudioFile(audio_file) as source:
    # Adjust for background noise
    recognizer.adjust_for_ambient_noise(source, duration=0.5)
    audio = recognizer.record(source)

try:
    text = recognizer.recognize_google(audio)
    print(f"\nTranscribed text:\n{text}")

    with open("transcription.txt", "w") as f:
        f.write(text)
    print("\nSaved to transcription.txt")

except sr.UnknownValueError:
    print("Could not understand the audio — try speaking more clearly")
except sr.RequestError as e:
    print(f"API error: {e}")
