import asyncio
import logging
import math
import sqlite3
import time
from collections import defaultdict
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Literal, Optional

import httpx
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from data import AREAS
from risk import level_for, score_area, static_level_for, static_score_area

logger = logging.getLogger("floodwatch")

DB_PATH = "floodwatch.db"
OPEN_METEO = "https://api.open-meteo.com/v1/forecast"

# Rough bounding box of the Kenyan coast
LAT_MIN, LAT_MAX = -4.9, -1.3
LON_MIN, LON_MAX = 38.8, 41.6


def db() -> sqlite3.Connection:
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    return con


@asynccontextmanager
async def lifespan(_: FastAPI):
    with db() as con:
        con.execute(
            """CREATE TABLE IF NOT EXISTS reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                lat REAL NOT NULL, lon REAL NOT NULL,
                depth TEXT NOT NULL, note TEXT,
                created_at TEXT NOT NULL)"""
        )
    yield


app = FastAPI(title="Pwani Flood Watch API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- helpers ----------
def haversine_km(lat1, lon1, lat2, lon2) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


_rain_cache: dict = {"ts": 0.0, "data": {}}


async def get_rain() -> tuple[dict, bool]:
    """3-day forecast rainfall (mm) per area from Open-Meteo. Returns (data, ok)."""
    if _rain_cache["data"] and time.time() - _rain_cache["ts"] < 1800:
        return _rain_cache["data"], True
    params = {
        "latitude": ",".join(str(a["lat"]) for a in AREAS),
        "longitude": ",".join(str(a["lon"]) for a in AREAS),
        "daily": "precipitation_sum",
        "forecast_days": 3,
        "timezone": "Africa/Nairobi",
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(OPEN_METEO, params=params)
            r.raise_for_status()
        payload = r.json()
        if isinstance(payload, dict):
            payload = [payload]
        data = {
            a["id"]: sum(v or 0 for v in p["daily"]["precipitation_sum"])
            for a, p in zip(AREAS, payload)
        }
        _rain_cache.update(ts=time.time(), data=data)
        return data, True
    except Exception:
        logger.exception("Open-Meteo rain fetch failed")
        return {a["id"]: 0.0 for a in AREAS}, False


_hits: dict[str, list[float]] = defaultdict(list)


def rate_limit(ip: str, max_per_hour: int = 5):
    now = time.time()
    _hits[ip] = [t for t in _hits[ip] if now - t < 3600]
    if len(_hits[ip]) >= max_per_hour:
        raise HTTPException(429, "Too many reports from this device. Try again later.")
    _hits[ip].append(now)


# ---------- models ----------
class ReportIn(BaseModel):
    lat: float
    lon: float
    depth: Literal["ankle", "knee", "waist", "above_waist"]
    note: Optional[str] = Field(default=None, max_length=280)


# ---------- routes ----------
@app.get("/health")
def health():
    return {"ok": True}


@app.post("/reports", status_code=201)
def create_report(body: ReportIn, request: Request):
    if not (LAT_MIN <= body.lat <= LAT_MAX and LON_MIN <= body.lon <= LON_MAX):
        raise HTTPException(422, "Location is outside the Kenyan coast area.")
    rate_limit(request.client.host if request.client else "unknown")
    now = datetime.now(timezone.utc).isoformat()
    with db() as con:
        cur = con.execute(
            "INSERT INTO reports (lat, lon, depth, note, created_at) VALUES (?,?,?,?,?)",
            (body.lat, body.lon, body.depth, body.note, now),
        )
    return {"id": cur.lastrowid, "created_at": now}


@app.get("/reports")
def list_reports(hours: int = Query(72, ge=1, le=720)):
    since = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
    with db() as con:
        rows = con.execute(
            "SELECT * FROM reports WHERE created_at >= ? ORDER BY created_at DESC LIMIT 500",
            (since,),
        ).fetchall()
    return [dict(r) for r in rows]


@app.get("/predictions")
async def predictions():
    rain, rain_ok = await get_rain()
    out = []
    for a in AREAS:
        score, factors = score_area(a, rain[a["id"]])
        out.append({
            "id": a["id"], "name": a["name"], "county": a["county"],
            "lat": a["lat"], "lon": a["lon"],
            "rain_mm_3day": round(rain[a["id"]], 1),
            "score": score, "level": level_for(score), "factors": factors,
        })
    out.sort(key=lambda x: x["score"], reverse=True)
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "rain_source": "open-meteo" if rain_ok else "unavailable",
        "note": "Risk estimates, not guarantees. Starter terrain/history values are approximate.",
        "areas": out,
    }


@app.get("/risk-zones")
def risk_zones():
    out = []
    for a in AREAS:
        score, factors = static_score_area(a)
        out.append({
            "id": a["id"], "name": a["name"], "county": a["county"],
            "lat": a["lat"], "lon": a["lon"], "radius_m": 9000,
            "score": score, "level": static_level_for(score), "factors": factors,
        })
    out.sort(key=lambda x: x["score"], reverse=True)
    return {
        "note": "Long-term susceptibility estimates (terrain, water proximity, flood history). "
                "Excludes current rain. Starter values are approximate.",
        "areas": out,
    }


DISCLAIMER = (
    "Indicative estimate only based on approximate data. "
    "Get a professional site assessment before renting or building."
)
_LEVELS = ["low", "medium", "high"]
_VERDICT_LABEL = {"low": "safe-ish", "medium": "caution", "high": "high-risk"}


def _nearby_reports(lat: float, lon: float, radius_km: float, hours: int = 720) -> list[dict]:
    since = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
    with db() as con:
        rows = con.execute(
            "SELECT * FROM reports WHERE created_at >= ? ORDER BY created_at DESC",
            (since,),
        ).fetchall()
    out = []
    for r in rows:
        d = haversine_km(lat, lon, r["lat"], r["lon"])
        if d <= radius_km:
            out.append({**dict(r), "distance_km": round(d, 1), "_d": d})
    return out


def _is_recent(created_at: str, hours: int) -> bool:
    try:
        ts = datetime.fromisoformat(created_at)
    except (TypeError, ValueError):
        return False
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    return ts >= datetime.now(timezone.utc) - timedelta(hours=hours)


@app.get("/site-check")
async def site_check(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
    radius_km: float = Query(5.0, ge=1, le=25),
):
    in_coverage = LAT_MIN <= lat <= LAT_MAX and LON_MIN <= lon <= LON_MAX
    nearest = min(AREAS, key=lambda a: haversine_km(lat, lon, a["lat"], a["lon"]))
    dist = haversine_km(lat, lon, nearest["lat"], nearest["lon"])

    s_score, s_factors = static_score_area(nearest)
    s_level = static_level_for(s_score)

    rain, rain_ok = await get_rain()
    rain_mm = rain.get(nearest["id"], 0.0)
    f_score, _ = score_area(nearest, rain_mm)
    f_level = level_for(f_score)

    reports = _nearby_reports(lat, lon, radius_km)
    count = len(reports)
    serious = any(
        r["depth"] in ("waist", "above_waist") and r["_d"] <= 2 and _is_recent(r["created_at"], 72)
        for r in reports
    )

    if not in_coverage:
        verdict = {
            "level": "unknown",
            "text": "This location is outside the Kenyan coast coverage area, so no estimate is available.",
        }
    elif dist > 25:
        verdict = {
            "level": "unknown",
            "text": f"No nearby data: the closest covered area, {nearest['name']}, is {dist:.0f} km away.",
        }
    else:
        idx = max(_LEVELS.index(s_level), _LEVELS.index(f_level))
        bumped = count >= 3 or serious
        if bumped:
            idx = min(idx + 1, 2)
        level = _LEVELS[idx]
        if bumped and serious:
            reason = "recent reports of waist-deep or deeper flooding within 2 km"
        elif bumped:
            reason = f"{count} flood reports nearby"
        elif _LEVELS.index(f_level) > _LEVELS.index(s_level):
            reason = "heavy rain in the forecast"
        elif s_level == "low":
            reason = "its terrain, water proximity and flood history look favourable"
        else:
            reason = "its long-term flood susceptibility (low elevation, nearby water or past floods)"
        label = _VERDICT_LABEL[level]
        text = (
            f"Nearest area is {nearest['name']}, {nearest['county']} ({dist:.1f} km away); "
            f"rated {label} mainly because of {reason}."
        )
        verdict = {"level": label, "text": text}

    shown = [
        {k: r[k] for k in ("id", "lat", "lon", "depth", "note", "created_at", "distance_km")}
        for r in reports[:20]
    ]
    return {
        "lat": lat,
        "lon": lon,
        "in_coverage": in_coverage,
        "nearest_area": {
            "id": nearest["id"], "name": nearest["name"], "county": nearest["county"],
            "distance_km": round(dist, 1),
        },
        "long_term": {"score": s_score, "level": s_level, "factors": s_factors},
        "forecast": {
            "score": f_score, "level": f_level,
            "rain_mm_3day": round(rain_mm, 1),
            "rain_source": "open-meteo" if rain_ok else "unavailable",
        },
        "nearby_reports": shown,
        "nearby_reports_count": count,
        "verdict": verdict,
        "disclaimer": DISCLAIMER,
    }


@app.get("/hotspots")
def hotspots(hours: int = Query(72, ge=1, le=720), radius_km: float = 5.0):
    reports = list_reports(hours)
    out = []
    for a in AREAS:
        live = sum(
            1 for r in reports
            if haversine_km(a["lat"], a["lon"], r["lat"], r["lon"]) <= radius_km
        )
        score = a["past_events"] + 2 * live
        if score >= 3:
            out.append({
                "id": a["id"], "name": a["name"], "county": a["county"],
                "lat": a["lat"], "lon": a["lon"],
                "past_events": a["past_events"], "recent_reports": live,
                "score": score,
            })
    out.sort(key=lambda x: x["score"], reverse=True)
    return out
