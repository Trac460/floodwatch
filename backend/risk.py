"""Rule-based flood risk score (version 1). Swap for an ML model later."""

WEIGHTS = {"rain": 0.50, "elevation": 0.15, "water": 0.15, "history": 0.20}


def score_area(area: dict, rain_mm_3day: float) -> tuple[float, dict]:
    factors = {
        "rain": min(rain_mm_3day / 120.0, 1.0),                 # 120 mm / 3 days = saturated
        "elevation": max(0.0, 1.0 - area["elevation_m"] / 40.0), # lower = riskier
        "water": max(0.0, 1.0 - area["dist_water_km"] / 10.0),   # closer to water = riskier
        "history": min(area["past_events"] / 5.0, 1.0),
    }
    score = sum(WEIGHTS[k] * v for k, v in factors.items())
    return round(score, 2), {k: round(v, 2) for k, v in factors.items()}


def level_for(score: float) -> str:
    if score >= 0.60:
        return "high"
    if score >= 0.35:
        return "medium"
    return "low"


_STATIC_KEYS = ("elevation", "water", "history")


def static_score_area(area: dict) -> tuple[float, dict]:
    """Long-term susceptibility without rain: weights renormalised to sum to 1."""
    _, factors = score_area(area, 0.0)
    factors = {k: factors[k] for k in _STATIC_KEYS}
    total = sum(WEIGHTS[k] for k in _STATIC_KEYS)
    score = sum(WEIGHTS[k] / total * v for k, v in factors.items())
    return round(score, 2), factors


def static_level_for(score: float) -> str:
    if score >= 0.55:
        return "high"
    if score >= 0.30:
        return "medium"
    return "low"
