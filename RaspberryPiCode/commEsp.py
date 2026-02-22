import time
import serial
import io
from PIL import Image
from IPython.display import display

ser = serial.Serial('/dev/serial0', 115200, timeout=10)

ser.write(bytes([1]))
ser.flush()
ser.reset_input_buffer()
print("has written!")

ser.reset_input_buffer()
ser.write(bytes([1]))
ser.flush()
print("has written!")

# scan for sync marker 0xAA 0xBB
while True:
    byte = ser.read(1)
    if byte == b'\xaa':
        next_byte = ser.read(1)
        if next_byte == b'\xbb':
            break  # found it, we're synced

width = int.from_bytes(ser.read(1), "little")
print(f"got width! {width}")
height = int.from_bytes(ser.read(1), "little")
print(f"got height! {height}")
imageBytes = ser.read(height * width)
img = Image.frombytes('L', (width, height), imageBytes)
img.save("img.png")
