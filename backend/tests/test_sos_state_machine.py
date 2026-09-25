"""Unit and Integration Tests for MargSetu SOS State Machine & 4-Layer Cascade (Build Order Item 5).

PRD Reference: PRD v2.0 §2, §6, §7, §8, §9
Authority Integrity: NDMA is the ONLY authority named anywhere.
Strict Rule: State 'delivered' is NEVER represented as 'rescued'; is_dispatched=False is permanently enforced.

Verifies:
1. Happy path: initiated -> sending -> delivered -> acknowledged -> assigned -> resolved.
2. Safety rule verification: ensure 'delivered' is never labeled 'rescued' and is_dispatched=False is permanently enforced.
3. Failure & degraded connectivity transitions: timeout -> failed -> fallback_offered -> queued_offline -> retry_pending -> delivered.
4. 4-Layer cascade metadata and honest labeling (Layer 1 SIMULATION, Layer 2 SIMULATION, Layer 3 REAL OS hooks, Layer 4 SIMULATION).
5. Operator triage actions with immutable audit trail.
6. Coordinate validation (Sonapur chokepoint 25.1147°N, 92.3654°E) without location fabrication.
7. NDMA authority exclusivity and mandatory simulation disclaimers.
8. Active Ops queue filtering and backward compatibility.
"""

import re
from fastapi.testclient import TestClient
import pytest

from main import app
from models.schemas import (
    AUTHORITY_NAME,
    AUTHORITY_NOTICE,
    CascadeLayerInfo,
    GeoLocation,
    HonestyLabel,
    OperatorSOSActionRequest,
    OperatorSOSActionType,
    SOSFailureState,
    SOSLayer,
    SOSPayload,
    SOSRecord,
    SOSState,
    SOS_EMERGENCY_NOTICE,
)
from services.sos_service import SOSService


@pytest.fixture
def client():
    """Create test client within app lifespan."""
    with TestClient(app) as test_client:
        yield test_client


def test_sos_happy_path_lifecycle(client):
    """Test standard SOS progression: initiated -> sending -> delivered -> acknowledged -> assigned -> resolved."""
    payload = {
        "sender_id_hash": "driver_sonapur_101",
        "location": {"latitude": 25.1147, "longitude": 92.3654},
        "distress_type": "STRANDED_HAZARD",
        "urgency_level": "CRITICAL",
        "message": "Vehicle stranded due to active rockfall near Sonapur Tunnel portal",
        "network_condition": "online",
    }

    # 1. Citizen submits SOS
    post_resp = client.post("/sos", json=payload)
    assert post_resp.status_code == 201
    data = post_resp.json()
    event_id = data["event_id"]
    assert event_id.startswith("sos-")
    assert data["state"] == SOSState.DELIVERED.value
    assert data["failure_state"] == SOSFailureState.NONE.value
    assert data["is_dispatched"] is False
    assert data["status_label"] == "Signal Delivered to Queue - Awaiting Operator Review"
    assert len(data["cascade_layers"]) == 4

    # 2. Poll status endpoint
    poll_resp = client.get(f"/sos/{event_id}")
    assert poll_resp.status_code == 200
    poll_data = poll_resp.json()
    assert poll_data["state"] == SOSState.DELIVERED.value
    assert len(poll_data["audit_trail"]) >= 2  # INITIATED -> SENDING -> DELIVERED

    # 3. Operator acknowledges
    ack_resp = client.post(
        f"/ops/sos/{event_id}/action",
        json={
            "operator_id": "NDMA-OPS-01",
            "action": "acknowledge",
            "reason": "Operator monitoring Sonapur sector queue",
        },
    )
    assert ack_resp.status_code == 200
    ack_data = ack_resp.json()
    assert ack_data["state"] == SOSState.ACKNOWLEDGED.value
    assert ack_data["is_dispatched"] is False

    # 4. Operator assigns field inspection unit
    assign_resp = client.post(
        f"/ops/sos/{event_id}/action",
        json={
            "operator_id": "NDMA-OPS-01",
            "action": "assign",
            "reason": "Deploying simulated patrol unit to check Sonapur bypass clearance",
        },
    )
    assert assign_resp.status_code == 200
    assign_data = assign_resp.json()
    assert assign_data["state"] == SOSState.ASSIGNED.value
    assert assign_data["is_dispatched"] is False

    # 5. Operator marks resolved
    res_resp = client.post(
        f"/ops/sos/{event_id}/action",
        json={
            "operator_id": "NDMA-OPS-01",
            "action": "resolve",
            "reason": "Obstruction cleared and all stranded vehicles safely escorted",
        },
    )
    assert res_resp.status_code == 200
    res_data = res_resp.json()
    assert res_data["state"] == SOSState.RESOLVED.value
    assert res_data["is_dispatched"] is False

    # 6. Verify audit trail integrity on final poll
    final_poll = client.get(f"/sos/{event_id}").json()
    trail_actions = [e["action"] for e in final_poll["audit_trail"]]
    assert "ACKNOWLEDGE" in trail_actions
    assert "ASSIGN" in trail_actions
    assert "RESOLVE" in trail_actions


def test_safety_rule_delivered_never_rescued_and_no_dispatch(client):
    """Verify strict safety rule: 'delivered' is NEVER represented as 'rescued'; is_dispatched=False is strictly preserved."""
    payload = {
        "sender_id_hash": "safety_check_driver",
        "location": {"latitude": 25.1147, "longitude": 92.3654},
        "distress_type": "MUDFLOW_ISOLATION",
        "network_condition": "online",
    }
    resp = client.post("/sos", json=payload)
    data = resp.json()
    event_id = data["event_id"]

    # In delivered state, assert it is NEVER labeled 'rescued'
    assert "rescued" not in data["status_label"].lower()
    assert data["status_label"] == "Signal Delivered to Queue - Awaiting Operator Review"
    assert data["is_dispatched"] is False

    # Across all operator actions, verify is_dispatched remains strictly False
    for action in ["acknowledge", "assign", "resolve"]:
        act_resp = client.post(
            f"/ops/sos/{event_id}/action",
            json={"operator_id": "NDMA-SAFETY-AUDITOR", "action": action, "reason": "Verifying safety invariant"},
        )
        assert act_resp.status_code == 200
        step_data = act_resp.json()
        assert step_data["is_dispatched"] is False
        assert "rescued" not in step_data["status_label"].lower()


def test_degraded_network_and_failure_cascade(client):
    """Test timeout/offline scenario triggering fallback state machine and mesh/telephony activation."""
    payload = {
        "sender_id_hash": "offline_driver_valley",
        "location": {"latitude": 25.1147, "longitude": 92.3654},
        "distress_type": "LANDSLIDE_STRANDED",
        "network_condition": "offline",  # Simulates 5s IP timeout / network failure
    }

    # 1. Ingestion detects offline condition and transitions to fallback_offered
    resp = client.post("/sos", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    event_id = data["event_id"]

    assert data["state"] == SOSState.SENDING.value
    assert data["failure_state"] == SOSFailureState.FALLBACK_OFFERED.value
    assert "Offline Fallback Active" in data["status_label"]

    # 2. Verify state polling reflects fallback offered and active Layer 3 OS hooks
    poll_resp = client.get(f"/sos/{event_id}")
    poll_data = poll_resp.json()
    assert poll_data["failure_state"] == SOSFailureState.FALLBACK_OFFERED.value
    assert poll_data["active_layer"] == SOSLayer.LAYER_3_OS_HOOKS.value

    # 3. Simulate client queueing packet into mesh network
    sos_service: SOSService = app.state.sos_service
    record_mesh = sos_service.transition_offline_state(
        event_id, SOSFailureState.QUEUED_OFFLINE, reason="Stored in vehicle local DTN mesh cache"
    )
    assert record_mesh.failure_state == SOSFailureState.QUEUED_OFFLINE
    assert record_mesh.active_layer == SOSLayer.LAYER_2_MESH

    # 4. Simulate cell signal reconnection retry
    record_retry = sos_service.transition_offline_state(
        event_id, SOSFailureState.RETRY_PENDING, reason="Cellular carrier beacon detected"
    )
    assert record_retry.failure_state == SOSFailureState.RETRY_PENDING

    # 5. Transition to delivered upon successful reconnection
    record_delivered = sos_service.transition_offline_state(
        event_id, SOSFailureState.NONE, reason="Synchronized to NDMA queue via carrier backhaul"
    )
    assert record_delivered.state == SOSState.DELIVERED
    assert record_delivered.failure_state == SOSFailureState.NONE
    assert record_delivered.status_label == SOSService.DELIVERED_STATUS_LABEL


def test_four_layer_cascade_metadata(client):
    """Verify metadata and honest labeling across all 4 cascade transmission layers."""
    payload = {
        "sender_id_hash": "cascade_tester",
        "location": {"latitude": 25.1147, "longitude": 92.3654},
        "distress_type": "STRANDED_HAZARD",
        "network_condition": "online",
    }
    resp = client.post("/sos", json=payload)
    data = resp.json()
    layers = {l["layer"]: l for l in data["cascade_layers"]}

    # Layer 1: IP / Mobile Data
    l1 = layers[SOSLayer.LAYER_1_IP.value]
    assert l1["honesty_label"] == HonestyLabel.SIMULATION.value
    assert l1["details"]["simulated_timeout_seconds"] == 5
    assert l1["details"]["endpoint"] == "/sos"

    # Layer 2: Mesh Network Simulation
    l2 = layers[SOSLayer.LAYER_2_MESH.value]
    assert l2["honesty_label"] == HonestyLabel.SIMULATION.value
    assert "Sonapur-Portal-Node" in l2["details"]["corridor_nodes"]

    # Layer 3: Telephony OS Hooks (1077 / 112)
    l3 = layers[SOSLayer.LAYER_3_OS_HOOKS.value]
    assert l3["honesty_label"] == HonestyLabel.VERIFIED_STATIC.value
    assert "1077" in l3["details"]["emergency_numbers"]
    assert "112" in l3["details"]["emergency_numbers"]
    assert l3["details"]["tel_uri_1077"] == "tel:1077"
    assert l3["details"]["tel_uri_112"] == "tel:112"
    assert l3["details"]["sms_char_count"] <= 160
    assert "25.1147N, 92.3654E" in l3["details"]["sms_body"]
    assert "[NDMA-SIM]" in l3["details"]["sms_body"]

    # Layer 4: Physical Evacuation Vector (Air Rescue Simulation)
    l4 = layers[SOSLayer.LAYER_4_AIR_VECTOR.value]
    assert l4["honesty_label"] == HonestyLabel.SIMULATION.value
    assert l4["details"]["ops_view_only"] is True
    assert l4["details"]["live_dispatch_active"] is False
    assert l4["details"]["target_coordinates"]["latitude"] == 25.1147
    assert l4["details"]["target_coordinates"]["longitude"] == 92.3654


def test_operator_triage_actions_and_audit_log(client):
    """Verify operator triage actions generate immutable audit log entries with operator IDs."""
    payload = {
        "sender_id_hash": "audit_tester",
        "location": {"latitude": 25.1147, "longitude": 92.3654},
    }
    resp = client.post("/sos", json=payload)
    event_id = resp.json()["event_id"]

    # Action 1: Acknowledge
    ack_res = client.post(
        f"/ops/sos/{event_id}/action",
        json={"operator_id": "NDMA-OPS-09", "action": "acknowledge", "reason": "Shift handover triage"},
    )
    assert ack_res.status_code == 200

    # Action 2: Trigger Fallback
    fb_res = client.post(
        f"/ops/sos/{event_id}/action",
        json={"operator_id": "NDMA-OPS-09", "action": "trigger_fallback", "reason": "Degraded radio signal"},
    )
    assert fb_res.status_code == 200

    # Poll and check audit trail
    poll = client.get(f"/sos/{event_id}").json()
    audit_logs = poll["audit_trail"]
    op_entries = [e for e in audit_logs if e["operator_id"] == "NDMA-OPS-09"]
    assert len(op_entries) == 2
    assert op_entries[0]["action"] == "ACKNOWLEDGE"
    assert op_entries[0]["authority"] == AUTHORITY_NAME
    assert op_entries[0]["disclaimer"] == AUTHORITY_NOTICE
    assert op_entries[0]["emergency_notice"] == SOS_EMERGENCY_NOTICE
    assert op_entries[1]["action"] == "TRIGGER_FALLBACK"

    # Action on non-existent event returns 404
    missing_resp = client.post(
        "/ops/sos/sos-nonexistent/action",
        json={"operator_id": "NDMA-OPS-09", "action": "acknowledge", "reason": "Test non-existent"},
    )
    assert missing_resp.status_code == 404


def test_coordinate_integrity_sonapur(client):
    """Verify coordinates at Sonapur chokepoint (25.1147°N, 92.3654°E) are faithfully preserved."""
    sonapur_lat = 25.1147
    sonapur_lon = 92.3654

    payload = {
        "sender_id_hash": "sonapur_driver_exact",
        "location": {"latitude": sonapur_lat, "longitude": sonapur_lon},
        "distress_type": "STRANDED_HAZARD",
    }
    resp = client.post("/sos", json=payload)
    data = resp.json()
    event_id = data["event_id"]

    poll = client.get(f"/sos/{event_id}").json()
    assert abs(poll["location"]["latitude"] - sonapur_lat) < 1e-4
    assert abs(poll["location"]["longitude"] - sonapur_lon) < 1e-4

    # Check Layer 3 SMS body includes exact coordinates formatted
    l3 = [l for l in poll["cascade_layers"] if l["layer"] == SOSLayer.LAYER_3_OS_HOOKS.value][0]
    assert f"{sonapur_lat:.4f}N, {sonapur_lon:.4f}E" in l3["details"]["sms_body"]

    # Check Layer 4 target coordinates match exact location
    l4 = [l for l in poll["cascade_layers"] if l["layer"] == SOSLayer.LAYER_4_AIR_VECTOR.value][0]
    assert l4["details"]["target_coordinates"]["latitude"] == sonapur_lat
    assert l4["details"]["target_coordinates"]["longitude"] == sonapur_lon


def test_ndma_authority_exclusivity_and_dual_disclaimers(client):
    """Verify NDMA is the ONLY authority named and both mandatory disclaimers are present."""
    payload = {
        "sender_id_hash": "authority_integrity_check",
        "location": {"latitude": 25.1147, "longitude": 92.3654},
    }
    resp = client.post("/sos", json=payload)
    data = resp.json()

    # 1. Verify authority exclusivity
    assert data["authority"] == "NDMA"
    assert data["disclaimer"] == AUTHORITY_NOTICE
    assert data["emergency_notice"] == SOS_EMERGENCY_NOTICE

    # 2. Check serialization of queue endpoint
    queue_resp = client.get("/ops/sos")
    assert queue_resp.status_code == 200
    queue_data = queue_resp.json()
    assert queue_data["authority"] == "NDMA"
    assert queue_data["disclaimer"] == AUTHORITY_NOTICE
    assert queue_data["emergency_notice"] == SOS_EMERGENCY_NOTICE

    # 3. Regex check: zero mention of unauthorized response agencies
    serialized_text = str(data) + str(queue_data)
    prohibited_authorities = ["NDRF", "SDRF", "NHAI", "BRO", "Police", "Indian Army"]
    for prohibited in prohibited_authorities:
        assert not re.search(rf"\b{prohibited}\b", serialized_text), (
            f"Prohibited authority '{prohibited}' found in payload. NDMA must be sole authority."
        )


def test_ops_queue_filtering_and_backward_compatibility(client):
    """Verify Ops queue listing, state filtering, and backward-compatible service methods."""
    # 1. Post two distinct records
    client.post(
        "/sos",
        json={
            "sender_id_hash": "driver_filter_1",
            "location": {"latitude": 25.1147, "longitude": 92.3654},
            "network_condition": "online",
        },
    )
    client.post(
        "/sos",
        json={
            "sender_id_hash": "driver_filter_2",
            "location": {"latitude": 25.1150, "longitude": 92.3660},
            "network_condition": "offline",
        },
    )

    # 2. Ops queue unfiltered
    all_queue = client.get("/ops/sos").json()
    assert all_queue["total_records"] >= 2

    # 3. Ops queue filtered by state
    delivered_queue = client.get("/ops/sos?state=delivered").json()
    for rec in delivered_queue["records"]:
        assert rec["state"] == "delivered"

    # 4. Backward-compatible service calls
    sos_service: SOSService = app.state.sos_service
    compat_alert = sos_service.trigger_sos(
        sender_id_hash="driver_compat",
        location=GeoLocation(latitude=25.1147, longitude=92.3654),
        distress_type="LEGACY_SOS",
    )
    assert compat_alert.is_dispatched is False
    assert compat_alert.honesty_label == HonestyLabel.SIMULATION
    assert compat_alert.authority_notice == AUTHORITY_NOTICE

    queued_alerts = sos_service.get_queued_alerts()
    assert len(queued_alerts) >= 1
