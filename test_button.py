import RPi.GPIO as GPIO
import time

BUTTON_PIN = 21
GPIO.setmode(GPIO.BCM)
GPIO.setup(BUTTON_PIN, GPIO.IN, pull_up_down=GPIO.PUD_UP)

print("Press the button — watching for input...")

try:
    while True:
        state = GPIO.input(BUTTON_PIN)
        print(f"Button state: {state}")
        time.sleep(0.2)
except KeyboardInterrupt:
    GPIO.cleanup()
