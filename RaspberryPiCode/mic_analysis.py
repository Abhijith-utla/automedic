import spidev
import numpy as np
from scipy import signal
import time

spi = spidev.SpiDev()
spi.open(0, 0)
spi.max_speed_hz = 3600000

def read_channel(channel):
    adc = spi.xfer2([1, (8 + channel) << 4, 0])
    return ((adc[1] & 3) << 8) + adc[2]

SAMPLE_RATE = 20000
DURATION    = 5
SAMPLES     = SAMPLE_RATE * DURATION

print("Collecting signal for analysis... make some noise!")
buffer = []

start = time.time()
while len(buffer) < SAMPLES:
    buffer.append(read_channel(0))
    elapsed = len(buffer) / SAMPLE_RATE
    sleep_time = elapsed - (time.time() - start)
    if sleep_time > 0:
        time.sleep(sleep_time)

spi.close()

data = np.array(buffer, dtype=float)

# Basic stats
print(f"\n--- Signal Statistics ---")
print(f"Min        : {data.min():.1f}")
print(f"Max        : {data.max():.1f}")
print(f"Mean       : {data.mean():.1f}")
print(f"Std Dev    : {data.std():.1f}")
print(f"Range      : {data.max() - data.min():.1f}")

# DC offset
dc_offset = data.mean()
centered  = data - dc_offset
print(f"\n--- DC Offset ---")
print(f"DC offset  : {dc_offset:.1f}")
print(f"After centering — Min: {centered.min():.1f}, Max: {centered.max():.1f}")

# Dominant frequency
freqs, psd = signal.periodogram(centered, fs=SAMPLE_RATE)
dominant_freq = freqs[np.argmax(psd)]
print(f"\n--- Frequency Analysis ---")
print(f"Dominant frequency : {dominant_freq:.1f} Hz")
print(f"Useful range       : 300–3400 Hz (human speech)")

# Signal to noise
speech_mask = (freqs >= 300) & (freqs <= 3400)
noise_mask  = (freqs < 300) | (freqs > 3400)
speech_power = psd[speech_mask].mean()
noise_power  = psd[noise_mask].mean()
snr = 10 * np.log10(speech_power / noise_power) if noise_power > 0 else 0
print(f"SNR (speech band)  : {snr:.1f} dB")
print(f"(Above 10dB is usable, above 20dB is good)")
