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

setup_sensor()
print("Place finger firmly on sensor. Collecting 30 seconds...")

ir_buffer  = []
red_buffer = []
fs         = 100

for _ in range(fs * 30):
    red, ir = read_sample()
    ir_buffer.append(ir)
    red_buffer.append(red)
    time.sleep(1/fs)

print("Analyzing...")

ir_array  = np.array(ir_buffer, dtype=float)
red_array = np.array(red_buffer, dtype=float)
filtered  = bandpass_filter(ir_array, fs=fs)
peaks, _  = find_peaks(filtered, distance=40, prominence=100)

if len(peaks) < 2:
    print("Not enough peaks detected. Keep finger still and try again.")
else:
    rr_intervals = np.diff(peaks) * (1000 / fs)

    # 1. Heart Rate + SpO2
    bpm  = round(60000 / np.mean(rr_intervals), 1)
    r    = (np.std(red_array)/np.mean(red_array)) / (np.std(ir_array)/np.mean(ir_array))
    spo2 = round(min(max(110 - 25 * r, 0), 100), 1)

    # 2. RMSSD
    rmssd = round(np.sqrt(np.mean(np.diff(rr_intervals) ** 2)), 1)

    # 3. LF/HF Ratio
    try:
        fs_rr    = 4
        t_rr     = np.cumsum(rr_intervals) / 1000
        t_interp = np.arange(t_rr[0], t_rr[-1], 1/fs_rr)
        f_interp = interp1d(t_rr, rr_intervals, kind='linear')
        rr_interp = f_interp(t_interp)
        freqs, psd = welch(rr_interp, fs=fs_rr, nperseg=min(len(rr_interp), 64))
        lf    = np.trapz(psd[(freqs >= 0.04) & (freqs < 0.15)])
        hf    = np.trapz(psd[(freqs >= 0.15) & (freqs < 0.4)])
        lf_hf = round(lf / hf, 2) if hf > 0 else None
    except Exception:
        lf_hf = None

    # 4. SDNN
    sdnn = round(np.std(rr_intervals), 1)

    # 5. Respiratory Rate
    try:
        nyq  = fs / 2
        b, a = butter(2, [0.1/nyq, 0.5/nyq], btype='band')
        resp = filtfilt(b, a, ir_array)
        resp_peaks, _ = find_peaks(resp, distance=fs * 1.5)
        resp_rate = round(60 / np.mean(np.diff(resp_peaks) / fs), 1) if len(resp_peaks) >= 2 else None
    except Exception:
        resp_rate = None

    # Clinical flags
    flags = []
    if bpm > 100:        flags.append("Tachycardia")
    if bpm < 50:         flags.append("Bradycardia")
    if spo2 < 95:        flags.append("Low SpO2 - hypoxemia concern")
    if spo2 < 90:        flags.append("CRITICAL: SpO2 below 90%")
    if rmssd < 20:       flags.append("Very low HRV - cardiovascular risk")
    if sdnn < 50:        flags.append("Low SDNN - cardiac risk marker")
    if lf_hf and lf_hf > 2.5: flags.append("High stress - sympathetic dominance")
    if resp_rate and resp_rate > 20: flags.append("High respiratory rate")
    if resp_rate and resp_rate < 12: flags.append("Low respiratory rate")

    output = {
        "heart_rate_bpm"     : bpm,
        "spo2_percent"       : spo2,
        "rmssd_ms"           : rmssd,
        "lf_hf_ratio"        : lf_hf,
        "sdnn_ms"            : sdnn,
        "respiratory_rate"   : resp_rate,
        "clinical_flags"     : flags,
        "timestamp"          : time.strftime("%Y-%m-%d %H:%M:%S")
    }

    print(json.dumps(output, indent=2))

    with open("diagnostic_data.json", "w") as f:
        json.dump(output, f, indent=2)

    print("\nSaved to diagnostic_data.json")