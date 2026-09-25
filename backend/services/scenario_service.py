"""Scenario Service (scenarioService) for MargSetu.

PRD Reference: PRD v2.0 §2 (API contract: POST /scenario/apply & POST /scenario/reset),
               §8 & §10 (Demo Controls & Simulation Harness),
               §11 (Acceptance Criteria 12: One-click reset restores exact baseline).
Authority Integrity: NDMA is the ONLY authority named anywhere.
Disclaimer: SIMULATION — not connected to official NDMA systems.
"""

from datetime import datetime, timezone
import json
from pathlib import Path
from typing import Any, Dict, List, Optional

from models.schemas import (
    AUTHORITY_NAME,
    AUTHORITY_NOTICE,
    GeoLocation,
    HonestyLabel,
    IncidentSubmission,
    IncidentType,
    ScenarioApplyRequest,
    ScenarioResetResponse,
    ScenarioStateResponse,
    VehicleType,
    WeatherData,
)
from services.report_service import ReportService
from services.risk_service import RiskService
from services.route_service import RouteService
from services.sos_service import SOSService
from services.weather_service import WeatherService


class ScenarioService:
    """Coordinates dynamic demo simulation controls and byte-identical baseline restoration."""

    BASELINE_RAINFALL_MM: float = 68.0  # Sonapur Tunnel monitoring station baseline
    BASELINE_SCENARIO_NAME: str = "baseline_northeast_monsoon"

    def __init__(
        self,
        reset_data: Dict[str, Any],
        weather_service: WeatherService,
        report_service: ReportService,
        risk_service: RiskService,
        route_service: RouteService,
        sos_service: SOSService,
    ):
        self.reset_data = reset_data
        self.weather_service = weather_service
        self.report_service = report_service
        self.risk_service = risk_service
        self.route_service = route_service
        self.sos_service = sos_service

        # Initialize to exact baseline state
        self.active_scenario_name: str = self.reset_data.get(
            "scenario_name", self.BASELINE_SCENARIO_NAME
        )
        self.rainfall_mm: float = self.BASELINE_RAINFALL_MM
        self.inject_hazard_sonapur: bool = False
        self.inject_hazard_haflong: bool = False
        self.ndma_override: bool = False
        self.season: str = "monsoon"
        self.simulated_fleet_positions: List[Dict[str, Any]] = []
        self.is_baseline: bool = True

    def get_active_vetoes(self) -> List[str]:
        """Compute which corridors are actively vetoed under current scenario parameters."""
        vetoes = []
        # C1 is blocked if explicit Sonapur hazard is injected,
        # OR if rainfall > 75mm (triggers slope 34° compound hazard veto),
        # OR if NDMA administrative override is active.
        if self.inject_hazard_sonapur or (self.rainfall_mm > 75.0) or self.ndma_override:
            vetoes.append("C1")

        # C2 is blocked if explicit Haflong hazard is injected,
        # OR if complete administrative shutdown is in effect.
        if self.inject_hazard_haflong or self.ndma_override:
            vetoes.append("C2")

        return vetoes

    def get_state(self) -> ScenarioStateResponse:
        """Return current real-time scenario simulation state."""
        return ScenarioStateResponse(
            active_scenario_name=self.active_scenario_name,
            rainfall_mm=self.rainfall_mm,
            inject_hazard_sonapur=self.inject_hazard_sonapur,
            inject_hazard_haflong=self.inject_hazard_haflong,
            ndma_override=self.ndma_override,
            season=self.season,
            is_baseline=self.is_baseline,
            active_corridor_vetoes=self.get_active_vetoes(),
            simulated_fleet_count=len(self.simulated_fleet_positions),
            authority=AUTHORITY_NAME,
            disclaimer=AUTHORITY_NOTICE,
            honesty_label=HonestyLabel.SIMULATION,
        )

    def apply_scenario(self, request: ScenarioApplyRequest) -> ScenarioStateResponse:
        """Dynamically apply scenario environmental and operational adjustments."""
        if request.rainfall_mm is not None:
            self.rainfall_mm = request.rainfall_mm
            # Dynamically propagate precipitation to weather stations
            for station in self.weather_service.get_all_stations():
                if "Sonapur" in station.station_name:
                    station.rainfall_24h_mm = self.rainfall_mm
                elif "Shillong" in station.station_name:
                    station.rainfall_24h_mm = max(10.0, self.rainfall_mm * 0.75)

        if request.inject_hazard_sonapur is not None:
            self.inject_hazard_sonapur = request.inject_hazard_sonapur

        if request.inject_hazard_haflong is not None:
            self.inject_hazard_haflong = request.inject_hazard_haflong

        if request.ndma_override is not None:
            self.ndma_override = request.ndma_override

        if request.season is not None:
            self.season = request.season

        if request.simulated_fleet_positions is not None:
            self.simulated_fleet_positions = request.simulated_fleet_positions

        # Check if state still matches exact baseline values
        self.is_baseline = (
            abs(self.rainfall_mm - self.BASELINE_RAINFALL_MM) < 1e-3
            and not self.inject_hazard_sonapur
            and not self.inject_hazard_haflong
            and not self.ndma_override
            and self.season == "monsoon"
            and len(self.simulated_fleet_positions) == 0
        )

        self.active_scenario_name = (
            self.BASELINE_SCENARIO_NAME if self.is_baseline else "custom_simulation_scenario"
        )

        return self.get_state()

    def reset_to_baseline(self) -> ScenarioResetResponse:
        """Execute one-click byte-identical reset restoring exact initial baseline state."""
        # 1. Reset scenario parameters
        self.rainfall_mm = self.BASELINE_RAINFALL_MM
        self.inject_hazard_sonapur = False
        self.inject_hazard_haflong = False
        self.ndma_override = False
        self.season = "monsoon"
        self.simulated_fleet_positions = []
        self.is_baseline = True
        self.active_scenario_name = self.reset_data.get(
            "scenario_name", self.BASELINE_SCENARIO_NAME
        )

        # 2. Reset WeatherService to verified static baseline stations
        baseline_weather = self.reset_data.get("baseline_weather", [])
        self.weather_service._cache.clear()
        for w in baseline_weather:
            station_name = w.get("station_name", "Unknown")
            self.weather_service._cache[station_name] = WeatherData(**w)

        # 3. Reset ReportService to verified static baseline incidents
        self.report_service._reports.clear()
        self.report_service._clusters.clear()
        self.report_service._audit_logs.clear()
        self.report_service._landmark_counters.clear()
        baseline_incidents = self.reset_data.get("baseline_incidents", [])
        for rep_dict in baseline_incidents:
            sub = IncidentSubmission(
                user_id_hash=rep_dict.get("user_id_hash", "init-user"),
                location=GeoLocation(**rep_dict["location"]),
                incident_type=rep_dict.get("incident_type", IncidentType.LANDSLIDE),
                vehicle_type=rep_dict.get("vehicle_type", VehicleType.COMMERCIAL_LIGHT),
                severity=rep_dict.get("severity", "MEDIUM"),
                is_blocked=rep_dict.get("is_blocked", False),
            )
            self.report_service.ingest_submission(sub, current_rainfall_mm=0.0)

        # 4. Reset SOSService queues and audit trail
        self.sos_service._records.clear()
        self.sos_service._alerts.clear()
        self.sos_service._audit_logs.clear()

        return ScenarioResetResponse(
            success=True,
            message="System state successfully restored to byte-identical baseline.",
            baseline_scenario_name=self.active_scenario_name,
            restored_timestamp=datetime.now(timezone.utc),
            authority=AUTHORITY_NAME,
            disclaimer=AUTHORITY_NOTICE,
            honesty_label=HonestyLabel.SIMULATION,
        )
