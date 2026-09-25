"""Unit and Integration Tests for MargSetu Routing Engine (Build Order Item 3).

Verifies all 7 mandated scenarios:
1. Baseline routing (C1 active, fastest and resilient = C1, Ri low).
2. Disruption routing (hazard injected at Sonapur Tunnel -> C1 vetoed -> C2 NH-27 detour becomes recommended resilient route).
3. Trade-off calculation verification (+42 km, +56 to 90 min, +₹1,411 fuel, -99.2% landslide exposure).
4. Emergency vehicle routing on blocked corridor (ambulance gets purple status).
5. All routes blocked scenario -> air-dispatch advisory triggered (labeled SIMULATION).
6. Multilingual advisory brief present in {en, hi, as}.
7. Honesty labels and NDMA disclaimer on all outputs.
"""

from fastapi.testclient import TestClient
import pytest

from main import app
from models.schemas import (
    AUTHORITY_NAME,
    AUTHORITY_NOTICE,
    HonestyLabel,
    RiskClassification,
    RouteType,
    VehicleType,
)


@pytest.fixture
def client():
    """Create test client within app lifespan."""
    with TestClient(app) as test_client:
        yield test_client


def test_baseline_routing(client):
    """1. Baseline routing (C1 active, fastest and resilient = C1, Ri low)."""
    response = client.get("/routes/evaluate?origin=Guwahati&dest=Silchar&vehicle=commercial_light")
    assert response.status_code == 200
    data = response.json()

    assert data["origin"] == "Guwahati"
    assert data["destination"] == "Silchar"
    assert data["recommended_route_type"] in [RouteType.FASTEST.value, RouteType.RESILIENT.value]

    # Find resilient route option
    routes = data["routes"]
    assert len(routes) == 3

    resilient_route = next(r for r in routes if r["route_type"] == RouteType.RESILIENT.value)
    assert resilient_route["evaluation"]["corridor_id"] == "C1"
    assert resilient_route["evaluation"]["is_blocked"] is False
    assert resilient_route["evaluation"]["average_risk_score"] < 4.0
    assert resilient_route["classification"] == RiskClassification.GREEN.value

    # In baseline clear conditions, no detour trade-off is generated
    assert data["trade_off_matrix"] is None
    assert data["air_dispatch_advisory"]["triggered"] is False


def test_disruption_routing_sonapur_hazard(client):
    """2. Disruption routing (hazard injected at Sonapur Tunnel -> C1 vetoed -> C2 detour recommended)."""
    response = client.get("/routes/evaluate?origin=Guwahati&dest=Silchar&vehicle=commercial_light&inject_hazard_sonapur=true")
    assert response.status_code == 200
    data = response.json()

    assert data["recommended_route_type"] == RouteType.RESILIENT.value

    routes = data["routes"]
    # Verify Resilient Route switched to C2 Detour via Haflong
    resilient_route = next(r for r in routes if r["route_type"] == RouteType.RESILIENT.value)
    assert resilient_route["evaluation"]["corridor_id"] == "C2"
    assert "Haflong" in resilient_route["evaluation"]["corridor_name"]
    assert resilient_route["evaluation"]["is_blocked"] is False
    assert resilient_route["is_recommended"] is True

    # Verify C1 is blocked with hard veto
    c1_option = next(r for r in routes if r["evaluation"]["corridor_id"] == "C1")
    assert c1_option["evaluation"]["is_blocked"] is True
    assert "Veto" in c1_option["evaluation"]["veto_reason"]
    assert c1_option["classification"] in [RiskClassification.DARK_RED.value, RiskClassification.PURPLE.value]


def test_trade_off_calculation_verification(client):
    """3. Trade-off calculation verification (+42 km, +56 min, +₹1,411 fuel, -99.2% landslide exposure)."""
    # Test for heavy freight to verify exact benchmark ₹1,411
    response = client.get("/routes/evaluate?origin=Guwahati&dest=Silchar&vehicle=heavy_freight&inject_hazard_sonapur=true")
    assert response.status_code == 200
    data = response.json()

    to = data["trade_off_matrix"]
    assert to is not None
    assert to["added_distance_km"] == 42.0
    assert to["added_time_minutes"] in [56.0, 90.0]
    assert to["added_fuel_cost_inr"] == 1411.0
    assert to["hazard_exposure_reduction_pct"] == 99.2
    assert "NH-6" in to["baseline_corridor"]
    assert "NH-27" in to["detour_corridor"]


def test_emergency_vehicle_routing_blocked_corridor(client):
    """4. Emergency vehicle routing on blocked corridor (ambulance gets purple status)."""
    response = client.get("/routes/evaluate?origin=Guwahati&dest=Silchar&vehicle=emergency&inject_hazard_sonapur=true")
    assert response.status_code == 200
    data = response.json()

    routes = data["routes"]
    emerg_route = next(r for r in routes if r["route_type"] == RouteType.EMERGENCY_ONLY.value)

    assert emerg_route["classification"] == RiskClassification.PURPLE.value
    assert emerg_route["is_recommended"] is True
    assert "EMERGENCY PROTOCOL" in emerg_route["advisory_multilingual"]["en"]
    assert "PURPLE" in emerg_route["advisory_multilingual"]["en"]


def test_all_routes_blocked_air_dispatch_advisory(client):
    """5. All routes blocked scenario -> air-dispatch advisory triggered (labeled SIMULATION)."""
    response = client.get("/routes/evaluate?origin=Guwahati&dest=Silchar&vehicle=commercial_light&all_blocked=true")
    assert response.status_code == 200
    data = response.json()

    air = data["air_dispatch_advisory"]
    assert air["triggered"] is True
    assert air["ops_view_only"] is True
    assert air["live_dispatch_active"] is False  # Mandatory NDMA constraint
    assert air["authority"] == AUTHORITY_NAME
    assert air["disclaimer"] == AUTHORITY_NOTICE
    assert air["honesty_label"] == HonestyLabel.SIMULATION.value
    assert "Guwahati" in air["recommended_airhead_origin"]
    assert "Silchar" in air["recommended_airhead_dest"]
    assert "air bridge simulation only" in air["payload_notes"]


def test_multilingual_advisory_brief(client):
    """6. Multilingual advisory brief present in {en, hi, as}."""
    response = client.get("/routes/evaluate?origin=Guwahati&dest=Silchar&vehicle=commercial_light&inject_hazard_sonapur=true")
    assert response.status_code == 200
    data = response.json()

    routes = data["routes"]
    resilient_route = next(r for r in routes if r["route_type"] == RouteType.RESILIENT.value)
    adv = resilient_route["advisory_multilingual"]

    # Check that all 3 languages are populated
    assert "en" in adv
    assert "hi" in adv
    assert "as" in adv or "as_" in adv

    # English check
    assert AUTHORITY_NAME in adv["en"]
    assert "SIMULATION ADVISORY" in adv["en"]

    # Hindi check
    assert "सिमुलेशन परामर्श" in adv["hi"]
    assert "हाफलोंग" in adv["hi"]

    # Assamese check
    as_text = adv.get("as") or adv.get("as_")
    assert "ছিমুলেচন পৰামৰ্শ" in as_text
    assert "হাফলং" in as_text


def test_honesty_labels_and_ndma_disclaimer(client):
    """7. Honesty labels and NDMA disclaimer on all outputs."""
    response = client.get("/routes/evaluate?origin=Guwahati&dest=Silchar&vehicle=commercial_light")
    assert response.status_code == 200
    data = response.json()

    # Top-level authority integrity
    assert data["authority"] == AUTHORITY_NAME
    assert data["disclaimer"] == AUTHORITY_NOTICE
    assert data["honesty_label"] == HonestyLabel.VERIFIED_STATIC.value

    # Check each route option
    for r in data["routes"]:
        eval_data = r["evaluation"]
        assert eval_data["authority_notice"] == AUTHORITY_NOTICE
        assert eval_data["honesty_label"] == HonestyLabel.VERIFIED_STATIC.value

    # Air dispatch check
    air = data["air_dispatch_advisory"]
    assert air["authority"] == AUTHORITY_NAME
    assert air["disclaimer"] == AUTHORITY_NOTICE
    assert air["honesty_label"] == HonestyLabel.SIMULATION.value
    assert air["live_dispatch_active"] is False


def test_baseline_calibration_68mm_exact_ri_2_4(client):
    """8. Calibration test: C1 baseline at 68.0mm rainfall evaluates to Ri = 2.40 matching PRD §10."""
    response = client.get("/routes/evaluate?origin=Guwahati&dest=Silchar&vehicle=commercial_light&rainfall_mm=68.0")
    assert response.status_code == 200
    data = response.json()

    c1 = next(r for r in data["routes"] if r["evaluation"]["corridor_id"] == "C1" and r["route_type"] == "fastest")
    assert c1["evaluation"]["average_risk_score"] == 2.40
    assert c1["classification"] == RiskClassification.GREEN.value
    assert c1["evaluation"]["is_blocked"] is False
    assert c1["evaluation"]["veto_reason"] is None
    assert c1["is_recommended"] is True


def test_dynamic_rainfall_slider_sweep_progression(client):
    """9. Slider sweep: Ri scales smoothly (60->70->74->75mm) and triggers veto with dynamic mm at >75mm."""
    # 60mm
    r60 = client.get("/routes/evaluate?rainfall_mm=60.0").json()
    c1_60 = next(r for r in r60["routes"] if r["evaluation"]["corridor_id"] == "C1" and r["route_type"] == "fastest")
    assert c1_60["evaluation"]["average_risk_score"] == 2.23
    assert c1_60["evaluation"]["is_blocked"] is False

    # 70mm
    r70 = client.get("/routes/evaluate?rainfall_mm=70.0").json()
    c1_70 = next(r for r in r70["routes"] if r["evaluation"]["corridor_id"] == "C1" and r["route_type"] == "fastest")
    assert c1_70["evaluation"]["average_risk_score"] == 2.44
    assert c1_70["evaluation"]["is_blocked"] is False

    # 74mm
    r74 = client.get("/routes/evaluate?rainfall_mm=74.0").json()
    c1_74 = next(r for r in r74["routes"] if r["evaluation"]["corridor_id"] == "C1" and r["route_type"] == "fastest")
    assert c1_74["evaluation"]["average_risk_score"] == 2.53
    assert c1_74["evaluation"]["is_blocked"] is False

    # 75mm
    r75 = client.get("/routes/evaluate?rainfall_mm=75.0").json()
    c1_75 = next(r for r in r75["routes"] if r["evaluation"]["corridor_id"] == "C1" and r["route_type"] == "fastest")
    assert c1_75["evaluation"]["average_risk_score"] == 2.55
    assert c1_75["evaluation"]["is_blocked"] is False

    # 76mm -> Compound hazard veto with dynamic 76.0mm in veto reason
    r76 = client.get("/routes/evaluate?rainfall_mm=76.0").json()
    c1_76 = next(r for r in r76["routes"] if r["evaluation"]["corridor_id"] == "C1" and r["route_type"] == "fastest")
    assert c1_76["evaluation"]["is_blocked"] is True
    assert "76.0mm > 75.0mm" in c1_76["evaluation"]["veto_reason"]

    # 85mm -> Compound hazard veto with dynamic 85.0mm in veto reason
    r85 = client.get("/routes/evaluate?rainfall_mm=85.0").json()
    c1_85 = next(r for r in r85["routes"] if r["evaluation"]["corridor_id"] == "C1" and r["route_type"] == "fastest")
    assert c1_85["evaluation"]["is_blocked"] is True
    assert "85.0mm > 75.0mm" in c1_85["evaluation"]["veto_reason"]
