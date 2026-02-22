import time
import serial
from PIL import Image
import numpy as np
from IPython.display import display

ser = serial.Serial('/dev/serial0', 115200)  # change COM port
imgName = "frame"

width = 0
height = 0

ser.write(bytes([1]))

print("has written!")

width = ser.read(1)
width = int.from_bytes(width, "little")

print("got width!")

height = ser.read(1)

height = int.from_bytes(height, "little")

print("got height!")

imageBytes = ser.read(height * width * 3)

print("Got the image!")

img = Image.frombytes("RGB", (width, height), imageBytes)
display(img)

img.save("img.png")
