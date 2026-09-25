"""Unit and Integration Tests for MargSetu Crowdsourcing & 500m Clustering (Build Order Item 4).

Verifies:
1. Single report submission -> status pending, amber unverified, cluster created.
2. 500m Haversine deduplication -> second report within 500m merges into same cluster.
3. Compound corroboration -> 2 reports with rainfall > 50mm transitions to verified blockage.
4. Triple report corroboration -> 3 reports regardless of rain transitions to verified blockage.
5. Operator actions -> acknowledge, assign, resolve, false_positive, approve_detour.
6. Audit log entry generation with operator_id, timestamp, and reason.
7. Dynamic linkage to RouteService: verified cluster on Sonapur triggers C1 hard veto in /routes/evaluate.
8. Honesty labels and Rule 2 NDMA disclaimers on all outputs.
"""

from fastapi.testclient import TestClient
import pytest

from main import app
from models.schemas import (
    AUTHORITY_NAME,
    AUTHORITY_NOTICE,
    HonestyLabel,
    IncidentStatus,
    OperatorActionType,
    RouteType,
)
from services.report_service import haversine_distance_meters


@pytest.fixture
def client():
    """Create test client within app lifespan."""
    with TestClient(app) as test_client:
        yield test_client


def test_haversine_distance_accuracy():
    """Verify Haversine spherical formula accuracy."""
    # Sonapur Tunnel: 25.1147°N, 92.3654°E
    # Point ~100m north: 25.1156°N, 92.3654°E
    d = haversine_distance_meters(25.1147, 92.3654, 25.1156, 92.3654)
    assert 95.0 <= d <= 105.0, f"Expected ~100m distance, got {d:.2f}m"

    # Same point distance is 0
    d_zero = haversine_distance_meters(25.1147, 92.3654, 25.1147, 92.3654)
    assert d_zero == 0.0


def test_single_report_submission_pending_amber(client):
    """1. Single report submission -> status pending, amber unverified, cluster created."""
    payload = {
        "user_id_hash": "user-sha256-abc1",
        "location": {
            "latitude": 25.4411,
            "longitude": 92.2033,
            "landmark_name": "Jowai Bypass",
        },
        "incident_type": "landslide",
        "severity": "MEDIUM",
        "rainfall_mm_reported": 10.0,
    }
    response = client.post("/reports", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["action_taken"] == "created"
    assert data["status"] == IncidentStatus.PENDING.value
    assert data["is_confirmed_blockage"] is False
    assert "CLUSTER-JOWAI" in data["cluster"]["cluster_id"]
    assert data["cluster"]["reports_count"] == 1
    assert data["honesty_label"] == HonestyLabel.USER_SUBMITTED.value
    assert data["authority"] == AUTHORITY_NAME


def test_500m_haversine_clustering_merge(client):
    """2. 500m Haversine deduplication -> second report within 500m merges into same cluster."""
    # Report 1 at Shillong Peak Bypass
    rep1 = {
        "user_id_hash": "user-shillong-01",
        "location": {"latitude": 25.5788, "longitude": 91.8933, "landmark_name": "Shillong Node"},
        "incident_type": "rockfall",
        "rainfall_mm_reported": 15.0,
    }
    res1 = client.post("/reports", json=rep1)
    assert res1.status_code == 200
    cluster_id = res1.json()["cluster"]["cluster_id"]

    # Report 2 ~200m away (lat + 0.0018° ~200m)
    rep2 = {
        "user_id_hash": "user-shillong-02",
        "location": {"latitude": 25.5800, "longitude": 91.8938},
        "incident_type": "rockfall",
        "rainfall_mm_reported": 20.0,
    }
    res2 = client.post("/reports", json=rep2)
    assert res2.status_code == 200
    data2 = res2.json()

    assert data2["action_taken"] == "merged"
    assert data2["cluster"]["cluster_id"] == cluster_id
    assert data2["cluster"]["reports_count"] == 2

    # Report 3 far away in Guwahati (~65km away) -> creates separate cluster
    rep3 = {
        "user_id_hash": "user-guwahati-01",
        "location": {"latitude": 26.1445, "longitude": 91.7362},
        "incident_type": "waterlogging",
        "rainfall_mm_reported": 10.0,
    }
    res3 = client.post("/reports", json=rep3)
    assert res3.status_code == 200
    data3 = res3.json()
    assert data3["action_taken"] == "created"
    assert data3["cluster"]["cluster_id"] != cluster_id
    assert "GUWAHATI" in data3["cluster"]["cluster_id"]


def test_compound_corroboration_two_reports_rain_over_50mm(client):
    """3. Compound corroboration -> 2 reports with rainfall > 50mm transitions to verified blockage."""
    # Submitting 2 reports near Khliehriat with 65mm rainfall
    rep1 = {
        "user_id_hash": "user-khl-01",
        "location": {"latitude": 25.3524, "longitude": 92.3643, "landmark_name": "Khliehriat Slope"},
        "incident_type": "landslide",
        "rainfall_mm_reported": 65.0,
    }
    res1 = client.post("/reports", json=rep1)
    assert res1.status_code == 200
    assert res1.json()["status"] == IncidentStatus.PENDING.value

    # Second report within 300m
    rep2 = {
        "user_id_hash": "user-khl-02",
        "location": {"latitude": 25.3540, "longitude": 92.3650},
        "incident_type": "landslide",
        "rainfall_mm_reported": 65.0,
    }
    res2 = client.post("/reports", json=rep2)
    assert res2.status_code == 200
    data2 = res2.json()

    # Verified blockage triggered: 2 reports + rain > 50mm
    assert data2["status"] == IncidentStatus.VERIFIED.value
    assert data2["is_confirmed_blockage"] is True
    assert data2["cluster"]["reports_count"] == 2


def test_triple_report_corroboration_any_weather(client):
    """4. Triple report corroboration -> 3 reports regardless of rain transitions to verified blockage."""
    base_lat, base_lon = 25.9015, 91.8803  # Nongpoh

    # Report 1
    r1 = client.post("/reports", json={
        "user_id_hash": "u1", "location": {"latitude": base_lat, "longitude": base_lon},
        "incident_type": "road_collapse", "rainfall_mm_reported": 0.0,
    })
    assert r1.json()["status"] == IncidentStatus.PENDING.value

    # Report 2 (150m away)
    r2 = client.post("/reports", json={
        "user_id_hash": "u2", "location": {"latitude": base_lat + 0.001, "longitude": base_lon},
        "incident_type": "road_collapse", "rainfall_mm_reported": 0.0,
    })
    assert r2.json()["status"] == IncidentStatus.CORROBORATED.value
    assert r2.json()["is_confirmed_blockage"] is False

    # Report 3 (250m away) -> automatically promotes to VERIFIED
    r3 = client.post("/reports", json={
        "user_id_hash": "u3", "location": {"latitude": base_lat - 0.001, "longitude": base_lon},
        "incident_type": "road_collapse", "rainfall_mm_reported": 0.0,
    })
    data3 = r3.json()
    assert data3["status"] == IncidentStatus.VERIFIED.value
    assert data3["is_confirmed_blockage"] is True
    assert data3["cluster"]["reports_count"] == 3


def test_operator_actions_lifecycle(client):
    """5. Operator actions -> acknowledge, assign, resolve, false_positive, approve_detour."""
    # Seed cluster
    seed_res = client.post("/reports", json={
        "user_id_hash": "user-op-test",
        "location": {"latitude": 25.1667, "longitude": 93.0245, "landmark_name": "Haflong Pass"},
        "incident_type": "rockfall",
    })
    cluster_id = seed_res.json()["cluster"]["cluster_id"]

    # Action 1: Acknowledge
    ack_res = client.post(f"/ops/incidents/{cluster_id}/action", json={
        "operator_id": "NDMA-DUTY-OFFICER-01",
        "action": OperatorActionType.ACKNOWLEDGE.value,
        "reason": "Initial citizen report reviewed by monitoring desk",
    })
    assert ack_res.status_code == 200
    assert ack_res.json()["success"] is True

    # Action 2: Approve Detour (forces verified)
    detour_res = client.post(f"/ops/incidents/{cluster_id}/action", json={
        "operator_id": "NDMA-DUTY-OFFICER-01",
        "action": OperatorActionType.APPROVE_DETOUR.value,
        "reason": "Confirmed severe debris spill; traffic redirection approved",
    })
    assert detour_res.status_code == 200
    assert detour_res.json()["new_status"] == IncidentStatus.VERIFIED.value

    # Action 3: Resolve (cleared)
    resolve_res = client.post(f"/ops/incidents/{cluster_id}/action", json={
        "operator_id": "NDMA-DUTY-OFFICER-01",
        "action": OperatorActionType.RESOLVE.value,
        "reason": "Excavator cleared road debris; corridor passable",
    })
    assert resolve_res.status_code == 200
    assert resolve_res.json()["new_status"] == IncidentStatus.RESOLVED.value


def test_operator_audit_logging(client):
    """6. Audit log entry generation with operator_id, timestamp, and reason."""
    seed_res = client.post("/reports", json={
        "user_id_hash": "user-audit",
        "location": {"latitude": 24.8333, "longitude": 92.7976},
        "incident_type": "flood",
    })
    cluster_id = seed_res.json()["cluster"]["cluster_id"]

    action_res = client.post(f"/ops/incidents/{cluster_id}/action", json={
        "operator_id": "NDMA-FIELD-COMMANDER-09",
        "action": OperatorActionType.ASSIGN.value,
        "reason": "Water pump brigade dispatched to clear waterlogging",
    })
    assert action_res.status_code == 200
    data = action_res.json()

    audit = data["audit_entry"]
    assert audit["operator_id"] == "NDMA-FIELD-COMMANDER-09"
    assert audit["action"] == OperatorActionType.ASSIGN.value
    assert "Water pump brigade" in audit["reason"]
    assert audit["authority"] == AUTHORITY_NAME
    assert audit["disclaimer"] == AUTHORITY_NOTICE
    assert audit["honesty_label"] == HonestyLabel.SIMULATION.value
    assert "timestamp" in audit


def test_dynamic_linkage_to_routing(client):
    """7. Dynamic linkage: confirmed cluster on Sonapur triggers C1 hard veto in /routes/evaluate."""
    sonapur_lat, sonapur_lon = 25.1147, 92.3654

    # 1. Baseline route check: C1 NH-6 should be clear and recommended
    base_eval = client.get("/routes/evaluate?origin=Guwahati&dest=Silchar&vehicle=commercial_light")
    assert base_eval.status_code == 200
    c1_route = next(r for r in base_eval.json()["routes"] if r["evaluation"]["corridor_id"] == "C1")
    assert c1_route["evaluation"]["is_blocked"] is False

    # 2. Submit 3 reports directly at Sonapur Tunnel to trigger a confirmed blockage
    for i in range(3):
        client.post("/reports", json={
            "user_id_hash": f"sonapur-reporter-{i}",
            "location": {"latitude": sonapur_lat, "longitude": sonapur_lon, "landmark_name": "Sonapur Tunnel Portal"},
            "incident_type": "landslide",
            "is_blocked": True,
            "rainfall_mm_reported": 40.0,
        })

    # 3. Re-evaluate routes: C1 must now be automatically vetoed and C2 Detour recommended!
    blocked_eval = client.get("/routes/evaluate?origin=Guwahati&dest=Silchar&vehicle=commercial_light")
    assert blocked_eval.status_code == 200
    b_data = blocked_eval.json()

    assert b_data["recommended_route_type"] == RouteType.RESILIENT.value
    c1_blocked = next(r for r in b_data["routes"] if r["evaluation"]["corridor_id"] == "C1")
    assert c1_blocked["evaluation"]["is_blocked"] is True

    c2_resilient = next(r for r in b_data["routes"] if r["route_type"] == RouteType.RESILIENT.value)
    assert c2_resilient["evaluation"]["corridor_id"] == "C2"
    assert c2_resilient["is_recommended"] is True

    # 4. Operator resolves the Sonapur cluster -> C1 unblocks!
    reports_list = client.get("/reports")
    sonapur_cluster = next(c for c in reports_list.json()["clusters"] if "SONAPUR" in c["cluster_id"])
    cluster_id = sonapur_cluster["cluster_id"]

    resolve_res = client.post(f"/ops/incidents/{cluster_id}/action", json={
        "operator_id": "NDMA-CHIEF-OPS",
        "action": OperatorActionType.RESOLVE.value,
        "reason": "Border Roads clearing completed; tunnel portal reopen",
    })
    assert resolve_res.status_code == 200

    # Re-evaluate routes: C1 is unblocked!
    unblocked_eval = client.get("/routes/evaluate?origin=Guwahati&dest=Silchar&vehicle=commercial_light")
    assert unblocked_eval.status_code == 200
    c1_unblocked = next(r for r in unblocked_eval.json()["routes"] if r["evaluation"]["corridor_id"] == "C1")
    assert c1_unblocked["evaluation"]["is_blocked"] is False


def test_honesty_labels_and_ndma_integrity(client):
    """8. Honesty labels and Rule 2 NDMA disclaimers on all outputs."""
    # Test GET /reports response structure
    res = client.get("/reports")
    assert res.status_code == 200
    data = res.json()

    assert data["authority"] == AUTHORITY_NAME
    assert data["disclaimer"] == AUTHORITY_NOTICE
    assert data["honesty_label"] == HonestyLabel.USER_SUBMITTED.value

    # Check member reports carry USER-SUBMITTED
    for c in data["clusters"]:
        assert c["authority_notice"] == AUTHORITY_NOTICE
        assert c["honesty_label"] == HonestyLabel.USER_SUBMITTED.value
        for r in c["reports"]:
            assert r["honesty_label"] == HonestyLabel.USER_SUBMITTED.value
            assert r["authority_notice"] == AUTHORITY_NOTICE
