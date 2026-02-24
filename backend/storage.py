"""
storage.py
──────────
Simple JSON file-based persistence layer.

OS concepts demonstrated:
  - os.path for portable file-system paths
  - fcntl-style locking via threading.Lock (prevents race conditions)
  - Atomic file writes via os.replace() (rename-over-old-file trick)
  - os.makedirs for directory creation
"""

import os
import json
import threading
from typing import Dict, Any

# Data directory lives next to this file
_BASE_DIR    = os.path.dirname(os.path.abspath(__file__))
_DATA_DIR    = os.path.join(_BASE_DIR, "data")
_ALARMS_FILE = os.path.join(_DATA_DIR, "alarms.json")
_TASKS_FILE  = os.path.join(_DATA_DIR, "tasks.json")

# OS-level mutex: prevents concurrent write corruption
_lock = threading.Lock()

os.makedirs(_DATA_DIR, exist_ok=True)


def _read(path: str) -> Dict[str, Any]:
    if not os.path.exists(path):
        return {}
    with open(path, "r", encoding="utf-8") as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return {}


def _write(path: str, data: Dict[str, Any]) -> None:
    """Atomic write: write to a tmp file then rename (os.replace)."""
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    os.replace(tmp, path)   # Atomic on POSIX; near-atomic on Windows


# ── Alarm storage ──────────────────────────────────────────────────────────────

def load_alarms() -> list:
    with _lock:
        data = _read(_ALARMS_FILE)
        return list(data.get("alarms", []))


def save_alarms(alarms: list) -> None:
    with _lock:
        _write(_ALARMS_FILE, {"alarms": alarms})


# ── Task storage ───────────────────────────────────────────────────────────────

def load_tasks() -> list:
    with _lock:
        data = _read(_TASKS_FILE)
        return list(data.get("tasks", []))


def save_tasks(tasks: list) -> None:
    with _lock:
        _write(_TASKS_FILE, {"tasks": tasks})
