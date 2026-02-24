// src/components/AlarmPanel.jsx
import { useState, useEffect } from "react";
import { alarmApi, soundApi } from "../api/client";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function AlarmPanel({ ringingIds, onDismiss }) {
  const [alarms, setAlarms] = useState([]);
  const [sounds, setSounds] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    time: "", label: "", sound: "Classic Beep", repeat: [], active: true,
  });
  const [showSoundMgr, setShowSoundMgr] = useState(false);
  const [uploadName, setUploadName] = useState("");
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const load = async () => {
    try {
      const [a, s] = await Promise.all([alarmApi.list(), soundApi.list()]);
      setAlarms(a);
      setSounds(s);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Reflect ringing state pushed from WebSocket
  useEffect(() => {
    if (ringingIds.length === 0) return;
    setAlarms(prev =>
      prev.map(a => ({ ...a, ringing: ringingIds.includes(a.id) || a.ringing }))
    );
  }, [ringingIds]);

  const toggleDay = (d) =>
    setForm(f => ({
      ...f,
      repeat: f.repeat.includes(d) ? f.repeat.filter(x => x !== d) : [...f.repeat, d],
    }));

  const handleAdd = async () => {
    if (!form.time) return;
    const created = await alarmApi.create(form);
    setAlarms(a => [...a, created]);
    setForm({ time: "", label: "", sound: "Classic Beep", repeat: [], active: true });
    setShowAdd(false);
  };

  const handleToggle = async (alarm) => {
    const updated = await alarmApi.update(alarm.id, { active: !alarm.active });
    setAlarms(a => a.map(x => x.id === alarm.id ? updated : x));
  };

  const handleDelete = async (id) => {
    await alarmApi.delete(id);
    setAlarms(a => a.filter(x => x.id !== id));
  };

  const handleDismiss = async (id) => {
    await alarmApi.dismiss(id);
    setAlarms(a => a.map(x => x.id === id ? { ...x, ringing: false } : x));
    onDismiss(id);
  };

  const handleTest = (id) => alarmApi.test(id);

  const handleUpload = async () => {
    if (!uploadName.trim() || !uploadFile) return;
    setUploading(true);
    setUploadError("");
    try {
      await soundApi.upload(uploadName.trim(), uploadFile);
      setUploadName("");
      setUploadFile(null);
      const updated = await soundApi.list();
      setSounds(updated);
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteSound = async (name) => {
    if (!window.confirm(`Delete custom sound "${name}"?`)) return;
    await soundApi.delete(name);
    setSounds(s => s.filter(x => x.name !== name));
    if (form.sound === name) setForm(f => ({ ...f, sound: "Classic Beep" }));
  };

  const ringing = alarms.filter(a => a.ringing);

  return (
    <>
      {/* Ringing Modal */}
      {ringing.map(alarm => (
        <div key={alarm.id} className="ringing-overlay">
          <div className="ringing-modal">
            <span className="ringing-icon">⏰</span>
            <div className="ringing-time">{alarm.time}</div>
            <div className="ringing-label">{alarm.label || "ALARM"}</div>
            <button className="btn btn-danger" style={{ width: "100%", padding: "20px", fontSize: "18px", letterSpacing: "3px" }}
              onClick={() => handleDismiss(alarm.id)}>
              DISMISS
            </button>
          </div>
        </div>
      ))}

      <div className="section-hdr">
        <div className="section-title">Alarms & Reminders</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost" onClick={() => setShowSoundMgr(v => !v)}>
            🎵 SOUNDS
          </button>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ NEW ALARM</button>
        </div>
      </div>

      {/* Custom sound manager */}
      {showSoundMgr && (
        <div className="panel" style={{ marginBottom: 20, borderColor: "#8b5cf644" }}>
          <div className="panel-title">// CUSTOM SOUNDS</div>

          {/* Upload row */}
          <div className="two-col" style={{ alignItems: "flex-end", gap: 10 }}>
            <div className="input-group">
              <label className="input-label">SOUND NAME</label>
              <input
                className="input"
                placeholder="e.g. Morning Birds"
                value={uploadName}
                onChange={e => setUploadName(e.target.value)}
              />
            </div>
            <div className="input-group">
              <label className="input-label">AUDIO FILE (wav / mp3 / ogg…)</label>
              <input
                type="file"
                className="input"
                accept=".wav,.mp3,.ogg,.m4a,.aac,.flac"
                onChange={e => setUploadFile(e.target.files[0] || null)}
              />
            </div>
          </div>
          {uploadError && (
            <div style={{ color: "#f87171", fontSize: 14, marginBottom: 8 }}>{uploadError}</div>
          )}
          <button
            className="btn btn-primary"
            disabled={!uploadName.trim() || !uploadFile || uploading}
            onClick={handleUpload}
          >
            {uploading ? "UPLOADING…" : "UPLOAD SOUND"}
          </button>

          {/* Custom sound list */}
          {sounds.filter(s => s.custom).length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div className="input-label" style={{ marginBottom: 8 }}>UPLOADED SOUNDS</div>
              {sounds.filter(s => s.custom).map(s => (
                <div key={s.name} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "8px 12px", marginBottom: 6,
                  background: "rgba(139,92,246,0.08)", borderRadius: 6,
                  border: "1px solid rgba(139,92,246,0.2)"
                }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: 16 }}>{s.name}</span>
                    <span style={{ color: "#6b7280", fontSize: 14, marginLeft: 8 }}>{s.description}</span>
                  </div>
                  <button className="delete-btn" title="Delete sound" onClick={() => handleDeleteSound(s.name)}>✕</button>
                </div>
              ))}
            </div>
          )}
          {sounds.filter(s => s.custom).length === 0 && (
            <div className="no-items" style={{ marginTop: 12 }}>No custom sounds yet. Upload one above.</div>
          )}
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <div className="panel" style={{ marginBottom: 20, borderColor: "#f59e0b44" }}>
          <div className="panel-title">// CONFIGURE NEW ALARM</div>
          <div className="two-col">
            <div className="input-group">
              <label className="input-label">TIME</label>
              <input type="time" className="input" value={form.time}
                onChange={e => setForm(f => ({ ...f, time: e.target.value }))} />
            </div>
            <div className="input-group">
              <label className="input-label">LABEL</label>
              <input className="input" placeholder="Wake up, Meeting…" value={form.label}
                onChange={e => setForm(f => ({ ...f, label: e.target.value }))} />
            </div>
          </div>
          <div className="input-group">
            <label className="input-label">SOUND</label>
            <select className="input" value={form.sound}
              onChange={e => setForm(f => ({ ...f, sound: e.target.value }))}>
              <optgroup label="Built-in">
                {sounds.filter(s => !s.custom).map(s => (
                  <option key={s.name} value={s.name}>{s.name} — {s.description}</option>
                ))}
              </optgroup>
              {sounds.some(s => s.custom) && (
                <optgroup label="Custom">
                  {sounds.filter(s => s.custom).map(s => (
                    <option key={s.name} value={s.name}>★ {s.name}</option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
          <div className="input-group">
            <label className="input-label">REPEAT DAYS (empty = fire once)</label>
            <div className="day-toggle">
              {DAYS.map(d => (
                <button key={d} className={`day-btn ${form.repeat.includes(d) ? "sel" : ""}`}
                  onClick={() => toggleDay(d)}>{d}</button>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-primary" onClick={handleAdd}>SET ALARM</button>
            <button className="btn btn-ghost" onClick={() => setShowAdd(false)}>CANCEL</button>
          </div>
        </div>
      )}

      {loading && <div className="no-items">Loading alarms…</div>}
      {!loading && alarms.length === 0 && <div className="no-items">No alarms set. Create one above.</div>}

      {alarms.map(alarm => (
        <div key={alarm.id} className={`alarm-card ${alarm.active ? "active" : ""} ${alarm.ringing ? "ringing" : ""}`}>
          <div className="alarm-time">{alarm.time}</div>
          <div className="alarm-meta">
            <div className="alarm-label-text">{alarm.label || "Alarm"}</div>
            <div className="alarm-label-sub">
              🔊 {alarm.sound} &nbsp;|&nbsp;
              {alarm.repeat.length === 0
                ? "ONCE"
                : alarm.repeat.map(d => (
                  <span key={d} className="day-pill">{d}</span>
                ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button className="btn btn-ghost" style={{ fontSize: "14px", padding: "8px 12px" }}
              onClick={() => handleTest(alarm.id)} title="Test sound">▶</button>
            {alarm.ringing && (
              <button className="btn btn-danger" onClick={() => handleDismiss(alarm.id)}>DISMISS</button>
            )}
            <button className={`toggle ${alarm.active ? "on" : "off"}`}
              onClick={() => handleToggle(alarm)} />
            <button className="delete-btn" onClick={() => handleDelete(alarm.id)}>✕</button>
          </div>
        </div>
      ))}
    </>
  );
}
