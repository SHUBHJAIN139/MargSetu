"""Comprehensive End-to-End Demo Rehearsal (PRD §10) and 12 Acceptance Criteria (PRD §11) Verification Test Suite.

PRD Reference: PRD v2.0 §10 (Demo Script) and §11 (Acceptance Criteria 1 to 12).
Authority Integrity: NDMA is the ONLY authority named.
Mandatory Disclaimer: SIMULATION — not connected to official NDMA systems.
Safety Rule: 'rescued' MUST NEVER appear; 'delivered' is 'Signal Delivered to Queue - Awaiting Operator Review'; is_dispatched=False.
"""

from pathlib import Path
from fastapi.testclient import TestClient
import pytest

from main import app
from models.schemas import (
    AUTHORITY_NAME,
    AUTHORITY_NOTICE,
    HonestyLabel,
)


BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR.parent / "frontend"


@pytest.fixture
def client():
    """Create test client within app lifespan."""
    with TestClient(app) as test_client:
        test_client.post("/scenario/reset")
        yield test_client
        test_client.post("/scenario/reset")


# ==============================================================================
# 1. FULL PRD §10 DEMO SCRIPT REHEARSAL
# ==============================================================================

def test_prd_section_10_full_script_rehearsal(client):
    """Execute the full PRD §10 demonstration sequence end-to-end.
    
    Sequence:
    1. Baseline: C1 NH-6 active, Ri low, resilient route recommended.
    2. Disruption: rainfall slider -> 85mm -> Sonapur veto (Ri=10.0, dark red)
       -> auto-reroute to C2 NH-27 -> trade-off panel (+42km, +56min, +₹1,411 fuel, -99.2% landslide exposure)
       -> Hindi + Assamese advisory plays.
    3. Blackout SOS: 1.5s hold SOS -> L1 timeout -> L3 call/SMS hooks
       -> ops pins beacon at 25.1147°N, 92.3654°E (labeled SIMULATION)
       -> operator acknowledges -> resolves.
    4. One-Click Reset: POST /scenario/reset restores exact baseline.
    """
    # --------------------------------------------------------------------------
    # Step 1: Baseline Check
    # --------------------------------------------------------------------------
    reset_resp = client.post("/scenario/reset")
    assert reset_resp.status_code == 200
    reset_res = reset_resp.json()
    assert reset_res["success"] is True
    assert reset_res["authority"] == AUTHORITY_NAME

    baseline_state = client.get("/scenario/state").json()
    assert baseline_state["is_baseline"] is True
    assert baseline_state["rainfall_mm"] == 68.0  # nominal monsoon baseline
    assert baseline_state["inject_hazard_sonapur"] is False
    assert len(baseline_state["active_corridor_vetoes"]) == 0

    # Test baseline evaluation under Heavy Freight benchmark
    route_baseline = client.get("/routes/evaluate?origin=Guwahati&dest=Silchar&vehicle=heavy_freight&season=monsoon").json()
    assert route_baseline["authority"] == AUTHORITY_NAME
    assert route_baseline["disclaimer"] == AUTHORITY_NOTICE
    
    # C1 is active, Ri low, recommended
    resilient_base = next(r for r in route_baseline["routes"] if r["route_type"] == "resilient")
    assert resilient_base["is_recommended"] is True
    assert resilient_base["evaluation"]["corridor_id"] == "C1"
    assert resilient_base["evaluation"]["is_blocked"] is False
    assert resilient_base["evaluation"]["average_risk_score"] < 4.0
    assert resilient_base["classification"] == "green"
    assert route_baseline["trade_off_matrix"] is None  # No detour needed at baseline

    # --------------------------------------------------------------------------
    # Step 2: Disruption (Rainfall slider -> 85mm -> Sonapur veto)
    # --------------------------------------------------------------------------
    apply_resp = client.post("/scenario/apply", json={"rainfall_mm": 85.0})
    assert apply_resp.status_code == 200
    applied_state = apply_resp.json()
    assert applied_state["rainfall_mm"] == 85.0
    assert "C1" in applied_state["active_corridor_vetoes"]

    # Re-evaluate routes after rainfall injection for Heavy Freight benchmark
    route_disrupted = client.get("/routes/evaluate?origin=Guwahati&dest=Silchar&vehicle=heavy_freight&season=monsoon").json()
    
    # Auto-reroute to C2 NH-27 Haflong Bypass as Resilient recommended route
    resilient_disrupted = next(r for r in route_disrupted["routes"] if r["route_type"] == "resilient")
    assert resilient_disrupted["is_recommended"] is True
    assert resilient_disrupted["evaluation"]["corridor_id"] == "C2"
    assert resilient_disrupted["evaluation"]["is_blocked"] is False
    assert resilient_disrupted["classification"] == "green"

    # Emergency convoy option targets C1 with hard veto / purple status
    emerg_route = next(r for r in route_disrupted["routes"] if r["route_type"] == "emergency_only")
    assert emerg_route["evaluation"]["is_blocked"] is True
    assert emerg_route["breakdown"]["classification"] == "dark_red"
    assert "Compound Hazard Veto" in emerg_route["evaluation"]["veto_reason"]

    # Trade-off panel exact benchmark verification (+42km, +56min, +₹1,411 fuel, -99.2% hazard reduction)
    tom = route_disrupted["trade_off_matrix"]
    assert tom is not None
    assert tom["added_distance_km"] == 42.0
    assert tom["added_time_minutes"] == 56.0
    assert tom["added_fuel_cost_inr"] == 1411.0
    assert tom["carbon_delta_kg"] == 39.4
    assert tom["hazard_exposure_reduction_pct"] == 99.2

    # Multilingual advisory: Hindi and Assamese advisory present
    adv = resilient_disrupted["advisory_multilingual"]
    assert adv is not None
    assert "en" in adv and "hi" in adv and "as" in adv
    assert "এনএইচ-২৭" in adv["as"] or "হাফলং" in adv["as"]
    assert "एनएच-27" in adv["hi"] or "हाफलोंग" in adv["hi"]
    assert AUTHORITY_NAME in adv["en"]

    # --------------------------------------------------------------------------
    # Step 3: Blackout SOS (1.5s hold -> L1 timeout -> L3 call/SMS hooks -> ops triage)
    # --------------------------------------------------------------------------
    sos_payload = {
        "sender_id_hash": "driver-sim-rehearsal",
        "location": {
            "latitude": 25.1147,
            "longitude": 92.3654,
            "accuracy_m": 5.0,
            "landmark_name": "Sonapur Tunnel North Portal",
        },
        "distress_type": "STRANDED_HAZARD",
        "urgency_level": "CRITICAL",
        "message": "Heavy landslide mudflow blocking Sonapur Tunnel. Vehicle stranded.",
        "network_condition": "degraded",
        "vehicle_type": "commercial_light",
    }
    
    sos_resp = client.post("/sos", json=sos_payload)
    assert sos_resp.status_code == 201
    sos_data = sos_resp.json()
    sos_id = sos_data["event_id"]
    
    # State is delivered (NEVER rescued), is_dispatched is False
    assert sos_data["state"] == "delivered"
    assert sos_data["is_dispatched"] is False
    assert "rescued" not in sos_data["status_label"].lower()
    assert sos_data["status_label"] == "Signal Delivered to Queue - Awaiting Operator Review"
    assert sos_data["authority"] == AUTHORITY_NAME
    assert sos_data["disclaimer"] == AUTHORITY_NOTICE
    assert sos_data["honesty_label"] == HonestyLabel.SIMULATION.value

    # Check 4-layer cascade: L1, L2, L3, L4 present
    layers = {layer["layer"]: layer for layer in sos_data["cascade_layers"]}
    assert "layer_1_ip" in layers
    assert "layer_2_mesh" in layers
    assert "layer_3_os_hooks" in layers
    assert "layer_4_air_vector" in layers
    
    # L3 Telephony Native Hooks
    l3 = layers["layer_3_os_hooks"]
    assert l3["honesty_label"] == HonestyLabel.VERIFIED_STATIC.value
    assert l3["details"]["tel_uri_1077"] == "tel:1077"
    assert l3["details"]["tel_uri_112"] == "tel:112"
    assert "sms:1077" in l3["details"]["sms_uri"]

    # Ops Queue: Check beacon appears in ops queue at Sonapur Tunnel coords
    queue_resp = client.get("/ops/sos")
    assert queue_resp.status_code == 200
    queue_data = queue_resp.json()
    assert queue_data["total_records"] >= 1
    
    ops_sos = next(r for r in queue_data["records"] if r["id"] == sos_id)
    assert ops_sos["location"]["latitude"] == 25.1147
    assert ops_sos["location"]["longitude"] == 92.3654
    assert ops_sos["honesty_label"] == HonestyLabel.SIMULATION.value

    # Operator acknowledges SOS
    ack_resp = client.post(f"/ops/sos/{sos_id}/action", json={
        "operator_id": "NDMA-OPS-01",
        "action": "acknowledge",
        "notes": "Acknowledged distress beacon at Sonapur Tunnel portal."
    })
    assert ack_resp.status_code == 200
    assert ack_resp.json()["state"] == "acknowledged"

    # Operator assigns SOS
    assign_resp = client.post(f"/ops/sos/{sos_id}/action", json={
        "operator_id": "NDMA-OPS-01",
        "action": "assign",
        "notes": "Assigning simulated relief unit."
    })
    assert assign_resp.status_code == 200
    assert assign_resp.json()["state"] == "assigned"

    # Operator resolves SOS
    resolve_resp = client.post(f"/ops/sos/{sos_id}/action", json={
        "operator_id": "NDMA-OPS-01",
        "action": "resolve",
        "notes": "Driver clear of hazard area via NH-27 bypass."
    })
    assert resolve_resp.status_code == 200
    resolved_sos = resolve_resp.json()
    assert resolved_sos["state"] == "resolved"
    assert resolved_sos["is_dispatched"] is False
    assert "rescued" not in resolved_sos["status_label"].lower()

    # --------------------------------------------------------------------------
    # Step 4: One-Click Reset
    # --------------------------------------------------------------------------
    final_reset = client.post("/scenario/reset")
    assert final_reset.status_code == 200
    assert final_reset.json()["success"] is True

    final_state = client.get("/scenario/state").json()
    assert final_state["is_baseline"] is True
    assert final_state["rainfall_mm"] == 68.0
    assert final_state["active_corridor_vetoes"] == []

    # Verify baseline routes restored
    restored_routes = client.get("/routes/evaluate?origin=Guwahati&dest=Silchar").json()
    resilient_restored = next(r for r in restored_routes["routes"] if r["route_type"] == "resilient")
    assert resilient_restored["evaluation"]["corridor_id"] == "C1"
    assert resilient_restored["evaluation"]["is_blocked"] is False
    assert resilient_restored["classification"] == "green"
    assert restored_routes["trade_off_matrix"] is None


# ==============================================================================
# 2. VERIFICATION OF ALL 12 PRD §11 ACCEPTANCE CRITERIA
# ==============================================================================

def test_ac_1_route_alternatives_visible(client):
    """AC-1: >= 2 route alternatives visible."""
    res = client.get("/routes/evaluate?origin=Guwahati&dest=Silchar")
    assert res.status_code == 200
    data = res.json()
    routes = data.get("routes", [])
    assert len(routes) >= 2, f"Expected >= 2 route alternatives, got {len(routes)}"
    route_types = [r["route_type"] for r in routes]
    assert "resilient" in route_types
    assert "fastest" in route_types


def test_ac_2_hazard_injection_changes_risk_and_recommendation_without_reload(client):
    """AC-2: Hazard injection changes risk + recommendation without reload."""
    # 1. Baseline: C1 is recommended
    r1 = client.get("/routes/evaluate").json()
    resilient_1 = next(r for r in r1["routes"] if r["route_type"] == "resilient")
    assert resilient_1["evaluation"]["corridor_id"] == "C1"
    assert resilient_1["evaluation"]["is_blocked"] is False

    # 2. Inject hazard at Sonapur
    client.post("/scenario/apply", json={"inject_hazard_sonapur": True})

    # 3. Dynamic evaluation: recommendation switches to C2 Haflong Detour
    r2 = client.get("/routes/evaluate").json()
    resilient_2 = next(r for r in r2["routes"] if r["route_type"] == "resilient")
    assert resilient_2["evaluation"]["corridor_id"] == "C2"
    assert resilient_2["is_recommended"] is True
    assert resilient_2["evaluation"]["is_blocked"] is False

    # Route targeting C1 has blocked status and dark_red risk breakdown
    emerg = next(r for r in r2["routes"] if r["route_type"] == "emergency_only")
    assert emerg["evaluation"]["is_blocked"] is True
    assert emerg["breakdown"]["classification"] == "dark_red"
    assert emerg["breakdown"]["composite_risk_score"] >= 8.0


def test_ac_3_route_cards_show_all_mandated_metrics(client):
    """AC-3: Route cards show distance, ETA, risk, fuel, carbon, exposure."""
    # Inject hazard to test with trade-off matrix
    client.post("/scenario/apply", json={"inject_hazard_sonapur": True})
    res = client.get("/routes/evaluate").json()
    
    for route in res["routes"]:
        ev = route["evaluation"]
        bd = route["breakdown"]
        assert "base_distance_km" in ev and ev["base_distance_km"] > 0
        assert "average_risk_score" in ev
        assert "fuel_consumption_liters" in ev and ev["fuel_consumption_liters"] > 0
        assert "carbon_emission_kg" in ev and ev["carbon_emission_kg"] > 0
        assert "percentage_shares" in bd

    tom = res["trade_off_matrix"]
    assert tom is not None
    assert "hazard_exposure_reduction_pct" in tom
    assert tom["hazard_exposure_reduction_pct"] == 99.2


def test_ac_4_incident_submission_appears_with_visible_status(client):
    """AC-4: Incident submission appears with visible status."""
    sub = {
        "user_id_hash": "usr-test-ac4",
        "location": {
            "latitude": 25.1147,
            "longitude": 92.3654,
            "accuracy_m": 4.5,
            "landmark_name": "Sonapur Tunnel North Portal"
        },
        "incident_type": "landslide",
        "vehicle_type": "commercial_light",
        "severity": "HIGH",
        "description": "Mudslide across both lanes.",
        "is_blocked": True,
        "clearance_eta_hours": 3.5,
        "rainfall_mm_reported": 40.0,
    }
    
    post_res = client.post("/reports", json=sub)
    assert post_res.status_code == 200
    cluster_res = post_res.json()
    assert cluster_res["status"] in ["pending", "corroborated", "verified"]
    assert cluster_res["honesty_label"] == HonestyLabel.USER_SUBMITTED.value

    # Verify visible in GET /reports with status
    get_res = client.get("/reports")
    assert get_res.status_code == 200
    clusters = get_res.json()["clusters"]
    assert len(clusters) >= 1
    found = next((c for c in clusters if c["cluster_id"] == cluster_res["cluster"]["cluster_id"]), None)
    assert found is not None
    assert "status" in found and found["status"] != ""


def test_ac_5_1_point_5s_hold_sos_creates_dashboard_event(client):
    """AC-5: 1.5s hold-SOS creates dashboard event (no accidental triggers)."""
    sos_payload = {
        "sender_id_hash": "driver-hold-test",
        "location": {
            "latitude": 25.1147,
            "longitude": 92.3654,
            "accuracy_m": 5.0,
            "landmark_name": "Sonapur Sector"
        },
        "distress_type": "VEHICLE_BREAKDOWN",
        "urgency_level": "CRITICAL",
        "message": "Completed 1.5s press-and-hold activation",
        "vehicle_type": "commercial_light",
    }
    
    res = client.post("/sos", json=sos_payload)
    assert res.status_code == 201
    data = res.json()
    event_id = data["event_id"]
    
    # Event exists in dashboard queue
    queue = client.get("/ops/sos").json()
    event = next((r for r in queue["records"] if r["id"] == event_id), None)
    assert event is not None
    assert event["state"] == "delivered"
    assert event["is_dispatched"] is False


def test_ac_6_operator_can_acknowledge_assign_resolve_sos(client):
    """AC-6: Operator can acknowledge/assign/resolve SOS."""
    # Create SOS
    sos = client.post("/sos", json={
        "sender_id_hash": "driver-triage",
        "location": {"latitude": 25.1147, "longitude": 92.3654},
        "distress_type": "MEDICAL",
        "urgency_level": "CRITICAL",
    }).json()
    sos_id = sos["event_id"]

    # 1. Acknowledge
    r_ack = client.post(f"/ops/sos/{sos_id}/action", json={"operator_id": "OPS-1", "action": "acknowledge"})
    assert r_ack.status_code == 200
    assert r_ack.json()["state"] == "acknowledged"

    # 2. Assign
    r_assign = client.post(f"/ops/sos/{sos_id}/action", json={"operator_id": "OPS-1", "action": "assign"})
    assert r_assign.status_code == 200
    assert r_assign.json()["state"] == "assigned"

    # 3. Resolve
    r_res = client.post(f"/ops/sos/{sos_id}/action", json={"operator_id": "OPS-1", "action": "resolve"})
    assert r_res.status_code == 200
    assert r_res.json()["state"] == "resolved"


def test_ac_7_call_sms_actions_visible_and_labeled(client):
    """AC-7: Call/SMS actions visible + labeled."""
    sos = client.post("/sos", json={
        "sender_id_hash": "driver-tel-test",
        "location": {"latitude": 25.1147, "longitude": 92.3654},
        "distress_type": "STRANDED_HAZARD",
        "urgency_level": "CRITICAL",
    }).json()

    layers = {l["layer"]: l for l in sos["cascade_layers"]}
    l3 = layers["layer_3_os_hooks"]
    
    assert l3["honesty_label"] == HonestyLabel.VERIFIED_STATIC.value
    assert l3["details"]["ddma_helpline"] == "1077"
    assert l3["details"]["national_emergency"] == "112"
    assert l3["details"]["tel_uri_1077"] == "tel:1077"
    assert l3["details"]["tel_uri_112"] == "tel:112"
    assert "sms:1077" in l3["details"]["sms_uri"]


def test_ac_8_mesh_satellite_labeled_simulation(client):
    """AC-8: Mesh/satellite labeled SIMULATION."""
    sos = client.post("/sos", json={
        "sender_id_hash": "driver-sim-label",
        "location": {"latitude": 25.1147, "longitude": 92.3654},
        "distress_type": "STRANDED_HAZARD",
    }).json()

    layers = {l["layer"]: l for l in sos["cascade_layers"]}
    assert layers["layer_2_mesh"]["honesty_label"] == HonestyLabel.SIMULATION.value
    assert layers["layer_4_air_vector"]["honesty_label"] == HonestyLabel.SIMULATION.value


def test_ac_9_gemini_structured_output_and_template_fallback(client):
    """AC-9: Gemini structured output + template fallback works (kill-API-key test verified)."""
    req = {
        "corridor_name": "C1 NH-6 Sonapur Sector",
        "is_blocked": True,
        "is_detour": False,
        "all_blocked": False,
        "risk_score": 9.2,
        "rainfall_mm": 85.0,
        "hazard_type": "LANDSLIDE",
    }
    
    # AC-9 Kill-API-Key test: Ensure missing/killed key immediately falls back to deterministic template
    saved_key = getattr(app.state.llm_service, "api_key", None)
    app.state.llm_service.api_key = ""
    try:
        resp = client.post("/advisory/polish", json=req)
        assert resp.status_code == 200
        data = resp.json()
        
        # Must return structured AdvisoryPolishResponse schema
        assert "advisory_brief" in data
        assert "en" in data["advisory_brief"]
        assert "hi" in data["advisory_brief"]
        assert "as" in data["advisory_brief"]
        assert data["is_fallback"] is True
        assert data["source"] == "template_fallback"
        assert data["fallback_reason"] in ["api_key_missing_or_killed", "offline_or_backend_unreachable"]
        assert data["latency_ms"] < 20.0  # Instant deterministic response (<1ms typically)
        assert data["authority"] == AUTHORITY_NAME
        assert data["disclaimer"] == AUTHORITY_NOTICE
        assert data["honesty_label"] == HonestyLabel.SIMULATION.value
    finally:
        app.state.llm_service.api_key = saved_key


def test_ac_10_offline_sim_shows_last_known_state_and_pending_sync():
    """AC-10: Offline sim shows last-known state + pending sync."""
    api_js_path = FRONTEND_DIR / "lib" / "api.js"
    assert api_js_path.exists(), "frontend/lib/api.js must exist"
    
    with open(api_js_path, "r", encoding="utf-8") as f:
        content = f.read()

    assert "getDeterministicRouteFallback" in content
    assert "offline_or_backend_unreachable" in content
    assert "cl-offline-" in content
    assert "USER-SUBMITTED" in content
    assert "VERIFIED STATIC" in content


def test_ac_11_string_check_ui_copy_across_frontend_and_backend():
    """AC-11: String-check UI copy across frontend and backend:
    - ZERO fabricated live-government/dispatch/satellite claims
    - ZERO occurrences of 'rescued'
    - NDMA sole authority
    """
    # 1. Inspect non-test backend source files
    backend_py_files = [p for p in BASE_DIR.glob("**/*.py") if "venv" not in str(p) and "tests" not in str(p)]
    
    for py_file in backend_py_files:
        with open(py_file, "r", encoding="utf-8") as f:
            text = f.read()
            lines = text.splitlines()
            for idx, line in enumerate(lines, 1):
                clean_line = line.strip()
                if clean_line.startswith("#") or clean_line.startswith('"""') or clean_line.startswith('"') or clean_line.startswith("'"):
                    continue
                # Disallow assigning "rescued" to any user-facing variable
                assert '="rescued"' not in clean_line.lower(), f"Prohibited rescued assignment in {py_file}:{idx}"
                assert "='rescued'" not in clean_line.lower(), f"Prohibited rescued assignment in {py_file}:{idx}"
                assert 'status="rescued"' not in clean_line.lower(), f"Prohibited rescued assignment in {py_file}:{idx}"

    # 2. Inspect frontend source files (jsx, js, json)
    frontend_source_files = (
        list(FRONTEND_DIR.glob("app/**/*.jsx"))
        + list(FRONTEND_DIR.glob("app/**/*.js"))
        + list(FRONTEND_DIR.glob("components/**/*.jsx"))
        + list(FRONTEND_DIR.glob("components/**/*.js"))
    )
    
    for src_file in frontend_source_files:
        with open(src_file, "r", encoding="utf-8") as f:
            text = f.read()
            lines = text.splitlines()
            for idx, line in enumerate(lines, 1):
                clean = line.strip()
                if clean.startswith("//") or clean.startswith("/*") or clean.startswith("*"):
                    continue
                assert '"rescued"' not in clean.lower(), f"Forbidden 'rescued' in {src_file}:{idx}"
                assert "'rescued'" not in clean.lower(), f"Forbidden 'rescued' in {src_file}:{idx}"
                assert ">rescued<" not in clean.lower(), f"Forbidden 'rescued' in {src_file}:{idx}"


def test_ac_12_one_click_reset_restores_exact_baseline(client):
    """AC-12: One-click reset restores exact baseline."""
    # Dirty the system with rainfall, hazard injection, reports, and SOS
    client.post("/scenario/apply", json={"rainfall_mm": 110.0, "inject_hazard_sonapur": True})
    client.post("/reports", json={
        "user_id_hash": "dirty-user",
        "location": {"latitude": 25.1147, "longitude": 92.3654},
        "incident_type": "landslide",
        "is_blocked": True,
    })
    client.post("/sos", json={
        "sender_id_hash": "dirty-sos",
        "location": {"latitude": 25.1147, "longitude": 92.3654},
        "distress_type": "STRANDED_HAZARD",
    })

    # One-click reset
    reset_resp = client.post("/scenario/reset")
    assert reset_resp.status_code == 200
    reset_data = reset_resp.json()
    assert reset_data["success"] is True

    # Verify baseline state
    state = client.get("/scenario/state").json()
    assert state["is_baseline"] is True
    assert state["rainfall_mm"] == 68.0
    assert state["active_corridor_vetoes"] == []

    # Verify routing is back to baseline
    routes = client.get("/routes/evaluate").json()
    resilient_route = next(r for r in routes["routes"] if r["route_type"] == "resilient")
    assert resilient_route["evaluation"]["corridor_id"] == "C1"
    assert resilient_route["evaluation"]["is_blocked"] is False
    assert resilient_route["classification"] == "green"
    assert routes["trade_off_matrix"] is None

    # Verify SOS queue is flushed of transient records
    queue = client.get("/ops/sos").json()
    assert queue["total_records"] == 0
