"""
sound_engine.py
───────────────
Provides sound profiles and metadata for the frontend to play using the HTML5 Audio API.
Allows users to upload their own sounds.
"""

import os
import json
import threading
from pathlib import Path

# ── Sound profiles ─────────────────────────────────────────────────────────────
SOUND_PROFILES = {
    "Classic Beep": {
        "description": "Sharp digital beep (Played on frontend)"
    },
    "Gentle Bell": {
        "description": "Soft sine bell (Played on frontend)"
    },
    "Alarm Siren": {
        "description": "Rising siren waveform (Played on frontend)"
    },
    "Digital Pulse": {
        "description": "Fast digital pulse (Played on frontend)"
    },
    "Deep Horn": {
        "description": "Low triangle wave horn (Played on frontend)"
    },
}


# ── Custom sound storage ───────────────────────────────────────────────────────

_HERE = Path(__file__).parent
CUSTOM_SOUNDS_DIR  = _HERE / "data" / "sounds"          # User-uploaded
CUSTOM_SOUNDS_FILE = _HERE / "data" / "custom_sounds.json"
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

def get_all_sounds() -> list:
    """Return a combined list of built-in and custom sounds."""
    # 1. Built-in sounds served via frontend public dir
    sounds = [
        {"name": n, "description": cfg["description"], "custom": False}
        for n, cfg in SOUND_PROFILES.items()
    ]
    # 2. User-uploaded custom sounds
    custom = _load_custom_sounds()
    sounds += [
        {"name": n, "description": v["description"], "custom": True}
        for n, v in custom.items()
    ]
    return sounds

