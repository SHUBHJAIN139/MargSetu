"""Unit and Integration Tests for MargSetu Scenario Controls & Baseline Reset (Build Order Items 7 & 8).

PRD Reference: PRD v2.0 §2 (API contract: POST /scenario/apply & POST /scenario/reset),
               §8 & §10 (Demo Controls & Scenario Runner),
               §11 (Acceptance Criteria 12: One-click reset restores exact baseline).
Authority Integrity: NDMA is the ONLY authority named anywhere.
Disclaimer: SIMULATION — not connected to official NDMA systems.

Verifies:
1. POST /scenario/apply with rainfall=85mm -> triggers Sonapur slope veto in GET /routes/evaluate.
2. POST /scenario/apply with hazard injection at Sonapur -> verifies C1 blocked and detour to C2.
3. POST /scenario/apply with both Sonapur and Haflong hazards -> verifies all routes blocked and air dispatch activated.
4. POST /scenario/apply with NDMA safety override -> verifies administrative shutdown.
5. POST /scenario/reset -> verifies byte-identical baseline restoration (C1 unblocked, rainfall restored, dirty clusters reset, SOS queue flushed).
6. Acceptance Criteria 12: One-click reset restores exact baseline invariantly across multiple test cycles.
"""

from fastapi.testclient import TestClient
import pytest

from main import app
from models.schemas import (
    AUTHORITY_NAME,
    AUTHORITY_NOTICE,
    HonestyLabel,
)


@pytest.fixture
def client():
    """Create test client within app lifespan."""
    with TestClient(app) as test_client:
        # Guarantee clean baseline before every test
        test_client.post("/scenario/reset")
        yield test_client
        # Clean up baseline after every test
        test_client.post("/scenario/reset")


def test_scenario_apply_heavy_rainfall_triggers_sonapur_veto(client):
    """Verify POST /scenario/apply with rainfall=85mm triggers Sonapur compound hazard veto in routing."""
    # 1. Apply heavy monsoon rainfall
    apply_resp = client.post("/scenario/apply", json={"rainfall_mm": 85.0})
    assert apply_resp.status_code == 200
    state = apply_resp.json()

    assert state["rainfall_mm"] == 85.0
    assert state["is_baseline"] is False
    assert "C1" in state["active_corridor_vetoes"]
    assert state["authority"] == AUTHORITY_NAME
    assert state["disclaimer"] == AUTHORITY_NOTICE

    # 2. Check route evaluation reacts dynamically
    route_resp = client.get("/routes/evaluate")
    assert route_resp.status_code == 200
    route_data = route_resp.json()

    c1_route = next(r for r in route_data["routes"] if r["evaluation"]["corridor_id"] == "C1")
    assert c1_route["evaluation"]["is_blocked"] is True
    assert "Compound Hazard Veto" in c1_route["evaluation"]["veto_reason"]

    # C2 Haflong Bypass should be recommended detour in resilient option
    resilient_route = next(r for r in route_data["routes"] if r["route_type"] == "resilient")
    assert resilient_route["is_recommended"] is True
    assert resilient_route["evaluation"]["corridor_id"] == "C2"
    assert resilient_route["evaluation"]["is_blocked"] is False


def test_scenario_apply_sonapur_hazard_rerouting(client):
    """Verify POST /scenario/apply with hazard injection at Sonapur blocks C1 and recommends C2."""
    apply_resp = client.post("/scenario/apply", json={"inject_hazard_sonapur": True})
    assert apply_resp.status_code == 200
    state = apply_resp.json()
    assert state["inject_hazard_sonapur"] is True
    assert "C1" in state["active_corridor_vetoes"]

    route_resp = client.get("/routes/evaluate")
    assert route_resp.status_code == 200
    route_data = route_resp.json()

    c1 = next(r for r in route_data["routes"] if r["evaluation"]["corridor_id"] == "C1")
    assert c1["evaluation"]["is_blocked"] is True

    resilient = next(r for r in route_data["routes"] if r["route_type"] == "resilient")
    assert resilient["is_recommended"] is True
    assert resilient["evaluation"]["corridor_id"] == "C2"
    assert route_data["trade_off_matrix"] is not None
    assert route_data["trade_off_matrix"]["added_distance_km"] == 42.0


def test_scenario_apply_all_ground_corridors_blocked(client):
    """Verify simultaneous disruption of Sonapur and Haflong triggers air dispatch contingency."""
    apply_resp = client.post(
        "/scenario/apply",
        json={"inject_hazard_sonapur": True, "inject_hazard_haflong": True},
    )
    assert apply_resp.status_code == 200
    state = apply_resp.json()
    assert "C1" in state["active_corridor_vetoes"]
    assert "C2" in state["active_corridor_vetoes"]

    route_resp = client.get("/routes/evaluate")
    assert route_resp.status_code == 200
    route_data = route_resp.json()

    # All routes blocked
    for route in route_data["routes"]:
        assert route["evaluation"]["is_blocked"] is True

    # Air dispatch operational advisory triggered
    air = route_data["air_dispatch_advisory"]
    assert air["triggered"] is True
    assert air["ops_view_only"] is True
    assert air["live_dispatch_active"] is False  # Strict safety invariant
    assert air["authority"] == AUTHORITY_NAME
    assert air["disclaimer"] == AUTHORITY_NOTICE
    assert air["honesty_label"] == HonestyLabel.SIMULATION.value


def test_scenario_apply_ndma_safety_override(client):
    """Verify administrative safety override shuts down transit and triggers simulation advisories."""
    apply_resp = client.post("/scenario/apply", json={"ndma_override": True})
    assert apply_resp.status_code == 200
    state = apply_resp.json()
    assert state["ndma_override"] is True
    assert "C1" in state["active_corridor_vetoes"]
    assert "C2" in state["active_corridor_vetoes"]

    route_resp = client.get("/routes/evaluate")
    assert route_resp.status_code == 200
    route_data = route_resp.json()

    c1 = [r for r in route_data["routes"] if r["evaluation"]["corridor_id"] == "C1"][0]
    assert c1["evaluation"]["is_blocked"] is True
    assert "NDMA Administrative Safety Override" in c1["evaluation"]["veto_reason"]


def test_scenario_reset_restores_byte_identical_baseline(client):
    """Verify POST /scenario/reset completely restores verified baseline state across all services."""
    # 1. Dirty the system state
    client.post(
        "/scenario/apply",
        json={
            "rainfall_mm": 125.0,
            "inject_hazard_sonapur": True,
            "inject_hazard_haflong": True,
            "ndma_override": True,
        },
    )
    # Add dirty crowdsource report
    client.post(
        "/reports",
        json={
            "user_id_hash": "dirty_reporter_01",
            "location": {"latitude": 25.1147, "longitude": 92.3654},
            "incident_type": "landslide",
            "is_blocked": True,
            "rainfall_mm_reported": 120.0,
        },
    )
    # Add dirty SOS distress alert
    client.post(
        "/sos",
        json={
            "sender_id_hash": "dirty_sos_sender",
            "location": {"latitude": 25.1147, "longitude": 92.3654},
            "distress_type": "STRANDED_HAZARD",
        },
    )

    # 2. Trigger one-click reset
    reset_resp = client.post("/scenario/reset")
    assert reset_resp.status_code == 200
    reset_data = reset_resp.json()
    assert reset_data["success"] is True
    assert reset_data["baseline_scenario_name"] == "baseline_northeast_monsoon"
    assert reset_data["authority"] == AUTHORITY_NAME
    assert reset_data["disclaimer"] == AUTHORITY_NOTICE
    assert reset_data["honesty_label"] == HonestyLabel.SIMULATION.value

    # 3. Verify scenario state returned to exact baseline
    state = client.get("/scenario/state").json()
    assert state["is_baseline"] is True
    assert state["rainfall_mm"] == 68.0
    assert state["inject_hazard_sonapur"] is False
    assert state["inject_hazard_haflong"] is False
    assert state["ndma_override"] is False
    assert state["active_corridor_vetoes"] == []

    # 4. Verify C1 is unblocked and chosen as primary route
    routes = client.get("/routes/evaluate").json()
    c1 = [r for r in routes["routes"] if r["evaluation"]["corridor_id"] == "C1"][0]
    assert c1["evaluation"]["is_blocked"] is False
    assert c1["is_recommended"] is True

    # 5. Verify dirty crowdsource clusters removed and initial baseline incident restored
    reports_data = client.get("/reports").json()
    assert reports_data["total_clusters"] == 1
    assert reports_data["clusters"][0]["reports_count"] == 1

    # 6. Verify SOS queue completely flushed
    sos_data = client.get("/ops/sos").json()
    assert sos_data["total_records"] == 0


def test_acceptance_criteria_12_one_click_reset_invariance(client):
    """PRD §11 AC-12: Repeat 3 full apply/reset cycles ensuring strict baseline invariance."""
    for cycle in range(1, 4):
        # Mutate state
        client.post(
            "/scenario/apply",
            json={"rainfall_mm": 90.0 + cycle * 10, "inject_hazard_sonapur": True},
        )
        assert client.get("/scenario/state").json()["is_baseline"] is False

        # Reset state
        reset_res = client.post("/scenario/reset")
        assert reset_res.status_code == 200

        # Assert baseline invariants
        state = client.get("/scenario/state").json()
        assert state["is_baseline"] is True
        assert state["rainfall_mm"] == 68.0
        assert state["inject_hazard_sonapur"] is False
        assert len(state["active_corridor_vetoes"]) == 0

        route = client.get("/routes/evaluate").json()
        c1 = [r for r in route["routes"] if r["evaluation"]["corridor_id"] == "C1"][0]
        assert c1["evaluation"]["is_blocked"] is False
        assert c1["is_recommended"] is True
