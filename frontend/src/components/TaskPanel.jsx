// src/components/TaskPanel.jsx
import { useState, useEffect } from "react";
import { taskApi } from "../api/client";

const COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#3b82f6", "#ec4899"];

export default function TaskPanel({ reminderTaskIds, initialDate, onTasksChange }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    title: "", date: initialDate || "", time: "", reminder: 10, color: "#6366f1",
  });

  const load = async () => {
    try {
      const data = await taskApi.list();
      setTasks(data);
      onTasksChange?.(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Sync initialDate when coming from calendar
  useEffect(() => {
    if (initialDate) {
      setForm(f => ({ ...f, date: initialDate }));
      setShowAdd(true);
    }
  }, [initialDate]);

  // Highlight tasks that have pending reminders
  useEffect(() => {
    if (reminderTaskIds.length === 0) return;
    setTasks(prev => prev.map(t => ({
      ...t,
      _highlight: reminderTaskIds.includes(t.id),
    })));
  }, [reminderTaskIds]);

  const handleAdd = async () => {
    if (!form.title) return;
    const created = await taskApi.create(form);
    const next = [...tasks, created];
    setTasks(next);
    onTasksChange?.(next);
    setForm({ title: "", date: "", time: "", reminder: 10, color: "#6366f1" });
    setShowAdd(false);
  };

  const handleDone = async (task) => {
    const updated = await taskApi.update(task.id, { done: !task.done });
    const next = tasks.map(t => t.id === task.id ? updated : t);
    setTasks(next);
    onTasksChange?.(next);
  };

  const handleDelete = async (id) => {
    await taskApi.delete(id);
    const next = tasks.filter(t => t.id !== id);
    setTasks(next);
    onTasksChange?.(next);
  };

  const pending = tasks.filter(t => !t.done).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const completed = tasks.filter(t => t.done);

  return (
    <>
      <div className="section-hdr">
        <div className="section-title">Tasks & Reminders</div>
        <button className="btn btn-primary" onClick={() => setShowAdd(v => !v)}>+ NEW TASK</button>
      </div>

      {showAdd && (
        <div className="panel" style={{ marginBottom: 20, borderColor: "#6366f144" }}>
          <div className="panel-title">// NEW TASK</div>
          <div className="input-group">
            <label className="input-label">TASK TITLE</label>
            <input className="input" placeholder="e.g. Submit OS assignment"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          <div className="two-col">
            <div className="input-group">
              <label className="input-label">DATE</label>
              <input type="date" className="input" value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div className="input-group">
              <label className="input-label">TIME</label>
              <input type="time" className="input" value={form.time}
                onChange={e => setForm(f => ({ ...f, time: e.target.value }))} />
            </div>
          </div>
          <div className="input-group">
            <label className="input-label">REMINDER (minutes before)</label>
            <select className="input" value={form.reminder}
              onChange={e => setForm(f => ({ ...f, reminder: parseInt(e.target.value) }))}>
              {[5, 10, 15, 30, 60].map(m => <option key={m} value={m}>{m} minutes before</option>)}
            </select>
          </div>
          <div className="input-group">
            <label className="input-label">COLOR TAG</label>
            <div className="color-picker">
              {COLORS.map(c => (
                <div key={c} className={`color-swatch ${form.color === c ? "sel" : ""}`}
                  style={{ background: c }}
                  onClick={() => setForm(f => ({ ...f, color: c }))} />
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-primary" onClick={handleAdd}>ADD TASK</button>
            <button className="btn btn-ghost" onClick={() => setShowAdd(false)}>CANCEL</button>
          </div>
        </div>
      )}

      {loading && <div className="no-items">Loading tasks…</div>}
      {!loading && tasks.length === 0 && (
        <div className="no-items">No tasks yet. Add your first task.</div>
      )}

      {pending.length > 0 && (
        <>
          <div style={{ fontSize: 14, letterSpacing: 2, color: "#475569", marginBottom: 12 }}>PENDING</div>
          {pending.map(task => {
            const isOverdue = task.date && task.time &&
              new Date(`${task.date}T${task.time}`) < new Date();
            return (
              <div key={task.id} className="task-card"
                style={{
                  borderColor: task._highlight ? "#6366f1" : isOverdue ? "#ef444422" : "#ffffff0d",
                  boxShadow: task._highlight ? "0 0 12px #6366f133" : "none",
                }}>
                <div className="task-dot" style={{ background: task.color }} />
                <div style={{ flex: 1 }}>
                  <div className="task-title">{task.title}</div>
                  <div className="task-meta">
                    {task.date && <span>{task.date}</span>}
                    {task.time && <span> · {task.time}</span>}
                    {task.date && <span> · 🔔 {task.reminder}min</span>}
                    {isOverdue && <span style={{ color: "#ef4444", marginLeft: 8 }}>OVERDUE</span>}
                    {task._highlight && <span style={{ color: "#6366f1", marginLeft: 8 }}>⚡ REMINDER DUE</span>}
                  </div>
                </div>
                <button className="task-check" onClick={() => handleDone(task)}>✓</button>
                <button className="delete-btn" onClick={() => handleDelete(task.id)}>✕</button>
              </div>
            );
          })}
        </>
      )}

      {completed.length > 0 && (
        <>
          <div style={{ fontSize: 14, letterSpacing: 2, color: "#334155", margin: "28px 0 12px" }}>COMPLETED</div>
          {completed.map(task => (
            <div key={task.id} className="task-card" style={{ opacity: 0.45 }}>
              <div className="task-dot" style={{ background: task.color, opacity: 0.4 }} />
              <div style={{ flex: 1 }}>
                <div className="task-title" style={{ textDecoration: "line-through", color: "#475569" }}>
                  {task.title}
                </div>
                <div className="task-meta">{task.date} {task.time}</div>
              </div>
              <button className="task-check" style={{ background: "#10b981", borderColor: "#10b981" }}
                onClick={() => handleDone(task)}>✓</button>
              <button className="delete-btn" onClick={() => handleDelete(task.id)}>✕</button>
            </div>
          ))}
        </>
      )}
    </>
  );
}
