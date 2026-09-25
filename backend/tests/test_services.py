"""Unit Tests for MargSetu Domain Services.

Verifies deterministic behavior, authority integrity, and simulation notices across:
- RiskService
- RouteService
- ReportService
- SOSService
- WeatherService
- LLMService
- SMSService
- CallService
- MeshService
- SatelliteService
"""

import json
from pathlib import Path
import pytest

from models.schemas import (
    AUTHORITY_NAME,
    AUTHORITY_NOTICE,
    GeoLocation,
    HonestyLabel,
    IncidentReport,
    IncidentType,
    VehicleType,
)
from services import (
    CallService,
    LLMService,
    MeshService,
    ReportService,
    RiskService,
    RouteService,
    SatelliteService,
    SMSService,
    SOSService,
    WeatherService,
)


@pytest.fixture
def config_data():
    cfg_path = Path(__file__).resolve().parent.parent / "data" / "config.json"
    with open(cfg_path, "r", encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture
def corridors_data():
    cor_path = Path(__file__).resolve().parent.parent / "data" / "corridors.geojson"
    with open(cor_path, "r", encoding="utf-8") as f:
        return json.load(f)


def test_risk_service_veto_and_calculation(config_data):
    """Test deterministic risk service veto conditions and formula."""
    risk_svc = RiskService(config_data)

    # 1. Test compound hazard veto: rainfall > 75 and slope > 30
    vetoed, reason = risk_svc.evaluate_veto_conditions(rainfall_mm=80.0, slope_deg=35.0, verified_incidents_count=0)
    assert vetoed is True
    assert "Compound Hazard Veto" in reason

    # 2. Test below threshold: no veto
    not_vetoed, reason = risk_svc.evaluate_veto_conditions(rainfall_mm=50.0, slope_deg=20.0, verified_incidents_count=1)
    assert not_vetoed is False
    assert reason is None

    # 3. Test crowd report veto: >= 3 reports
    vetoed_crowd, reason = risk_svc.evaluate_veto_conditions(rainfall_mm=10.0, slope_deg=10.0, verified_incidents_count=3)
    assert vetoed_crowd is True
    assert "Corroborated Blockage Veto" in reason

    # 4. Test NDMA override veto
    vetoed_ndma, reason = risk_svc.evaluate_veto_conditions(rainfall_mm=0.0, slope_deg=0.0, verified_incidents_count=0, ndma_override_active=True)
    assert vetoed_ndma is True
    assert "NDMA Administrative Safety Override" in reason

    # 5. Test deterministic seasonal calculation
    score_comm = risk_svc.calculate_segment_risk("monsoon", 8.0, 7.0, 6.0, 5.0, 2.0, VehicleType.COMMERCIAL_LIGHT)
    score_emerg = risk_svc.calculate_segment_risk("monsoon", 8.0, 7.0, 6.0, 5.0, 2.0, VehicleType.EMERGENCY)
    assert score_comm > score_emerg, "Emergency vehicle modifier (-1.5) should result in lower risk score"


def test_route_service_dijkstra_cost(config_data, corridors_data):
    """Test deterministic route cost formula: distance * (1 + exp(Ri / 2.5))."""
    route_svc = RouteService(config_data, corridors_data)

    # Risk 0.0 -> cost = 100 * (1 + exp(0)) = 100 * 2.0 = 200.0
    cost_zero = route_svc.calculate_edge_cost(100.0, 0.0)
    assert cost_zero == 200.0

    # Evaluate corridor C1
    eval_c1 = route_svc.evaluate_corridor("C1", average_risk_score=5.0, is_blocked=False)
    assert eval_c1 is not None
    assert eval_c1.corridor_id == "C1"
    assert eval_c1.base_distance_km == 310.0
    assert eval_c1.honesty_label == HonestyLabel.VERIFIED_STATIC
    assert eval_c1.authority_notice == AUTHORITY_NOTICE


def test_report_service_and_corroboration():
    """Test incident ingestion and spatial clustering count."""
    rep_svc = ReportService()
    loc = GeoLocation(latitude=25.1147, longitude=92.3654)
    rep = IncidentReport(
        user_id_hash="user123",
        location=loc,
        incident_type=IncidentType.LANDSLIDE,
        verified_count=2,
        is_blocked=True,
    )
    rep_svc.submit_report(rep)
    count = rep_svc.get_corroborated_count_near(25.1147, 92.3654, radius_km=2.0)
    assert count == 2


def test_sos_service_strict_integrity():
    """Verify SOS service enforces no live dispatch and NDMA disclaimer."""
    sos_svc = SOSService()
    loc = GeoLocation(latitude=25.1147, longitude=92.3654)
    alert = sos_svc.trigger_sos("sos-user-1", loc, "STRANDED_VEHICLE")

    assert alert.is_dispatched is False, "SOS alert must NEVER imply live dispatch"
    assert alert.honesty_label == HonestyLabel.SIMULATION
    assert alert.authority_notice == AUTHORITY_NOTICE


def test_llm_and_satellite_and_mesh_services():
    """Verify LLM template-first advisory, SMS length, and synthetic simulation notices."""
    llm = LLMService()
    adv = llm.generate_advisory_text("NH-6", True, "Landslide at Sonapur", 8.5, 90.0)
    assert AUTHORITY_NAME in adv
    assert "IMPASSABLE" in adv
    assert AUTHORITY_NOTICE in adv

    sms = SMSService()
    msg = sms.format_offline_sms("+919876543210", "C1", True, "Sonapur Tunnel")
    assert msg["char_count"] <= 160
    assert msg["honesty_label"] == "SIMULATION"

    sat = SatelliteService()
    sat_res = sat.get_slope_deformation_overlay("C1")
    assert sat_res["honesty_label"] == "SIMULATION"
    assert sat_res["authority"] == AUTHORITY_NAME
    assert sat_res["disclaimer"] == AUTHORITY_NOTICE

    mesh = MeshService()
    mesh_status = mesh.get_mesh_status()
    assert mesh_status["authority"] == AUTHORITY_NAME
    assert mesh_status["honesty_label"] == "SIMULATION"
