import smbus2
import time
import numpy as np
from scipy.signal import butter, filtfilt, find_peaks

bus = smbus2.SMBus(1)
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

def calculate_spo2(red_values, ir_values):
    red = np.array(red_values, dtype=float)
    ir  = np.array(ir_values, dtype=float)
    r = (np.std(red)/np.mean(red)) / (np.std(ir)/np.mean(ir))
    spo2 = 110 - 25 * r
    return round(min(max(spo2, 0), 100), 1)

setup_sensor()
print("Place your finger FIRMLY and STILL on the sensor...")
print("Collecting 15 seconds of data...\n")

ir_buffer  = []
red_buffer = []

for i in range(1500):
    red, ir = read_sample()
    ir_buffer.append(ir)
    red_buffer.append(red)
    time.sleep(0.01)

print("Analyzing...\n")

ir_array = np.array(ir_buffer, dtype=float)
filtered = bandpass_filter(ir_array, fs=100)

peaks, _ = find_peaks(
    filtered,
    distance=40,
    prominence=100
)

if len(peaks) < 2:
    print("Not enough peaks detected. Keep finger still and try again.")
else:
    rr_intervals = np.diff(peaks) * (1000 / 100)
    bpm   = 60000 / np.mean(rr_intervals)
    rmssd = np.sqrt(np.mean(np.diff(rr_intervals) ** 2))
    sdnn  = np.std(rr_intervals)
    spo2  = calculate_spo2(red_buffer, ir_buffer)

    print(f"Average Heart Rate : {bpm:.1f} BPM")
    print(f"SpO2 (Oxygen)      : {spo2}%")
    print(f"RMSSD (HRV)        : {rmssd:.1f} ms")
    print(f"SDNN  (HRV)        : {sdnn:.1f} ms")
    print(f"Beats detected     : {len(peaks)}")
