// src/api/client.js
// ─────────────────────────────────────────────────────────────────────────────
// HTTP + WebSocket client for the Chronos OS Python backend.

const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";
const WS_URL = BASE.replace(/^http/, "ws") + "/ws";

// ── HTTP helpers ──────────────────────────────────────────────────────────────

async function request(method, path, body) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  if (res.status === 204) return null;
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

const get = (path) => request("GET", path);
const post = (path, body) => request("POST", path, body);
const patch = (path, body) => request("PATCH", path, body);
const del = (path) => request("DELETE", path);

// ── Alarm API ────────────────────────────────────────────────────────────────

export const alarmApi = {
  list: () => get("/api/alarms"),
  create: (data) => post("/api/alarms", data),
  update: (id, data) => patch(`/api/alarms/${id}`, data),
  delete: (id) => del(`/api/alarms/${id}`),
  dismiss: (id) => post(`/api/alarms/${id}/dismiss`),
  test: (id) => post(`/api/alarms/${id}/test`),
};

// ── Task API ──────────────────────────────────────────────────────────────────

export const taskApi = {
  list: () => get("/api/tasks"),
  create: (data) => post("/api/tasks", data),
  update: (id, data) => patch(`/api/tasks/${id}`, data),
  delete: (id) => del(`/api/tasks/${id}`),
};

// ── Sound API ─────────────────────────────────────────────────────────────────

export const soundApi = {
  list: () => get("/api/sounds"),

  upload: async (name, file) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${BASE}/api/sounds?name=${encodeURIComponent(name)}`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }
    return res.json();
  },

  delete: (name) => del(`/api/sounds/${encodeURIComponent(name)}`),
};

// ── World clock API ───────────────────────────────────────────────────────────

export const clockApi = {
  world: () => get("/api/worldclock"),
};

// ── WebSocket manager ─────────────────────────────────────────────────────────

export class ChronosSocket {
  constructor(handlers = {}) {
    this._handlers = handlers;   // { alarm_ring, task_reminder }
    this._ws = null;
    this._pingTimer = null;
    this._reconnectDelay = 2000;
  }

  connect() {
    this._connect();
  }

  _connect() {
    try {
      this._ws = new WebSocket(WS_URL);

      this._ws.onopen = () => {
        console.log("[WS] Connected to Chronos OS backend");
        this._reconnectDelay = 2000;
        this._startPing();
      };

      this._ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          const handler = this._handlers[msg.event];
          if (handler) handler(msg);
        } catch (_) { }
      };

      this._ws.onclose = () => {
        console.log("[WS] Disconnected — reconnecting…");
        this._stopPing();
        setTimeout(() => this._connect(), this._reconnectDelay);
        this._reconnectDelay = Math.min(this._reconnectDelay * 1.5, 30000);
      };

      this._ws.onerror = () => {
        this._ws.close();
      };
    } catch (_) { }
  }

  _startPing() {
    this._pingTimer = setInterval(() => {
      if (this._ws?.readyState === WebSocket.OPEN) {
        this._ws.send(JSON.stringify({ type: "ping" }));
      }
    }, 25000);
  }

  _stopPing() {
    clearInterval(this._pingTimer);
  }

  disconnect() {
    this._stopPing();
    this._ws?.close();
  }
}
