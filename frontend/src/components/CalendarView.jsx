// src/components/CalendarView.jsx
import { useState } from "react";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const pad = n => String(n).padStart(2, "0");

function getDaysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDay(y, m) { return new Date(y, m, 1).getDay(); }

export default function CalendarView({ tasks, onAddTaskForDay }) {
  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [selDay, setSelDay] = useState(null);

  const calDays = getDaysInMonth(calYear, calMonth);
  const firstDay = getFirstDay(calYear, calMonth);
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  const selDateStr = selDay
    ? `${calYear}-${pad(calMonth + 1)}-${pad(selDay)}`
    : null;

  const dayTasks = selDateStr ? tasks.filter(t => t.date === selDateStr) : [];
  const taskDates = new Set(tasks.map(t => t.date));

  const prevMonth = () => {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
    else setCalMonth(m => m - 1);
    setSelDay(null);
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
    else setCalMonth(m => m + 1);
    setSelDay(null);
  };

  return (
    <div className="cal-layout">
      {/* Left: calendar grid */}
      <div>
        <div className="panel">
          <div className="cal-nav">
            <button className="cal-nav-btn" onClick={prevMonth}>‹</button>
            <div className="cal-month-label">{MONTHS[calMonth]} {calYear}</div>
            <button className="cal-nav-btn" onClick={nextMonth}>›</button>
            <button className="cal-nav-btn"
              onClick={() => { setCalYear(today.getFullYear()); setCalMonth(today.getMonth()); setSelDay(null); }}>
              TODAY
            </button>
          </div>

          <div className="cal-grid">
            {DAYS.map(d => <div key={d} className="cal-day-hdr">{d}</div>)}
            {Array(firstDay).fill(null).map((_, i) => <div key={`e${i}`} className="cal-day empty" />)}
            {Array(calDays).fill(null).map((_, i) => {
              const day = i + 1;
              const dateStr = `${calYear}-${pad(calMonth + 1)}-${pad(day)}`;
              const isToday = dateStr === todayStr;
              const isSel = selDay === day;
              const hasTasks = taskDates.has(dateStr);
              return (
                <div key={day}
                  className={[
                    "cal-day",
                    isToday && !isSel ? "today" : "",
                    isSel ? "selected" : "",
                    hasTasks && !isSel ? "has-task" : "",
                  ].join(" ")}
                  onClick={() => setSelDay(day === selDay ? null : day)}>
                  {day}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right: selected day */}
      <div>
        <div className="panel" style={{ minHeight: 220 }}>
          <div className="panel-title">
            {selDateStr
              ? `// ${new Date(selDateStr + "T12:00").toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric" }).toUpperCase()}`
              : "// SELECT A DATE"}
          </div>

          {selDateStr && dayTasks.length === 0 && (
            <div style={{ color: "#334155", fontSize: 14, letterSpacing: 1 }}>No tasks this day.</div>
          )}

          {dayTasks.map(t => (
            <div key={t.id} style={{
              marginBottom: 12, padding: "12px", background: "#0a0a0f",
              borderRadius: 2, borderLeft: `3px solid ${t.color}`,
            }}>
              <div style={{
                fontSize: 15,
                color: t.done ? "#475569" : "#e2e8f0",
                textDecoration: t.done ? "line-through" : "none",
              }}>{t.title}</div>
              <div style={{ fontSize: 13, color: "#475569", marginTop: 4, letterSpacing: 1 }}>
                {t.time || "No time"} · 🔔 {t.reminder}min reminder
                {t.done ? " · ✓ DONE" : ""}
              </div>
            </div>
          ))}

          {!selDateStr && (
            <div style={{ color: "#334155", fontSize: 14, letterSpacing: 1, marginTop: 8 }}>
              Click any day to see or add tasks.
            </div>
          )}

          {selDateStr && (
            <button className="btn btn-ghost" style={{ width: "100%", marginTop: 12 }}
              onClick={() => onAddTaskForDay(selDateStr)}>
              + ADD TASK ON THIS DAY
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
