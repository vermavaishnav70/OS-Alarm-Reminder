"""
main.py
───────
Chronos OS — FastAPI backend entry point.

Exposes:
  REST  /api/alarms        CRUD
  REST  /api/tasks         CRUD
  REST  /api/sounds        list available sounds
  REST  /api/worldclock    server-side world clock data
  WS    /ws                real-time push to frontend

OS concepts demonstrated at the server level:
  - os.getpid()    — process identity
  - signal.signal  — graceful shutdown on SIGTERM/SIGINT
  - Uvicorn spawns worker processes (os.fork on Unix)
"""

import os
import signal
import asyncio
import platform
from contextlib import asynccontextmanager
from datetime import datetime
from typing import List
from zoneinfo import ZoneInfo

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from models import Alarm, AlarmCreate, AlarmUpdate, Task, TaskCreate, TaskUpdate
from alarm_manager import AlarmManager
from task_manager import TaskManager
from sound_engine import (
    SOUND_PROFILES,
    CUSTOM_SOUNDS_DIR,
    add_custom_sound,
    delete_custom_sound,
    get_all_sounds,
)

# ── WebSocket connection registry ─────────────────────────────────────────────

class ConnectionManager:
    def __init__(self):
        self.active: List[WebSocket] = []
        self._lock = asyncio.Lock()

    async def connect(self, ws: WebSocket):
        await ws.accept()
        async with self._lock:
            self.active.append(ws)

    async def disconnect(self, ws: WebSocket):
        async with self._lock:
            self.active = [c for c in self.active if c is not ws]

    async def broadcast(self, data: dict):
        async with self._lock:
            dead = []
            for ws in self.active:
                try:
                    await ws.send_json(data)
                except Exception:
                    dead.append(ws)
            self.active = [c for c in self.active if c not in dead]


ws_manager = ConnectionManager()


# ── Alarm / task ring callbacks ────────────────────────────────────────────────

def _alarm_ring_callback(alarm_id: str):
    """Called by AlarmManager (on a background thread) when an alarm fires."""
    asyncio.run_coroutine_threadsafe(
        ws_manager.broadcast({"event": "alarm_ring", "alarm_id": alarm_id}),
        _event_loop
    )


def _reminder_callback(task_id: str):
    """Called by TaskManager (on a background thread) when a reminder is due."""
    asyncio.run_coroutine_threadsafe(
        ws_manager.broadcast({"event": "task_reminder", "task_id": task_id}),
        _event_loop
    )


_event_loop: asyncio.AbstractEventLoop = None


# ── App lifespan ──────────────────────────────────────────────────────────────

alarm_mgr = AlarmManager(on_ring=_alarm_ring_callback)
task_mgr  = TaskManager(on_reminder=_reminder_callback)


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _event_loop
    _event_loop = asyncio.get_event_loop()

    print(f"[CHRONOS OS] PID={os.getpid()} | Platform={platform.system()}")
    alarm_mgr.start()
    task_mgr.start()

    yield   # Application runs here

    alarm_mgr.stop()
    task_mgr.stop()
    print("[CHRONOS OS] Shutdown complete.")


app = FastAPI(title="Chronos OS", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],    # Dev: allow all; restrict in production
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── WebSocket endpoint ────────────────────────────────────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws_manager.connect(ws)
    try:
        while True:
            data = await ws.receive_json()
            # Handle ping keepalive
            if data.get("type") == "ping":
                await ws.send_json({"type": "pong"})
    except WebSocketDisconnect:
        await ws_manager.disconnect(ws)


# ── Alarm endpoints ───────────────────────────────────────────────────────────

@app.get("/api/alarms", response_model=list[Alarm])
def list_alarms():
    return alarm_mgr.get_all()

@app.get("/", response_model=dict)
def root():
    return {"message": "Welcome to Chronos OS! Visit /docs for API documentation."}

@app.post("/api/alarms", response_model=Alarm, status_code=201)
def create_alarm(body: AlarmCreate):
    alarm = Alarm(**body.model_dump())
    return alarm_mgr.add(alarm)


@app.patch("/api/alarms/{alarm_id}", response_model=Alarm)
def update_alarm(alarm_id: str, body: AlarmUpdate):
    updated = alarm_mgr.update(alarm_id, **body.model_dump(exclude_none=True))
    if not updated:
        raise HTTPException(status_code=404, detail="Alarm not found")
    return updated


@app.delete("/api/alarms/{alarm_id}", status_code=204)
def delete_alarm(alarm_id: str):
    if not alarm_mgr.delete(alarm_id):
        raise HTTPException(status_code=404, detail="Alarm not found")


@app.post("/api/alarms/{alarm_id}/dismiss", response_model=Alarm)
def dismiss_alarm(alarm_id: str):
    alarm = alarm_mgr.dismiss(alarm_id)
    if not alarm:
        raise HTTPException(status_code=404, detail="Alarm not found")
    return alarm


@app.post("/api/alarms/{alarm_id}/test")
def test_alarm_sound(alarm_id: str):
    """Play the alarm sound once for preview."""
    alarm = alarm_mgr.get(alarm_id)
    if not alarm:
        raise HTTPException(status_code=404, detail="Alarm not found")
    from sound_engine import play_sound_once
    import threading
    threading.Thread(target=play_sound_once, args=(alarm.sound,), daemon=True).start()
    return {"status": "playing", "sound": alarm.sound}


# ── Task endpoints ────────────────────────────────────────────────────────────

@app.get("/api/tasks", response_model=list[Task])
def list_tasks():
    return task_mgr.get_all()


@app.post("/api/tasks", response_model=Task, status_code=201)
def create_task(body: TaskCreate):
    task = Task(**body.model_dump())
    return task_mgr.add(task)


@app.patch("/api/tasks/{task_id}", response_model=Task)
def update_task(task_id: str, body: TaskUpdate):
    updated = task_mgr.update(task_id, **body.model_dump(exclude_none=True))
    if not updated:
        raise HTTPException(status_code=404, detail="Task not found")
    return updated


@app.delete("/api/tasks/{task_id}", status_code=204)
def delete_task(task_id: str):
    if not task_mgr.delete(task_id):
        raise HTTPException(status_code=404, detail="Task not found")


# ── Sound list & custom sound management ────────────────────────────────────

@app.get("/api/sounds")
def list_sounds():
    return get_all_sounds()


@app.post("/api/sounds/upload", status_code=201)
async def upload_custom_sound(
    name: str,
    file: UploadFile = File(...),
):
    """Upload a custom sound file (wav / mp3 / ogg / m4a / aac)."""
    ALLOWED = {".wav", ".mp3", ".ogg", ".m4a", ".aac", ".flac"}
    suffix = os.path.splitext(file.filename or "")[1].lower()
    if suffix not in ALLOWED:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{suffix}'. Allowed: {', '.join(sorted(ALLOWED))}"
        )
    if not name.strip():
        raise HTTPException(status_code=400, detail="Sound name must not be empty.")
    if name in SOUND_PROFILES:
        raise HTTPException(status_code=409, detail=f"'{name}' is a built-in sound name.")

    # Sanitise filename to prevent path traversal
    safe_filename = f"{name.replace(' ', '_')}{suffix}"
    dest = CUSTOM_SOUNDS_DIR / safe_filename
    contents = await file.read()
    dest.write_bytes(contents)

    entry = add_custom_sound(name, safe_filename, f"Custom: {file.filename}")
    return {"name": name, "filename": safe_filename, **entry}


@app.delete("/api/sounds/{sound_name}", status_code=204)
def remove_custom_sound(sound_name: str):
    """Delete a custom (user-uploaded) sound."""
    if sound_name in SOUND_PROFILES:
        raise HTTPException(status_code=400, detail="Cannot delete built-in sounds.")
    if not delete_custom_sound(sound_name):
        raise HTTPException(status_code=404, detail="Custom sound not found.")


# ── World clock ───────────────────────────────────────────────────────────────

WORLD_ZONES = [
    {"city": "New York",    "tz": "America/New_York"},
    {"city": "London",      "tz": "Europe/London"},
    {"city": "Paris",       "tz": "Europe/Paris"},
    {"city": "Dubai",       "tz": "Asia/Dubai"},
    {"city": "Mumbai",      "tz": "Asia/Kolkata"},
    {"city": "Singapore",   "tz": "Asia/Singapore"},
    {"city": "Tokyo",       "tz": "Asia/Tokyo"},
    {"city": "Sydney",      "tz": "Australia/Sydney"},
    {"city": "Los Angeles", "tz": "America/Los_Angeles"},
    {"city": "São Paulo",   "tz": "America/Sao_Paulo"},
    {"city": "Cairo",       "tz": "Africa/Cairo"},
    {"city": "Moscow",      "tz": "Europe/Moscow"},
]


@app.get("/api/worldclock")
def world_clock():
    results = []
    for zone in WORLD_ZONES:
        try:
            tz   = ZoneInfo(zone["tz"])
            now  = datetime.now(tz)
            results.append({
                "city":     zone["city"],
                "tz":       zone["tz"],
                "time":     now.strftime("%H:%M:%S"),
                "time12":   now.strftime("%I:%M:%S %p"),
                "date":     now.strftime("%a, %b %d"),
                "hour":     now.hour,
                "is_day":   6 <= now.hour < 20,
                "offset":   now.strftime("%z"),
            })
        except Exception:
            pass
    return results


# ── Health / info ─────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "pid": os.getpid(),
        "platform": platform.system(),
        "python": platform.python_version(),
    }


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
