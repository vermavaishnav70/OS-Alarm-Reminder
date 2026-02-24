// src/App.jsx
import { useState, useEffect, useRef } from "react";
import AlarmPanel from "./components/AlarmPanel";
import WorldClock from "./components/WorldClock";
import CalendarView from "./components/CalendarView";
import TaskPanel from "./components/TaskPanel";
import { ChronosSocket } from "./api/client";
import { Howl, Howler } from "howler";

const pad = n => String(n).padStart(2, "0");
const fmt12 = (h, m, s) => {
  const ap = h >= 12 ? "PM" : "AM";
  const hh = h % 12 || 12;
  return `${pad(hh)}:${pad(m)}:${pad(s)} ${ap}`;
};

export default function App() {
  const [tab, setTab] = useState("alarm");
  const [now, setNow] = useState(new Date());
  const [ringingIds, setRingingIds] = useState([]);
  const [reminderTaskIds, setReminderIds] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [calendarDate, setCalendarDate] = useState(null);
  const [wsStatus, setWsStatus] = useState("connecting");
  const socketRef = useRef(null);
  const activeSounds = useRef({});

  const soundMap = {
    "Classic Beep": "/sounds/classic_beep.wav",
    "Gentle Bell": "/sounds/gentle_bell.wav",
    "Alarm Siren": "/sounds/alarm_siren.wav",
    "Digital Pulse": "/sounds/digital_pulse.wav",
    "Deep Horn": "/sounds/deep_horn.wav"
  };

  // Local clock tick
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // WebSocket connection
  useEffect(() => {
    const socket = new ChronosSocket({
      alarm_ring: (msg) => {
        setRingingIds(ids => [...new Set([...ids, msg.alarm_id])]);

        // Play the sound
        let soundFile = soundMap[msg.sound];
        if (!soundFile) {
          // It is a custom sound, assume it's hosted at /api/sounds/files/
          // The backend generated a filename like "my_sound.mp3" based on the upload name.
          const backendAPI = import.meta.env.VITE_API_URL || "http://localhost:8000";
          // We replace spaces but we don't know the exact ext without hitting the API. 
          // We can pass the exact URL back from the backend as part of msg OR we can just hit a unified test endpoint.
          // Let's assume the msg includes the `sound_filename` if custom, otherwise we fallback.
          // Since we didn't add it to msg, let's just use string parsing of msg.sound (hope it's a wav or mp3).
          const sanitized = msg.sound.replace(/ /g, '_');
          soundFile = `${backendAPI}/api/sounds/files/${sanitized}.mp3`;
        }

        if (!activeSounds.current[msg.alarm_id]) {
          const howl = new Howl({
            src: [soundFile],
            loop: true,
            volume: 1.0,
            format: ['wav', 'mp3', 'ogg', 'm4a', 'aac']
          });
          howl.play();
          activeSounds.current[msg.alarm_id] = howl;
        }
      },
      task_reminder: (msg) => {
        setReminderIds(ids => [...new Set([...ids, msg.task_id])]);
        setTimeout(() => {
          setReminderIds(ids => ids.filter(id => id !== msg.task_id));
        }, 60000);
      },
    });
    socket.connect();
    socketRef.current = socket;

    // Poll connection status
    const statusInterval = setInterval(() => {
      const ws = socket._ws;
      if (!ws) setWsStatus("connecting");
      else if (ws.readyState === 1) setWsStatus("connected");
      else if (ws.readyState === 3) setWsStatus("reconnecting");
      else setWsStatus("connecting");
    }, 1000);

    return () => {
      socket.disconnect();
      clearInterval(statusInterval);
    };
  }, []);

  const handleDismiss = (id) => {
    setRingingIds(ids => ids.filter(x => x !== id));

    // Stop the sound
    if (activeSounds.current[id]) {
      activeSounds.current[id].stop();
      delete activeSounds.current[id];
    }
  };

  const handleAddTaskForDay = (dateStr) => {
    setCalendarDate(dateStr);
    setTab("tasks");
  };

  const activeAlarms = ringingIds.length;

  return (
    <div className="app">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Orbitron:wght@400;700;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0a0a0f; color: #e2e8f0; font-size: 16px; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-thumb { background: #f59e0b44; border-radius: 3px; }

        .app { font-family: 'Share Tech Mono', monospace; min-height: 100vh; }

        /* ── Header ───────────────────────────────────────────────────────── */
        .header {
          background: linear-gradient(135deg, #0f0f1a 0%, #1a0f0a 100%);
          border-bottom: 1px solid #f59e0b33;
          padding: 24px 40px;
          display: flex; align-items: center; justify-content: space-between;
        }
        .header-brand { font-family: 'Orbitron', sans-serif; font-weight: 900; font-size: 28px;
          background: linear-gradient(90deg, #f59e0b, #fbbf24);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          letter-spacing: 4px; }
        .header-clock { font-family: 'Orbitron', sans-serif; font-size: 36px; font-weight: 700;
          color: #fbbf24; letter-spacing: 3px; text-shadow: 0 0 20px #f59e0b66; }
        .header-date { font-size: 14px; color: #94a3b8; letter-spacing: 2px; text-align: right; margin-top: 4px; }

        /* ── Status bar ────────────────────────────────────────────────────── */
        .status-bar { display: flex; gap: 24px; padding: 10px 32px;
          background: #07070f; border-bottom: 1px solid #ffffff06;
          font-size: 13px; color: #64748b; letter-spacing: 1.5px; align-items: center; }
        .status-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%;
          margin-right: 8px; animation: blink 2s ease-in-out infinite; }
        .dot-green { background: #10b981; }
        .dot-yellow { background: #f59e0b; }
        .dot-red { background: #ef4444; }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }

        /* ── Nav ───────────────────────────────────────────────────────────── */
        .nav { display: flex; border-bottom: 1px solid #ffffff0f; background: #0d0d18; }
        .nav-btn { flex: 1; padding: 18px 12px; border: none; cursor: pointer;
          background: transparent; font-family: 'Orbitron', sans-serif; font-size: 15px;
          letter-spacing: 2px; color: #64748b; transition: all 0.2s;
          border-bottom: 3px solid transparent; text-transform: uppercase; }
        .nav-btn:hover { color: #94a3b8; background: #ffffff04; }
        .nav-btn.active { color: #f59e0b; border-bottom-color: #f59e0b; background: #f59e0b08; }

        /* ── Content ───────────────────────────────────────────────────────── */
        .content { padding: 36px 32px; max-width: 1200px; margin: 0 auto; }

        /* ── Panels & cards ────────────────────────────────────────────────── */
        .panel { background: #0f0f1a; border: 1px solid #f59e0b22; border-radius: 6px; padding: 32px; margin-bottom: 28px; }
        .panel-title { font-family: 'Orbitron', sans-serif; font-size: 16px; letter-spacing: 3px; color: #f59e0b; margin-bottom: 24px; }

        .alarm-card { background: #0f0f1a; border: 1px solid #ffffff0d; border-radius: 6px;
          padding: 24px 28px; margin-bottom: 16px; display: flex; align-items: center; gap: 24px;
          transition: border-color 0.2s; position: relative; overflow: hidden; }
        .alarm-card::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0;
          width: 4px; background: #f59e0b; opacity: 0; transition: opacity 0.2s; }
        .alarm-card.active::before { opacity: 1; }
        .alarm-card.ringing { border-color: #f59e0b; animation: ring-pulse 0.5s ease-in-out infinite alternate; }
        @keyframes ring-pulse { from{box-shadow:0 0 0 0 #f59e0b33} to{box-shadow:0 0 0 10px #f59e0b11} }

        .alarm-time { font-family: 'Orbitron', sans-serif; font-size: 40px; font-weight: 700;
          color: #fbbf24; letter-spacing: 2px; min-width: 140px; }
        .alarm-meta { flex: 1; }
        .alarm-label-text { font-size: 18px; color: #e2e8f0; }
        .alarm-label-sub { font-size: 13px; color: #64748b; margin-top: 6px; letter-spacing: 1px; }
        .day-pill { display: inline-block; padding: 2px 8px; margin: 3px;
          font-size: 11px; letter-spacing: 1px; background: #f59e0b15; color: #f59e0b; border-radius: 3px; }

        /* ── World clock ───────────────────────────────────────────────────── */
        .zone-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px,1fr)); gap: 16px; }
        .zone-card { background: #0f0f1a; border: 1px solid #ffffff08; border-radius: 6px;
          padding: 24px; position: relative; overflow: hidden; }
        .zone-card::after { content:''; position:absolute; right:-20px; bottom:-20px; width:100px;
          height:100px; border-radius:50%; background:radial-gradient(circle,#f59e0b08,transparent); }
        .zone-city { font-family: 'Orbitron', sans-serif; font-size: 14px; letter-spacing: 2px; color: #94a3b8; }
        .zone-time { font-family: 'Orbitron', sans-serif; font-size: 28px; font-weight: 700;
          color: #fbbf24; margin: 10px 0 6px; letter-spacing: 1px; }
        .zone-date { font-size: 13px; color: #475569; letter-spacing: 1px; }

        /* ── Calendar ──────────────────────────────────────────────────────── */
        .cal-layout { display: grid; grid-template-columns: 1fr 340px; gap: 28px; }
        .cal-nav { display: flex; align-items: center; gap: 18px; margin-bottom: 24px; }
        .cal-nav-btn { background: transparent; border: 1px solid #ffffff0f; color: #94a3b8;
          cursor: pointer; padding: 10px 16px; border-radius: 4px; font-size: 18px; transition: all 0.15s; }
        .cal-nav-btn:hover { border-color: #f59e0b44; color: #fbbf24; }
        .cal-month-label { font-family: 'Orbitron', sans-serif; font-size: 18px; font-weight: 700;
          color: #e2e8f0; flex: 1; }
        .cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
        .cal-day-hdr { text-align: center; font-size: 12px; letter-spacing: 2px; color: #475569; padding: 10px 0; }
        .cal-day { aspect-ratio:1; display:flex; flex-direction:column; align-items:center;
          justify-content:center; cursor:pointer; border-radius:6px; transition:all 0.15s;
          font-size:16px; position:relative; border: 1px solid transparent; }
        .cal-day:hover { background: #ffffff08; }
        .cal-day.today { border-color: #f59e0b44; color: #fbbf24; background: #f59e0b0a; }
        .cal-day.selected { background: #f59e0b; color: #0a0a0f; border-color: #f59e0b; }
        .cal-day.has-task::after { content:''; position:absolute; bottom:6px;
          width:6px; height:6px; border-radius:50%; background:#f59e0b; }
        .cal-day.selected::after { background: #0a0a0f; }
        .cal-day.empty { cursor: default; }
        .cal-day.empty:hover { background: transparent; }

        /* ── Tasks ─────────────────────────────────────────────────────────── */
        .task-card { background: #0f0f1a; border: 1px solid #ffffff0d; border-radius: 6px;
          padding: 18px 24px; margin-bottom: 14px; display: flex; align-items: center;
          gap: 18px; transition: all 0.2s; }
        .task-dot { width: 14px; height: 14px; border-radius: 50%; flex-shrink: 0; }
        .task-title { font-size: 18px; color: #e2e8f0; }
        .task-meta { font-size: 13px; color: #64748b; margin-top: 4px; letter-spacing: 1px; }
        .task-check { width: 28px; height: 28px; border-radius: 50%; border: 1px solid #334155;
          cursor: pointer; background: transparent; transition: all 0.2s; display: flex;
          align-items: center; justify-content: center; flex-shrink: 0; color: #fff; font-size: 16px; }
        .task-check:hover { border-color: #10b981; }

        /* ── Ringing overlay ───────────────────────────────────────────────── */
        .ringing-overlay { position: fixed; inset: 0; background: #0a0a0fcc;
          backdrop-filter: blur(10px); display: flex; align-items: center;
          justify-content: center; z-index: 100; }
        .ringing-modal { background: #0f0f1a; border: 1px solid #f59e0b;
          border-radius: 6px; padding: 60px; text-align: center; max-width: 480px;
          box-shadow: 0 0 100px #f59e0b22; animation: ring-pulse 0.5s ease-in-out infinite alternate; }
        .ringing-icon { font-size: 80px; display: block; margin-bottom: 24px;
          animation: shake 0.4s ease-in-out infinite alternate; }
        @keyframes shake { from{transform:rotate(-8deg)} to{transform:rotate(8deg)} }
        .ringing-time { font-family: 'Orbitron', sans-serif; font-size: 48px; font-weight: 700;
          color: #fbbf24; letter-spacing: 3px; }
        .ringing-label { color: #94a3b8; margin: 10px 0 40px; font-size: 18px; letter-spacing: 1px; }

        /* ── Forms & inputs ────────────────────────────────────────────────── */
        .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .input-group { margin-bottom: 20px; }
        .input-label { font-size: 13px; letter-spacing: 2px; color: #64748b; margin-bottom: 8px;
          display: block; text-transform: uppercase; }
        .input { width: 100%; background: #1e293b; border: 1px solid #ffffff0f; color: #e2e8f0;
          padding: 14px 18px; border-radius: 4px; font-family: 'Share Tech Mono', monospace;
          font-size: 16px; outline: none; transition: border-color 0.2s; }
        .input:focus { border-color: #f59e0b44; }
        select.input option { background: #1e293b; }
        .day-toggle { display: flex; gap: 8px; flex-wrap: wrap; }
        .day-btn { padding: 8px 14px; border-radius: 4px; border: 1px solid #ffffff0f;
          cursor: pointer; font-size: 13px; letter-spacing: 1px; font-family: 'Share Tech Mono', monospace;
          background: transparent; color: #64748b; transition: all 0.15s; }
        .day-btn.sel { background: #f59e0b; color: #0a0a0f; border-color: #f59e0b; }
        .day-btn:hover:not(.sel) { border-color: #f59e0b44; color: #94a3b8; }
        .color-picker { display: flex; gap: 10px; flex-wrap: wrap; }
        .color-swatch { width: 36px; height: 36px; border-radius: 50%; cursor: pointer;
          border: 2px solid transparent; transition: all 0.15s; }
        .color-swatch.sel { border-color: white; transform: scale(1.2); }

        /* ── Buttons ───────────────────────────────────────────────────────── */
        .btn { padding: 14px 24px; border-radius: 4px; border: none; cursor: pointer;
          font-family: 'Share Tech Mono', monospace; font-size: 15px; letter-spacing: 2px;
          transition: all 0.15s; text-transform: uppercase; }
        .btn-primary { background: #f59e0b; color: #0a0a0f; font-weight: bold; }
        .btn-primary:hover { background: #fbbf24; }
        .btn-danger { background: #ef4444; color: white; }
        .btn-danger:hover { background: #f87171; }
        .btn-ghost { background: transparent; border: 1px solid #ffffff1a; color: #94a3b8; }
        .btn-ghost:hover { border-color: #f59e0b44; color: #fbbf24; }
        .delete-btn { background: transparent; border: none; color: #334155;
          cursor: pointer; font-size: 20px; transition: color 0.15s; padding: 6px 12px; }
        .delete-btn:hover { color: #ef4444; }
        .toggle { width: 56px; height: 30px; border-radius: 15px; border: none;
          cursor: pointer; position: relative; transition: background 0.2s; flex-shrink: 0; }
        .toggle::after { content:''; position:absolute; top:4px; width:22px; height:22px;
          border-radius:50%; background:white; transition:left 0.2s; }
        .toggle.on { background: #f59e0b; }
        .toggle.on::after { left: 30px; }
        .toggle.off { background: #1e293b; }
        .toggle.off::after { left: 4px; }

        /* ── Misc ──────────────────────────────────────────────────────────── */
        .section-hdr { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
        .section-title { font-family: 'Orbitron', sans-serif; font-size: 13px; letter-spacing: 3px;
          color: #64748b; text-transform: uppercase; }
        .no-items { text-align: center; padding: 60px; color: #64748b; font-size: 16px; letter-spacing: 1px; }

        @media (max-width: 680px) {
          .two-col, .cal-layout { grid-template-columns: 1fr; }
          .zone-grid { grid-template-columns: repeat(2, 1fr); }
          .header-clock { font-size: 24px; }
          .alarm-time { font-size: 28px; }
        }
      `}</style>

      {/* Header */}
      <div className="header">
        <div>
          <div className="header-brand">CHRONOS OS</div>
          <div style={{ fontSize: 13, color: "#94a3b8", letterSpacing: 2, marginTop: 6 }}>
            ALARM & REMINDER SYSTEM
          </div>
        </div>
        <div>
          <div className="header-clock">
            {fmt12(now.getHours(), now.getMinutes(), now.getSeconds())}
          </div>
          <div className="header-date">
            {now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div className="status-bar">
        <span>
          <span className={`status-dot ${wsStatus === "connected" ? "dot-green" : wsStatus === "reconnecting" ? "dot-yellow" : "dot-red"}`} />
          BACKEND {wsStatus.toUpperCase()}
        </span>
        {activeAlarms > 0 && (
          <span style={{ color: "#ef4444" }}>
            🔔 {activeAlarms} ALARM{activeAlarms > 1 ? "S" : ""} RINGING
          </span>
        )}
        {reminderTaskIds.length > 0 && (
          <span style={{ color: "#6366f1" }}>⚡ REMINDER ACTIVE</span>
        )}
      </div>

      {/* Nav */}
      <nav className="nav">
        {[
          ["alarm", "⏰ Alarms"],
          ["world", "🌍 World Clock"],
          ["calendar", "📅 Calendar"],
          ["tasks", "✓ Tasks"],
        ].map(([id, label]) => (
          <button key={id} className={`nav-btn ${tab === id ? "active" : ""}`}
            onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>

      {/* Content */}
      <div className="content">
        {tab === "alarm" && (
          <AlarmPanel
            ringingIds={ringingIds}
            onDismiss={handleDismiss}
          />
        )}
        {tab === "world" && <WorldClock />}
        {tab === "calendar" && (
          <CalendarView
            tasks={tasks}
            onAddTaskForDay={handleAddTaskForDay}
          />
        )}
        {tab === "tasks" && (
          <TaskPanel
            reminderTaskIds={reminderTaskIds}
            initialDate={calendarDate}
            onTasksChange={setTasks}
          />
        )}
      </div>
    </div>
  );
}
