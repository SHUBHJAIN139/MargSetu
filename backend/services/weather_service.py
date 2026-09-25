"""Weather Service (weatherService) for MargSetu.

PRD Reference: PRD v2.0 §3 (Atmospheric Data Aggregation & Deterministic Fallback)
Authority Integrity: NDMA is the ONLY authority named.
Disclaimer: SIMULATION — not connected to official NDMA systems.
"""

from typing import Dict, List, Optional
from models.schemas import (
    AUTHORITY_NOTICE,
    HonestyLabel,
    WeatherData,
    GeoLocation,
)


class WeatherService:
    """Aggregates corridor atmospheric data with static verified fallbacks."""

    def __init__(self, baseline_weather: Optional[List[Dict]] = None):
        self._cache: Dict[str, WeatherData] = {}
        if baseline_weather:
            for w in baseline_weather:
                station = w.get("station_name", "Unknown")
                self._cache[station] = WeatherData(**w)

    def get_weather_for_station(self, station_name: str) -> Optional[WeatherData]:
        """Fetch cached or static weather for a corridor weather station."""
        return self._cache.get(station_name)

    def get_all_stations(self) -> List[WeatherData]:
        """Return all monitored station observations."""
        return list(self._cache.values())
