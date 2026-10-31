# Pwani Flood Watch

Coastal Kenya flood map: predicted risk, community reports, and hotspots.
Next.js (React) frontend + FastAPI (Python) backend.

## Run the backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
API docs: http://localhost:8000/docs

## Run the frontend
```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```
Open http://localhost:3000

## What is real and what is a placeholder
- Rainfall: live 3-day forecast from Open-Meteo (no key needed).
- `backend/data.py`: elevation, distance to water and past flood counts are
  STARTER ESTIMATES. Replace them with real data before trusting the scores.
- `backend/risk.py`: rule-based score (rain 50%, history 20%, elevation 15%,
  water proximity 15%). Replace with a trained model once you have labelled flood data.

## Next steps
1. Add ward/sub-county boundary polygons (GeoJSON) and colour areas instead of circles.
2. Replace starter values with DEM elevation + OSM river distance + real flood history.
3. Train a Random Forest / Gradient Boosting model on historical flood events.
4. SMS/USSD reporting and alerts (Africa's Talking).
5. Move SQLite to PostgreSQL/PostGIS and add report moderation.
