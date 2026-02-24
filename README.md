# ⏰ Chronos OS — Alarm & Reminder System

An operating-systems course project demonstrating core OS concepts through a
real-world alarm & reminder application.


```
chronos-os/
├── backend/                   ← Python (FastAPI) — OS-level logic
│   ├── main.py                ← FastAPI server + WebSocket hub
│   ├── alarm_manager.py       ← Threading, signals, process scheduling
│   ├── task_manager.py        ← Reminder monitor, OS notifications
│   ├── sound_engine.py        ← Audio via subprocess / sounddevice
│   ├── storage.py             ← Atomic file I/O, mutex locking
│   ├── models.py              ← Pydantic data models
│   └── requirements.txt
└── frontend/                  ← React (Vite)
    ├── index.html
    ├── vite.config.js
    ├── package.json
    └── src/
        ├── main.jsx
        ├── App.jsx             ← Root: global state, WebSocket client
        ├── api/
        │   └── client.js       ← HTTP + WebSocket API client
        └── components/
            ├── AlarmPanel.jsx  ← Alarm CRUD + dismiss UI
            ├── WorldClock.jsx  ← World clock (polls Python backend)
            ├── CalendarView.jsx← Monthly calendar + task dots
            └── TaskPanel.jsx   ← Task CRUD + reminder highlights
```

---

## OS Concepts Demonstrated

| Concept | Where | Implementation |
|---|---|---|
| **Processes** | `main.py` | `os.getpid()`, Uvicorn workers |
| **Threads** | `alarm_manager.py` | `threading.Thread` per alarm player |
| **Mutex / Lock** | `alarm_manager.py`, `storage.py` | `threading.Lock` |
| **Semaphore** | `alarm_manager.py` | `threading.Event` (start/stop) |
| **Daemon threads** | `alarm_manager.py` | `daemon=True` — OS reclaims on exit |
| **Signals (POSIX)** | `alarm_manager.py` | `signal.SIGALRM`, `signal.alarm()` |
| **Scheduler** | `alarm_manager.py` | Tick loop — simulates timer interrupt |
| **IPC (subprocess)** | `sound_engine.py` | `subprocess.Popen` → `aplay` / `afplay` |
| **IPC (WebSocket)** | `main.py` | Backend pushes events to frontend |
| **OS notifications** | `task_manager.py` | `notify-send` (Linux D-Bus IPC) |
| **Atomic file write** | `storage.py` | `os.replace()` rename trick |
| **File locking** | `storage.py` | `threading.Lock` before every write |
| **Cross-platform** | `sound_engine.py` | `platform.system()` branching |
| **Resource cleanup** | `sound_engine.py` | `os.unlink(tmp)` in `finally` block |

---

## Features

- **Alarms** — Set time, label, sound, repeat days; OS plays audio on a background thread
- **World Clock** — 12 cities, server-side Python `zoneinfo` / `datetime`
- **Calendar** — Task dots on days, click to see tasks, link to add task
- **Tasks & Reminders** — OS desktop notification X minutes before task starts
- **WebSocket** — Real-time push from Python → React (alarm rings, reminder fires)

---

## Quick Start

### 1. Backend

```bash
cd backend
pip install -r requirements.txt

# Optional (better audio):
pip install numpy sounddevice

python main.py
# → http://localhost:8000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

Open http://localhost:5173 — the UI connects to the Python backend automatically.

---

## How Alarms Work (OS Walkthrough)

```
User sets alarm 07:00
        │
        ▼
AlarmManager.add() ──► JSON stored atomically (os.replace)
        │
        ▼
_tick_loop() ─── background daemon thread (threading.Thread)
  polls every 1s  (simulates kernel timer interrupt)
        │
        ▼ time matches
_fire(alarm)
  ├─ AlarmPlayer thread spawned (threading.Thread)
  │    └─ plays sound in a loop (sounddevice / subprocess aplay)
  │         controlled by threading.Event (semaphore)
  └─ asyncio coroutine sent to event loop
       └─ WebSocket broadcast → React UI shows ringing modal
              │
              ▼
        User clicks DISMISS
              │
              ▼
        POST /api/alarms/{id}/dismiss
              │
              ▼
        player.stop() → threading.Event.set() → thread exits
```

## How Reminders Work

```
TaskManager._monitor_loop() ─── daemon thread, polls every 30s
        │
        ▼  (now ≈ task_time - reminder_minutes)
_fire_reminder(task)
  ├─ subprocess.Popen("notify-send", ...)  ← OS desktop notification (IPC)
  └─ WebSocket broadcast → React highlights task card
```

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/alarms` | List all alarms |
| POST | `/api/alarms` | Create alarm |
| PATCH | `/api/alarms/{id}` | Update alarm |
| DELETE | `/api/alarms/{id}` | Delete alarm |
| POST | `/api/alarms/{id}/dismiss` | Stop ringing |
| POST | `/api/alarms/{id}/test` | Preview sound |
| GET | `/api/tasks` | List tasks |
| POST | `/api/tasks` | Create task |
| PATCH | `/api/tasks/{id}` | Update task |
| DELETE | `/api/tasks/{id}` | Delete task |
| GET | `/api/sounds` | List sound profiles |
| GET | `/api/worldclock` | World time data |
| WS | `/ws` | Real-time events |
| GET | `/api/health` | Server info + PID |
