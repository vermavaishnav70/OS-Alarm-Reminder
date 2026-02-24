"""
task_manager.py
───────────────
Task & reminder management.

OS concepts demonstrated:
  - threading.Thread for background reminder monitoring
  - threading.Lock for shared state protection
  - os.getpid() — identify the process owning reminders
  - subprocess to trigger desktop notifications (OS-level IPC)
  - platform detection for cross-OS notification dispatch
"""

import os
import time
import platform
import threading
import subprocess
from datetime import datetime, timedelta
from typing import Optional, Callable, Dict

from models import Task
import storage


class TaskManager:
    """
    Stores tasks and monitors them on a background thread.
    Fires reminder notifications via OS desktop notification APIs.
    """

    def __init__(self, on_reminder: Optional[Callable[[str], None]] = None):
        """
        on_reminder(task_id) called when a reminder is due.
        """
        self._tasks: Dict[str, Task] = {}
        self._lock  = threading.Lock()
        self._running = threading.Event()
        self._on_reminder = on_reminder
        self._pid = os.getpid()   # OS process ID — useful for logging

        self._load()

        self._monitor_thread = threading.Thread(
            target=self._monitor_loop,
            daemon=True,
            name="reminder-monitor"
        )

    def start(self):
        self._running.set()
        self._monitor_thread.start()

    def stop(self):
        self._running.clear()

    # ── CRUD ──────────────────────────────────────────────────────────────────

    def get_all(self) -> list[Task]:
        with self._lock:
            return list(self._tasks.values())

    def get(self, task_id: str) -> Optional[Task]:
        with self._lock:
            return self._tasks.get(task_id)

    def add(self, task: Task) -> Task:
        with self._lock:
            self._tasks[task.id] = task
        self._persist()
        return task

    def update(self, task_id: str, **kwargs) -> Optional[Task]:
        with self._lock:
            task = self._tasks.get(task_id)
            if not task:
                return None
            for k, v in kwargs.items():
                if v is not None and hasattr(task, k):
                    setattr(task, k, v)
        self._persist()
        return task

    def delete(self, task_id: str) -> bool:
        with self._lock:
            if task_id not in self._tasks:
                return False
            del self._tasks[task_id]
        self._persist()
        return True

    # ── Reminder monitor ──────────────────────────────────────────────────────

    def _monitor_loop(self):
        """
        Check every 30 seconds if any task reminder is due.
        Fires OS desktop notifications via subprocess (IPC to the OS GUI layer).
        """
        while self._running.is_set():
            now = datetime.now()

            with self._lock:
                tasks = list(self._tasks.values())

            for task in tasks:
                if task.done or task.reminder_fired:
                    continue
                if not task.date or not task.time:
                    continue

                try:
                    task_dt     = datetime.fromisoformat(f"{task.date}T{task.time}")
                    reminder_dt = task_dt - timedelta(minutes=task.reminder)
                except ValueError:
                    continue

                # Fire if within 30-second window
                delta = (now - reminder_dt).total_seconds()
                if 0 <= delta <= 30:
                    self._fire_reminder(task)

            self._running.wait(timeout=30)   # Sleep 30s or until stopped

    def _fire_reminder(self, task: Task):
        """Send OS desktop notification and callback."""
        # Mark as fired first to prevent duplicate notifications
        with self._lock:
            t = self._tasks.get(task.id)
            if t:
                t.reminder_fired = True
        self._persist()

        # OS-level desktop notification via subprocess (GUI IPC)
        self._send_os_notification(
            title=f"⏰ Reminder: {task.title}",
            body=f"Starting in {task.reminder} min  •  {task.time}"
        )

        if self._on_reminder:
            try:
                self._on_reminder(task.id)
            except Exception:
                pass

    @staticmethod
    def _send_os_notification(title: str, body: str):
        """
        Cross-platform OS desktop notification via subprocess.
        Each call spawns a child process that talks to the OS notification daemon.

        Linux  → notify-send (libnotify / D-Bus IPC)
        macOS  → osascript (AppleScript bridge)
        Windows→ PowerShell BurntToast / msg.exe
        """
        system = platform.system()
        try:
            if system == "Linux":
                subprocess.Popen(
                    ["notify-send", "--icon=dialog-information",
                     "--expire-time=8000", title, body],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL
                )
            elif system == "Darwin":
                script = (
                    f'display notification "{body}" '
                    f'with title "{title}" sound name "Glass"'
                )
                subprocess.Popen(
                    ["osascript", "-e", script],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL
                )
            elif system == "Windows":
                ps_cmd = (
                    "Add-Type -AssemblyName System.Windows.Forms; "
                    f"$n = New-Object System.Windows.Forms.NotifyIcon; "
                    "$n.Icon = [System.Drawing.SystemIcons]::Information; "
                    "$n.Visible = $true; "
                    f'$n.ShowBalloonTip(5000, "{title}", "{body}", '
                    "[System.Windows.Forms.ToolTipIcon]::Info)"
                )
                subprocess.Popen(
                    ["powershell", "-WindowStyle", "Hidden", "-Command", ps_cmd],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL
                )
        except FileNotFoundError:
            # notify-send not installed — silently skip OS notification
            pass
        except Exception:
            pass

    # ── Persistence ───────────────────────────────────────────────────────────

    def _load(self):
        rows = storage.load_tasks()
        with self._lock:
            for row in rows:
                try:
                    t = Task(**row)
                    self._tasks[t.id] = t
                except Exception:
                    pass

    def _persist(self):
        with self._lock:
            data = [t.model_dump() for t in self._tasks.values()]
        storage.save_tasks(data)
