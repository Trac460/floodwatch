"""
Starter coastal areas.

IMPORTANT: elevation_m, dist_water_km and past_events are rough STARTER ESTIMATES
so the app runs end to end. Replace them with real values:
  - elevation: sample an SRTM / Copernicus DEM at each point
  - dist_water_km: distance to nearest river/shoreline (OpenStreetMap)
  - past_events: count from Kenya Red Cross, OCHA/ReliefWeb, county reports
"""
AREAS = [
    {"id": "mombasa-island", "name": "Mombasa Island", "county": "Mombasa", "lat": -4.0435, "lon": 39.6682, "elevation_m": 8,  "dist_water_km": 0.3, "past_events": 4},
    {"id": "likoni",         "name": "Likoni",         "county": "Mombasa", "lat": -4.0833, "lon": 39.6667, "elevation_m": 12, "dist_water_km": 0.8, "past_events": 3},
    {"id": "changamwe",      "name": "Changamwe",      "county": "Mombasa", "lat": -3.9955, "lon": 39.6240, "elevation_m": 15, "dist_water_km": 1.5, "past_events": 3},
    {"id": "kisauni",        "name": "Kisauni",        "county": "Mombasa", "lat": -3.9667, "lon": 39.7167, "elevation_m": 20, "dist_water_km": 2.0, "past_events": 2},
    {"id": "nyali",          "name": "Nyali",          "county": "Mombasa", "lat": -4.0200, "lon": 39.7150, "elevation_m": 18, "dist_water_km": 1.0, "past_events": 2},
    {"id": "mtwapa",         "name": "Mtwapa",         "county": "Kilifi",  "lat": -3.9333, "lon": 39.7333, "elevation_m": 14, "dist_water_km": 0.5, "past_events": 2},
    {"id": "kilifi-town",    "name": "Kilifi Town",    "county": "Kilifi",  "lat": -3.6305, "lon": 39.8499, "elevation_m": 15, "dist_water_km": 0.6, "past_events": 2},
    {"id": "malindi",        "name": "Malindi",        "county": "Kilifi",  "lat": -3.2192, "lon": 40.1169, "elevation_m": 10, "dist_water_km": 0.7, "past_events": 3},
    {"id": "ukunda",         "name": "Ukunda",         "county": "Kwale",   "lat": -4.2833, "lon": 39.5667, "elevation_m": 25, "dist_water_km": 2.5, "past_events": 1},
    {"id": "msambweni",      "name": "Msambweni",      "county": "Kwale",   "lat": -4.4700, "lon": 39.4800, "elevation_m": 20, "dist_water_km": 1.5, "past_events": 2},
    {"id": "hola",           "name": "Hola",           "county": "Tana River", "lat": -1.5000, "lon": 40.0333, "elevation_m": 30, "dist_water_km": 1.0, "past_events": 4},
    {"id": "garsen",         "name": "Garsen",         "county": "Tana River", "lat": -2.2700, "lon": 40.1100, "elevation_m": 8,  "dist_water_km": 0.5, "past_events": 5},
    {"id": "kipini",         "name": "Kipini",         "county": "Tana River", "lat": -2.5167, "lon": 40.5167, "elevation_m": 4,  "dist_water_km": 0.3, "past_events": 3},
    {"id": "mpeketoni",      "name": "Mpeketoni",      "county": "Lamu",    "lat": -2.3700, "lon": 40.8700, "elevation_m": 10, "dist_water_km": 4.0, "past_events": 1},
    {"id": "lamu-town",      "name": "Lamu Town",      "county": "Lamu",    "lat": -2.2717, "lon": 40.9020, "elevation_m": 3,  "dist_water_km": 0.1, "past_events": 2},
]
