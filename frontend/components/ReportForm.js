"use client";
import { useState } from "react";

const DEPTHS = [
  ["ankle", "Ankle deep"],
  ["knee", "Knee deep"],
  ["waist", "Waist deep"],
  ["above_waist", "Above waist"],
];

export default function ReportForm({ picked, onPick, apiUrl, onSubmitted }) {
  const [depth, setDepth] = useState("knee");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState(null); // {type, text}
  const [busy, setBusy] = useState(false);

  function useMyLocation() {
    if (!navigator.geolocation) return setStatus({ type: "err", text: "Location is not available in this browser." });
    navigator.geolocation.getCurrentPosition(
      (p) => onPick({ lat: p.coords.latitude, lon: p.coords.longitude }),
      () => setStatus({ type: "err", text: "Could not get your location. Tap the map instead." })
    );
  }

  async function submit(e) {
    e.preventDefault();
    if (!picked) return;
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch(`${apiUrl}/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...picked, depth, note: note || null }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(typeof body.detail === "string" ? body.detail : "Report could not be sent.");
      }
      setNote("");
      setStatus({ type: "ok", text: "Report sent." });
      onSubmitted();
    } catch (err) {
      setStatus({ type: "err", text: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <p className="msg">
        {picked
          ? `Location set: ${picked.lat.toFixed(4)}, ${picked.lon.toFixed(4)}`
          : "Tap the map where the flooding is, or use your location."}
      </p>
      <button type="button" className="ghost" onClick={useMyLocation}>Use my location</button>
      <fieldset>
        <legend>Water depth</legend>
        {DEPTHS.map(([v, label]) => (
          <label key={v}>
            <input type="radio" name="depth" value={v} checked={depth === v} onChange={() => setDepth(v)} />
            {label}
          </label>
        ))}
      </fieldset>
      <textarea
        rows={2}
        maxLength={280}
        placeholder="What is affected? (road, homes, market…)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        aria-label="Details"
      />
      <button type="submit" disabled={!picked || busy}>{busy ? "Sending…" : "Send flood report"}</button>
      {status && <p className={`msg ${status.type}`} role="status">{status.text}</p>}
    </form>
  );
}
