"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import ReportForm from "../components/ReportForm";
import SiteCheck from "../components/SiteCheck";

const FloodMap = dynamic(() => import("../components/FloodMap"), {
  ssr: false,
  loading: () => <p style={{ padding: 20 }}>Loading map…</p>,
});

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function Home() {
  const [pred, setPred] = useState({ areas: [], rain_source: "", note: "" });
  const [reports, setReports] = useState([]);
  const [hotspots, setHotspots] = useState([]);
  const [picked, setPicked] = useState(null);
  const [zones, setZones] = useState([]);
  const [siteResult, setSiteResult] = useState(null);
  const [error, setError] = useState(null);
  const [layers, setLayers] = useState({ zones: true, risk: true, hotspots: true, reports: true });

  const load = useCallback(async () => {
    try {
      const [p, r, h] = await Promise.all([
        fetch(`${API}/predictions`).then((x) => x.json()),
        fetch(`${API}/reports`).then((x) => x.json()),
        fetch(`${API}/hotspots`).then((x) => x.json()),
      ]);
      setPred(p);
      setReports(r);
      setHotspots(h);
      setError(null);
      try {
        const z = await fetch(`${API}/risk-zones`).then((x) => x.json());
        setZones(Array.isArray(z.areas) ? z.areas : []);
      } catch {
        setZones([]);
      }
    } catch {
      setError("Cannot reach the flood data server. Start the backend on port 8000.");
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [load]);

  const toggle = (k) => setLayers((l) => ({ ...l, [k]: !l[k] }));

  return (
    <main className="app">
      <section className="panel">
        <h1>Pwani Flood Watch</h1>
        <p className="sub">Flood risk and reports along the Kenyan coast.</p>
        <p className="warn">
          {pred.rain_source === "unavailable"
            ? "Rainfall forecast is unavailable right now, so risk uses terrain and flood history only. "
            : ""}
          Risk levels are estimates, not guarantees. Follow county and Kenya Met Department warnings.
        </p>
        {error && <p className="msg err" role="alert">{error}</p>}

        <div className="layers">
          {[["zones", "Risk zones (long-term)"], ["risk", "3-day forecast"],["hotspots", "Hotspots"], ["reports", "Reports"]].map(([k, label]) => (
            <label key={k}>
              <input type="checkbox" checked={layers[k]} onChange={() => toggle(k)} /> {label}
            </label>
          ))}
        </div>

        <h2>Likely to flood in the next 3 days</h2>
        <ul className="list">
          {pred.areas.slice(0, 6).map((a) => (
            <li key={a.id}>
              <span>{a.name}<small>{a.county} · {a.rain_mm_3day} mm forecast</small></span>
              <span className={`pill ${a.level}`}>{a.level}</span>
            </li>
          ))}
        </ul>

        <h2>Key hotspots</h2>
        <ul className="list">
          {hotspots.slice(0, 6).map((h) => (
            <li key={h.id}>
              <span>{h.name}<small>{h.past_events} past events · {h.recent_reports} recent reports</small></span>
            </li>
          ))}
          {hotspots.length === 0 && <li>No hotspots yet.</li>}
        </ul>

        <h2>Is this place safe?</h2>
        <SiteCheck picked={picked} onPick={setPicked} apiUrl={API} onResult={setSiteResult} />

        <h2>Report flooding</h2>
        <ReportForm picked={picked} onPick={setPicked} apiUrl={API} onSubmitted={load} />
      </section>

      <section className="map-wrap">
        <FloodMap
          predictions={pred.areas}
          reports={reports}
          hotspots={hotspots}
          picked={picked}
          onPick={setPicked}
          layers={layers}
          zones={zones}
          searchRadiusKm={siteResult ? 5 : null}
        />
        <div className="legend" aria-label="Map legend">
          <span style={{ "--c": "#c8452d" }}>High risk</span>
          <span style={{ "--c": "#e0a93b" }}>Medium risk</span>
          <span style={{ "--c": "#7fa99b" }}>Low risk</span>
          <span style={{ "--c": "#3b7ea1" }}>Community report</span>
          <small>Dashed zones = long-term risk. Solid circles = next 3 days.</small>
        </div>
      </section>
    </main>
  );
}
