import math
import wave
import struct
import os

SAMPLE_RATE = 44100

SOUND_PROFILES = {
    "classic_beep": {
        "waveform": "square",
        "freq": 880,
        "duration": 0.25,
    },
    "gentle_bell": {
        "waveform": "sine",
        "freq": 523,
        "duration": 0.6,
    },
    "alarm_siren": {
        "waveform": "sawtooth",
        "freq_start": 400,
        "freq_end": 800,
        "duration": 0.4,
    },
    "digital_pulse": {
        "waveform": "square",
        "freq": 1200,
        "duration": 0.08,
    },
    "deep_horn": {
        "waveform": "triangle",
        "freq": 220,
        "duration": 0.8,
    },
}

def generate_samples(profile, duration):
    n = int(SAMPLE_RATE * duration)
    samples = []
    waveform = profile.get("waveform", "sine")
    freq = profile.get("freq", 440)
    freq_end = profile.get("freq_end", freq)

    for i in range(n):
        t = i / SAMPLE_RATE
        f = freq + (freq_end - freq) * (i / n)
        phase = 2 * math.pi * f * t

        if waveform == "sine":
            val = math.sin(phase)
        elif waveform == "square":
            val = 1.0 if math.sin(phase) >= 0 else -1.0
        elif waveform == "sawtooth":
            val = 2 * ((f * t) % 1) - 1
        elif waveform == "triangle":
            val = 2 * abs(2 * ((f * t) % 1) - 1) - 1
        else:
            val = math.sin(phase)

        attack = min(i / (SAMPLE_RATE * 0.01), 1.0)
        release = min((n - i) / (SAMPLE_RATE * 0.05), 1.0)
        val *= attack * release

        samples.append(int(val * 32767 * 0.7))
    return struct.pack(f"<{n}h", *samples)

out_dir = "frontend/public/sounds"
os.makedirs(out_dir, exist_ok=True)

for name, profile in SOUND_PROFILES.items():
    pcm = generate_samples(profile, profile["duration"])
    path = os.path.join(out_dir, f"{name}.wav")
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SAMPLE_RATE)
        w.writeframes(pcm)
    print(f"Generated {path}")
