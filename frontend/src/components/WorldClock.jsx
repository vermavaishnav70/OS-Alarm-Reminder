// src/components/WorldClock.jsx
import { useState, useEffect } from "react";
import { clockApi } from "../api/client";

export default function WorldClock() {
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const data = await clockApi.world();
      setZones(data);
    } finally {
      setLoading(false);
    }
  };

  // Poll every second (backend reads from Python's zoneinfo / datetime)
  useEffect(() => {
    load();
    const interval = setInterval(load, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <div className="section-hdr">
        <div className="section-title">World Clock</div>
        <span style={{ fontSize: 13, color: "#475569", letterSpacing: 2 }}>
          LIVE · PYTHON ZONEINFO · {zones.length} ZONES
        </span>
      </div>

      {loading && <div className="no-items">Loading world clock…</div>}

      <div className="zone-grid">
        {zones.map(z => (
          <div key={z.city} className="zone-card"
            style={{ borderColor: z.is_day ? "#f59e0b0a" : "#6366f10a" }}>
            <div className="zone-city">{z.is_day ? "☀" : "🌙"} {z.city.toUpperCase()}</div>
            <div className="zone-time">{z.time12}</div>
            <div className="zone-date">{z.date}</div>
            <div style={{ fontSize: 12, color: "#334155", marginTop: 6, letterSpacing: 1 }}>
              {z.tz}  UTC{z.offset.replace("00", "").replace("+0", "+").replace("-0", "-")}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
