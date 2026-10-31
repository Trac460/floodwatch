"use client";
import { useEffect, useState } from "react";

const DEPTH = { ankle: "Ankle deep", knee: "Knee deep", waist: "Waist deep", above_waist: "Above waist" };
const FACTORS = [
  ["elevation", "Elevation"],
  ["water", "Water proximity"],
  ["history", "Flood history"],
];

function relDate(iso) {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const mins = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs} h ago`;
  return `${Math.round(hrs / 24)} days ago`;
}

function pct(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.round(Math.min(1, Math.max(0, n <= 1 ? n : n / 100)) * 100);
}

export default function SiteCheck({ picked, onPick, apiUrl, onResult }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searchErr, setSearchErr] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  // Clear stale result when the picked point changes.
  const key = picked ? `${picked.lat},${picked.lon}` : "";
  useEffect(() => {
    setData(null);
    setError(null);
    onResult(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  async function search(e) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setSearchErr(null);
    setResults(null);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=ke&q=${encodeURIComponent(q)}`
      );
      if (!res.ok) throw new Error();
      setResults(await res.json());
    } catch {
      setSearchErr("Place search failed. Try again, or tap the map.");
    } finally {
      setSearching(false);
    }
  }

  function choose(r) {
    onPick({ lat: parseFloat(r.lat), lon: parseFloat(r.lon) });
    setResults(null);
  }

  function useMyLocation() {
    if (!navigator.geolocation) return setSearchErr("Location is not available in this browser.");
    navigator.geolocation.getCurrentPosition(
      (p) => onPick({ lat: p.coords.latitude, lon: p.coords.longitude }),
      () => setSearchErr("Could not get your location. Search or tap the map instead.")
    );
  }

  async function check() {
    if (!picked) return;
    setLoading(true);
    setError(null);
    setData(null);
    onResult(null);
    try {
      const res = await fetch(`${apiUrl}/site-check?lat=${picked.lat}&lon=${picked.lon}&radius_km=5`);
      if (!res.ok) throw new Error();
      const d = await res.json();
      setData(d);
      onResult(d);
    } catch {
      setError("Could not check this location. Is the server running?");
    } finally {
      setLoading(false);
    }
  }

  const verdictLevel = data?.verdict?.level || "unknown";
  const reports = data?.nearby_reports || [];

  return (
    <div className="sitecheck">
      <form onSubmit={search} className="plain">
        <label htmlFor="place-q" className="sr">Search for a place in Kenya</label>
        <div className="row">
          <input
            id="place-q"
            type="search"
            placeholder="Search a place, e.g. Mombasa Nyali"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit" disabled={searching || !query.trim()}>{searching ? "…" : "Search"}</button>
        </div>
      </form>
      {searchErr && <p className="msg err" role="alert">{searchErr}</p>}
      {results && results.length === 0 && <p className="msg" role="status">No places found.</p>}
      {results && results.length > 0 && (
        <ul className="results" aria-label="Search results">
          {results.map((r) => (
            <li key={r.place_id}>
              <button type="button" className="ghost" onClick={() => choose(r)}>{r.display_name}</button>
            </li>
          ))}
        </ul>
      )}

      <p className="msg">
        {picked
          ? `Location set: ${picked.lat.toFixed(4)}, ${picked.lon.toFixed(4)}`
          : "Search a place, tap the map, or use your location."}
      </p>
      <div className="row">
        <button type="button" className="ghost" onClick={useMyLocation}>Use my location</button>
        <button type="button" onClick={check} disabled={!picked || loading}>
          {loading ? "Checking…" : "Check this location"}
        </button>
      </div>

      {loading && <p className="msg" role="status">Checking flood risk…</p>}
      {error && <p className="msg err" role="alert">{error}</p>}

      {data && (
        <div className="result" role="status">
          <div className={`verdict ${verdictLevel}`}>{data.verdict?.text || "No verdict available for this location."}</div>

          {data.nearest_area && (
            <p className="msg">
              Nearest area: <strong>{data.nearest_area.name}</strong>, {data.nearest_area.county} (
              {Number(data.nearest_area.distance_km).toFixed(1)} km away)
            </p>
          )}
          {data.in_coverage === false && (
            <p className="msg">This location is outside our mapped coverage, so results are limited.</p>
          )}

          {(data.long_term || data.forecast) && (
            <div className="compare">
              {data.long_term && (
                <span>Long-term <span className={`pill ${data.long_term.level}`}>{data.long_term.level}</span></span>
              )}
              {data.forecast && (
                <span>3-day forecast <span className={`pill ${data.forecast.level}`}>{data.forecast.level}</span></span>
              )}
            </div>
          )}
          {data.forecast && data.forecast.rain_mm_3day != null && (
            <p className="msg">Expected rain, next 3 days: {data.forecast.rain_mm_3day} mm</p>
          )}

          {data.long_term?.factors && (
            <div className="factors">
              {FACTORS.map(([k, label]) =>
                data.long_term.factors[k] == null ? null : (
                  <div key={k} className="factor">
                    <span>{label}</span>
                    <div className="bar" role="img" aria-label={`${label}: ${pct(data.long_term.factors[k])}%`}>
                      <i style={{ width: `${pct(data.long_term.factors[k])}%` }} />
                    </div>
                  </div>
                )
              )}
            </div>
          )}

          <p className="msg">
            Community reports within 5 km: {data.nearby_reports_count ?? reports.length}
          </p>
          {reports.length > 0 && (
            <ul className="list">
              {reports.slice(0, 3).map((r) => (
                <li key={r.id}>
                  <span>{DEPTH[r.depth] || r.depth}<small>{relDate(r.created_at)} · {Number(r.distance_km).toFixed(1)} km away</small></span>
                </li>
              ))}
            </ul>
          )}

          <p className="disclaimer">
            {data.disclaimer || "This is an estimate, not a guarantee. Follow county and Kenya Met Department warnings."}
          </p>
        </div>
      )}
    </div>
  );
}
