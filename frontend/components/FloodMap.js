"use client";
import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { MapContainer, TileLayer, Circle, CircleMarker, Popup, useMap, useMapEvents } from "react-leaflet";

const COLORS = { low: "#7fa99b", medium: "#e0a93b", high: "#c8452d" };
const DEPTH = { ankle: "Ankle deep", knee: "Knee deep", waist: "Waist deep", above_waist: "Above waist" };

function PickLocation({ onPick }) {
  useMapEvents({ click: (e) => onPick({ lat: e.latlng.lat, lon: e.latlng.lng }) });
  return null;
}

function FlyToPicked({ picked }) {
  const map = useMap();
  const lat = picked?.lat;
  const lon = picked?.lon;
  useEffect(() => {
    if (lat == null || lon == null) return;
    map.flyTo([lat, lon], Math.max(map.getZoom(), 12));
  }, [lat, lon, map]);
  return null;
}

export default function FloodMap({ predictions, reports, hotspots, picked, onPick, layers, zones, searchRadiusKm }) {
  return (
    <MapContainer center={[-3.3, 39.9]} zoom={7} style={{ height: "100%", width: "100%" }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <PickLocation onPick={onPick} />

      <FlyToPicked picked={picked} />

      {layers.zones &&
        (zones || []).map((z) => (
          <Circle
            key={`zone-${z.id}`}
            center={[z.lat, z.lon]}
            radius={z.radius_m || 5000}
            pathOptions={{ color: COLORS[z.level], fillColor: COLORS[z.level], fillOpacity: 0.25, weight: 2, dashArray: "6 6" }}
          >
            <Popup>
              <strong>{z.name}</strong>, {z.county}
              <br />
              Long-term risk: {z.level} ({z.score})
            </Popup>
          </Circle>
        ))}

      {layers.risk &&
        predictions.map((a) => (
          <Circle
            key={a.id}
            center={[a.lat, a.lon]}
            radius={9000}
            pathOptions={{ color: COLORS[a.level], fillColor: COLORS[a.level], fillOpacity: 0.4, weight: 2 }}
          >
            <Popup>
              <strong>{a.name}</strong>, {a.county}
              <br />
              Risk: {a.level} ({a.score})
              <br />
              3-day rain forecast: {a.rain_mm_3day} mm
            </Popup>
          </Circle>
        ))}

      {layers.hotspots &&
        hotspots.map((h) => (
          <CircleMarker
            key={h.id}
            center={[h.lat, h.lon]}
            radius={10 + Math.min(h.score, 10) * 2}
            pathOptions={{ color: "#12263a", weight: 2, dashArray: "4 4", fill: false }}
          >
            <Popup>
              <strong>{h.name} hotspot</strong>
              <br />
              Past flood events: {h.past_events}
              <br />
              Reports in last 72 h: {h.recent_reports}
            </Popup>
          </CircleMarker>
        ))}

      {layers.reports &&
        reports.map((r) => (
          <CircleMarker
            key={r.id}
            center={[r.lat, r.lon]}
            radius={6}
            pathOptions={{ color: "#fff", weight: 1.5, fillColor: "#3b7ea1", fillOpacity: 1 }}
          >
            <Popup>
              <strong>{DEPTH[r.depth]}</strong>
              <br />
              {r.note}
              <br />
              <small>{new Date(r.created_at).toLocaleString()}</small>
            </Popup>
          </CircleMarker>
        ))}

      {picked && searchRadiusKm && (
        <Circle
          center={[picked.lat, picked.lon]}
          radius={searchRadiusKm * 1000}
          pathOptions={{ color: "#12263a", weight: 1, fillColor: "#12263a", fillOpacity: 0.05, interactive: false }}
        />
      )}

      {picked && (
        <CircleMarker
          center={[picked.lat, picked.lon]}
          radius={9}
          pathOptions={{ color: "#12263a", weight: 3, fillColor: "#fff", fillOpacity: 1 }}
        />
      )}
    </MapContainer>
  );
}
