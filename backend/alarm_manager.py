"""
alarm_manager.py
────────────────
OS-level alarm management.

OS concepts demonstrated:
  - threading.Thread  — lightweight processes
  - threading.Lock    — mutual exclusion (mutex)
  - threading.Event   — semaphore-like synchronisation
  - signal.signal     — POSIX signal handling (SIGALRM on Unix)
  - time.sleep / busy-wait loop as scheduler
  - Daemon threads    — terminated automatically when parent exits
"""

import os
import time
import signal
import threading
import platform
from datetime import datetime
from typing import Dict, Optional, Callable

from models import Alarm
import storage

# Day-of-week mapping
_WEEKDAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


class AlarmManager:
    """
    Manages a set of alarms, each potentially backed by a background thread.

    Architecture:
      One persistent "tick" thread wakes every second to check whether any
      alarm should fire.  When an alarm fires, a dedicated AlarmPlayer thread
      is spawned for that alarm.  A threading.Lock guards shared state.
    """

    def __init__(self, on_ring: Optional[Callable[[str], None]] = None):
        """
        on_ring(alarm_id) is called (on the tick thread) when an alarm fires.
        The callback is responsible for notifying connected WebSocket clients.
        """
        self._alarms: Dict[str, Alarm] = {}
        self._players: Dict[str, AlarmPlayer] = {}
        self._lock    = threading.Lock()           
        self._running = threading.Event()          
        self._on_ring = on_ring

        
        self._load()

        
        self._tick_thread = threading.Thread(
            target=self._tick_loop,
            daemon=True,
            name="alarm-ticker"
        )

    def start(self):
        """Start the background scheduler thread."""
        self._running.set()
        self._tick_thread.start()

    def stop(self):
        """Signal the tick thread to stop gracefully."""
        self._running.clear()

    # ── CRUD ──────────────────────────────────────────────────────────────────

    def get_all(self) -> list[Alarm]:
        with self._lock:
            return list(self._alarms.values())

    def get(self, alarm_id: str) -> Optional[Alarm]:
        with self._lock:
            return self._alarms.get(alarm_id)

    def add(self, alarm: Alarm) -> Alarm:
        with self._lock:
            self._alarms[alarm.id] = alarm
        self._persist()
        return alarm

    def update(self, alarm_id: str, **kwargs) -> Optional[Alarm]:
        with self._lock:
            alarm = self._alarms.get(alarm_id)
            if not alarm:
                return None
            for k, v in kwargs.items():
                if v is not None and hasattr(alarm, k):
                    setattr(alarm, k, v)
        self._persist()
        return alarm

    def delete(self, alarm_id: str) -> bool:
        self._stop_player(alarm_id)
        with self._lock:
            if alarm_id not in self._alarms:
                return False
            del self._alarms[alarm_id]
        self._persist()
        return True

    def dismiss(self, alarm_id: str) -> Optional[Alarm]:
        """Stop the ringing alarm player and mark alarm as not ringing."""
        self._stop_player(alarm_id)
        return self.update(alarm_id, ringing=False)

    def sound_names(self) -> list[str]:
        from sound_engine import SOUND_PROFILES
        return list(SOUND_PROFILES.keys())

    # ── Internal ──────────────────────────────────────────────────────────────

    def _tick_loop(self):
        """
        Runs every second.  Checks whether any alarm should fire.

        OS analogy: this is the kernel timer interrupt handler — it wakes
        periodically and dispatches to the correct "process" (alarm).
        """
        while self._running.is_set():
            now = datetime.now()
            hh  = f"{now.hour:02d}"
            mm  = f"{now.minute:02d}"
            ss  = now.second
            day = _WEEKDAY_NAMES[now.weekday()]

            if ss == 0:
                with self._lock:
                    candidates = list(self._alarms.values())

                for alarm in candidates:
                    if not alarm.active or alarm.ringing:
                        continue
                    if alarm.time != f"{hh}:{mm}":
                        continue
                    # Repeat check
                    if alarm.repeat and day not in alarm.repeat:
                        continue

                    # Fire!
                    self._fire(alarm)

            # Sleep 1 second (yield CPU — cooperative scheduling)
            time.sleep(1)

    def _fire(self, alarm: Alarm):
        """Mark alarm as ringing and notify the frontend."""
        with self._lock:
            alarm.ringing = True

        # Notify connected clients (e.g. WebSocket broadcast)
        if self._on_ring:
            try:
                # The frontend will handle playing the sound locally
                self._on_ring(alarm.id)
            except Exception:
                pass

        self._persist()

    def _stop_player(self, alarm_id: str):
        # We no longer manage background audio threads on the backend.
        pass

    def _load(self):
        rows = storage.load_alarms()
        with self._lock:
            for row in rows:
                try:
                    a = Alarm(**row)
                    a.ringing = False   # Never persist ringing state
                    self._alarms[a.id] = a
                except Exception:
                    pass

    def _persist(self):
        with self._lock:
            data = [a.model_dump() for a in self._alarms.values()]
        storage.save_alarms(data)


# ── POSIX SIGALRM integration (Unix only) ─────────────────────────────────────
# On Unix systems, we can also use the kernel's hardware timer via SIGALRM.
# This is a separate, lightweight mechanism for one-shot alarms.

_sigalrm_callback: Optional[Callable] = None

if platform.system() in ("Linux", "Darwin"):
    def _sigalrm_handler(signum, frame):
        if _sigalrm_callback:
            _sigalrm_callback()

    signal.signal(signal.SIGALRM, _sigalrm_handler)


def set_posix_timer(seconds: int, callback: Callable):
    """
    Use the OS SIGALRM kernel timer (Unix only).
    After `seconds` seconds, the kernel sends SIGALRM to this process.
    """
    global _sigalrm_callback
    if platform.system() not in ("Linux", "Darwin"):
        return False
    _sigalrm_callback = callback
    signal.alarm(seconds)
    return True


def cancel_posix_timer():
    if platform.system() in ("Linux", "Darwin"):
        signal.alarm(0)
