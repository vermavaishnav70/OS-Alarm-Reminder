"""
sound_engine.py
───────────────
OS-level sound generation using:
  - numpy + sounddevice (primary)
  - subprocess calling aplay / afplay / powershell (fallback)
  - Pure Python wave module to build WAV in memory (last resort)

Demonstrates OS concepts:
  - subprocess spawning child processes for audio
  - os.name / platform detection
  - File descriptor manipulation for PCM pipes
"""

import os
import sys
import math
import wave
import json
import struct
import tempfile
import platform
import threading
import subprocess
from io import BytesIO
from pathlib import Path

# ── Try importing optional audio libraries ────────────────────────────────────
try:
    import numpy as np
    import sounddevice as sd
    _SOUNDDEVICE = True
except ImportError:
    _SOUNDDEVICE = False

try:
    import simpleaudio as sa
    _SIMPLEAUDIO = True
except ImportError:
    _SIMPLEAUDIO = False


# ── Sound profiles ─────────────────────────────────────────────────────────────
SOUND_PROFILES = {
    "Classic Beep": {
        "waveform": "square",
        "freq": 880,
        "duration": 0.25,
        "pause": 0.1,
        "description": "Sharp digital beep"
    },
    "Gentle Bell": {
        "waveform": "sine",
        "freq": 523,
        "duration": 0.6,
        "pause": 0.4,
        "description": "Soft sine bell"
    },
    "Alarm Siren": {
        "waveform": "sawtooth",
        "freq_start": 400,
        "freq_end": 800,
        "duration": 0.4,
        "pause": 0.05,
        "description": "Rising siren waveform"
    },
    "Digital Pulse": {
        "waveform": "square",
        "freq": 1200,
        "duration": 0.08,
        "pause": 0.05,
        "description": "Fast digital pulse"
    },
    "Deep Horn": {
        "waveform": "triangle",
        "freq": 220,
        "duration": 0.8,
        "pause": 0.2,
        "description": "Low triangle wave horn"
    },
}

SAMPLE_RATE = 44100

# ── Custom sound storage ───────────────────────────────────────────────────────

_HERE = Path(__file__).parent
BUILTIN_SOUNDS_DIR = _HERE / "sounds"                    # Admin audio files
CUSTOM_SOUNDS_DIR  = _HERE / "data" / "sounds"          # User-uploaded
CUSTOM_SOUNDS_FILE = _HERE / "data" / "custom_sounds.json"
BUILTIN_SOUNDS_DIR.mkdir(parents=True, exist_ok=True)
CUSTOM_SOUNDS_DIR.mkdir(parents=True, exist_ok=True)

_custom_sounds_lock = threading.Lock()


def _load_custom_sounds() -> dict:
    """Return {name: {"filename": str, "description": str}} from disk."""
    if not CUSTOM_SOUNDS_FILE.exists():
        return {}
    try:
        with open(CUSTOM_SOUNDS_FILE, "r") as f:
            return json.load(f)
    except Exception:
        return {}


def _save_custom_sounds(data: dict):
    with open(CUSTOM_SOUNDS_FILE, "w") as f:
        json.dump(data, f, indent=2)


def add_custom_sound(name: str, filename: str, description: str = "Custom sound") -> dict:
    """Register a custom sound (file must already be saved to CUSTOM_SOUNDS_DIR)."""
    with _custom_sounds_lock:
        db = _load_custom_sounds()
        db[name] = {"filename": filename, "description": description}
        _save_custom_sounds(db)
    return db[name]


def delete_custom_sound(name: str) -> bool:
    """Remove a custom sound entry and its file. Returns True if found."""
    with _custom_sounds_lock:
        db = _load_custom_sounds()
        if name not in db:
            return False
        entry = db.pop(name)
        _save_custom_sounds(db)
    file_path = CUSTOM_SOUNDS_DIR / entry["filename"]
    try:
        if file_path.exists():
            os.unlink(file_path)
    except OSError:
        pass
    return True


def _scan_builtin_audio_files() -> dict:
    """Scan backend/sounds/ for audio files and return {name: filepath}."""
    AUDIO_EXTS = {".wav", ".mp3", ".ogg", ".m4a", ".aac", ".flac"}
    files = {}
    if not BUILTIN_SOUNDS_DIR.exists():
        return files
    for f in BUILTIN_SOUNDS_DIR.iterdir():
        if f.suffix.lower() in AUDIO_EXTS:
            # Use filename without extension as sound name
            name = f.stem.replace("_", " ").title()
            files[name] = f
    return files


def get_all_sounds() -> list:
    """Return a combined list of built-in and custom sounds."""
    # 1. Synthesized built-ins
    sounds = [
        {"name": n, "description": cfg["description"], "custom": False}
        for n, cfg in SOUND_PROFILES.items()
    ]
    # 2. Built-in audio files (admin)
    builtin_audio = _scan_builtin_audio_files()
    sounds += [
        {"name": name, "description": f"Built-in: {path.name}", "custom": False}
        for name, path in builtin_audio.items()
    ]
    # 3. User-uploaded custom sounds
    custom = _load_custom_sounds()
    sounds += [
        {"name": n, "description": v["description"], "custom": True}
        for n, v in custom.items()
    ]
    return sounds


# ── Waveform generators ────────────────────────────────────────────────────────

def _generate_samples(profile: dict, duration: float) -> bytes:
    """Generate raw 16-bit PCM samples for a given sound profile."""
    n = int(SAMPLE_RATE * duration)
    samples = []

    waveform  = profile.get("waveform", "sine")
    freq      = profile.get("freq", 440)
    freq_end  = profile.get("freq_end", freq)   # for siren sweep

    for i in range(n):
        t = i / SAMPLE_RATE
        # Frequency sweep (linear interpolation)
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

        # Fade envelope: 10ms attack, 50ms decay tail
        attack  = min(i / (SAMPLE_RATE * 0.01), 1.0)
        release = min((n - i) / (SAMPLE_RATE * 0.05), 1.0)
        val *= attack * release

        samples.append(int(val * 32767 * 0.7))

    return struct.pack(f"<{n}h", *samples)


def _build_wav_bytes(profile: dict, duration: float) -> bytes:
    """Wrap raw PCM in a proper WAV container (in memory)."""
    pcm = _generate_samples(profile, duration)
    buf = BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)       # 16-bit
        w.setframerate(SAMPLE_RATE)
        w.writeframes(pcm)
    return buf.getvalue()


# ── Playback strategies ────────────────────────────────────────────────────────

def _play_via_sounddevice(profile: dict, duration: float):
    """Play using sounddevice (cross-platform, no subprocesses)."""
    pcm = _generate_samples(profile, duration)
    arr = np.frombuffer(pcm, dtype=np.int16).astype(np.float32) / 32767.0
    sd.play(arr, samplerate=SAMPLE_RATE)
    sd.wait()


def _play_via_simpleaudio(profile: dict, duration: float):
    """Play using simpleaudio (cross-platform)."""
    pcm = _generate_samples(profile, duration)
    play_obj = sa.play_buffer(pcm, 1, 2, SAMPLE_RATE)
    play_obj.wait_done()


def _play_via_subprocess(wav_bytes: bytes):
    """
    OS-level playback by spawning a child process.
    Uses aplay (Linux/ALSA), afplay (macOS), or PowerShell (Windows).
    Demonstrates: subprocess.Popen, os.pipe, child process management.
    """
    system = platform.system()

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        f.write(wav_bytes)
        tmp_path = f.name

    try:
        if system == "Linux":
            # ALSA userspace audio – spawns child process
            proc = subprocess.Popen(
                ["aplay", "-q", tmp_path],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )
        elif system == "Darwin":
            proc = subprocess.Popen(
                ["afplay", tmp_path],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )
        elif system == "Windows":
            proc = subprocess.Popen(
                ["powershell", "-c", f"(New-Object Media.SoundPlayer '{tmp_path}').PlaySync()"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )
        else:
            return

        proc.wait()
    finally:
        try:
            os.unlink(tmp_path)   # Clean up temp file (OS resource management)
        except OSError:
            pass


def _play_via_beep():
    """Last resort: ASCII bell character to terminal."""
    sys.stdout.write("\a")
    sys.stdout.flush()


def _play_file_via_subprocess(file_path: str):
    """
    Play an arbitrary audio file directly (wav/mp3/ogg/etc.) using a
    platform audio tool. Supports macOS afplay, Linux aplay/mpg123, Windows.
    """
    system = platform.system()
    if system == "Darwin":
        cmd = ["afplay", file_path]
    elif system == "Linux":
        # prefer ffplay (handles mp3/ogg), fall back to aplay (wav only)
        if subprocess.run(["which", "ffplay"], capture_output=True).returncode == 0:
            cmd = ["ffplay", "-nodisp", "-autoexit", "-loglevel", "quiet", file_path]
        elif subprocess.run(["which", "mpg123"], capture_output=True).returncode == 0:
            cmd = ["mpg123", "-q", file_path]
        else:
            cmd = ["aplay", "-q", file_path]
    elif system == "Windows":
        cmd = ["powershell", "-c", f"(New-Object Media.SoundPlayer '{file_path}').PlaySync()"]
    else:
        return
    proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    proc.wait()


def play_sound_once(sound_name: str):
    """Play one burst of the named sound using best available method."""
    # 1. Check for built-in audio file (admin)
    builtin_audio = _scan_builtin_audio_files()
    if sound_name in builtin_audio:
        try:
            _play_file_via_subprocess(str(builtin_audio[sound_name]))
            return
        except Exception:
            pass
    
    # 2. Check for user-uploaded custom sound
    custom_db = _load_custom_sounds()
    if sound_name in custom_db:
        file_path = CUSTOM_SOUNDS_DIR / custom_db[sound_name]["filename"]
        if file_path.exists():
            try:
                _play_file_via_subprocess(str(file_path))
                return
            except Exception:
                pass
        _play_via_beep()
        return

    profile = SOUND_PROFILES.get(sound_name, SOUND_PROFILES["Classic Beep"])
    duration = profile["duration"]

    if _SOUNDDEVICE:
        try:
            _play_via_sounddevice(profile, duration)
            return
        except Exception:
            pass

    if _SIMPLEAUDIO:
        try:
            _play_via_simpleaudio(profile, duration)
            return
        except Exception:
            pass

    try:
        wav_bytes = _build_wav_bytes(profile, duration)
        _play_via_subprocess(wav_bytes)
        return
    except Exception:
        pass

    _play_via_beep()


# ── Looping alarm player ───────────────────────────────────────────────────────

class AlarmPlayer:
    """
    Plays an alarm sound on a background thread until stopped.

    OS concepts:
      - Thread as lightweight process (threading.Thread)
      - threading.Event as a synchronisation primitive (like a semaphore)
      - Daemon thread: dies automatically when main process exits
    """

    def __init__(self, sound_name: str):
        self.sound_name  = sound_name
        self._stop_event = threading.Event()   # OS sync primitive
        self._thread     = threading.Thread(
            target=self._loop,
            daemon=True,                        # Daemon: OS reclaims on exit
            name=f"alarm-{sound_name}"
        )

    def start(self):
        self._thread.start()

    def stop(self):
        self._stop_event.set()   # Signal the thread to exit

    def _loop(self):
        profile = SOUND_PROFILES.get(self.sound_name, SOUND_PROFILES["Classic Beep"])
        pause   = profile["pause"]

        while not self._stop_event.is_set():
            play_sound_once(self.sound_name)
            # Wait for pause duration OR until stop is signalled
            self._stop_event.wait(timeout=pause)
