"""Unit and Integration Tests for MargSetu Backend Build Order Item 1.

Verifies:
- GET /health endpoint and HealthResponse schema
- Authority Integrity: NDMA is sole authority, disclaimer is present
- Corridors GeoJSON structure and coordinates
- Config JSON seasonal weights, vehicle modifiers, veto thresholds, edge cost parameters
- Pydantic v2 schemas: GeoLocation, IncidentReport, RouteEvaluation
"""

import json
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from main import app
from models.schemas import (
    AUTHORITY_NAME,
    AUTHORITY_NOTICE,
    GeoLocation,
    HonestyLabel,
    IncidentReport,
    IncidentType,
    RouteEvaluation,
    VehicleType,
)


@pytest.fixture
def client():
    """Create test client within app lifespan."""
    with TestClient(app) as test_client:
        yield test_client


def test_root_endpoint(client):
    """Test GET / returns basic metadata and simulation notice."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["service"] == "MargSetu Core Engine"
    assert data["authority"] == AUTHORITY_NAME
    assert data["disclaimer"] == AUTHORITY_NOTICE
    assert data["honesty_label"] == HonestyLabel.VERIFIED_STATIC.value


def test_health_endpoint(client):
    """Test GET /health returns HTTP 200, healthy status, 3 corridors, and NDMA disclaimer."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "MargSetu Core Engine"
    assert data["version"] == "2.0.0"
    assert data["authority"] == "NDMA"
    assert data["disclaimer"] == "SIMULATION — not connected to official NDMA systems"
    assert data["honesty_label"] == "VERIFIED STATIC"
    assert data["corridors_loaded"] == 3
    assert data["config_loaded"] is True
    assert "timestamp" in data


def test_corridors_geojson():
    """Verify corridor GeoJSON contains C1, C2, C3 and Sonapur Tunnel coordinates."""
    geojson_path = Path(__file__).resolve().parent.parent / "data" / "corridors.geojson"
    assert geojson_path.exists(), "corridors.geojson missing"

    with open(geojson_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    assert data.get("type") == "FeatureCollection"
    features = data.get("features", [])
    assert len(features) == 3, f"Expected 3 corridors, found {len(features)}"

    corridor_ids = {feat["properties"]["corridor_id"] for feat in features}
    assert corridor_ids == {"C1", "C2", "C3"}

    # Verify C1 Sonapur Tunnel
    c1 = next(feat for feat in features if feat["properties"]["corridor_id"] == "C1")
    assert "Sonapur Tunnel" in c1["properties"]["corridor_name"]
    chokepoints = c1["properties"]["critical_chokepoints"]
    sonapur = next(cp for cp in chokepoints if cp["name"] == "Sonapur Tunnel")
    # Coordinates in GeoJSON RFC 7946 are [lon, lat]
    lon, lat = sonapur["coordinates"]
    assert round(lon, 4) == 92.3654
    assert round(lat, 4) == 25.1147

    # Verify all features have VERIFIED STATIC and NDMA disclaimer
    for feat in features:
        props = feat["properties"]
        assert props["honesty_label"] == "VERIFIED STATIC"
        assert props["authority_notice"] == "SIMULATION — not connected to official NDMA systems"
        coords = feat["geometry"]["coordinates"]
        for pt in coords:
            pt_lon, pt_lat = pt
            assert 88.0 <= pt_lon <= 98.0, f"Longitude {pt_lon} out of NE bounds"
            assert 20.0 <= pt_lat <= 30.0, f"Latitude {pt_lat} out of NE bounds"


def test_config_json_parameters():
    """Verify config.json contains all PRD §3 parameters."""
    cfg_path = Path(__file__).resolve().parent.parent / "data" / "config.json"
    assert cfg_path.exists(), "config.json missing"

    with open(cfg_path, "r", encoding="utf-8") as f:
        cfg = json.load(f)

    # Authority integrity
    assert cfg["system"]["authority"] == "NDMA"
    assert "SIMULATION — not connected to official NDMA systems" in cfg["system"]["disclaimer"]

    # Seasonal weights (Monsoon, Post-monsoon, Winter, Pre-monsoon)
    seasonal = cfg["seasonal_weights"]
    assert seasonal["monsoon"]["weights"] == [0.40, 0.30, 0.15, 0.10, 0.05]
    assert seasonal["post_monsoon"]["weights"] == [0.25, 0.35, 0.20, 0.10, 0.10]
    assert seasonal["winter"]["weights"] == [0.15, 0.25, 0.10, 0.10, 0.40]
    assert seasonal["pre_monsoon"]["weights"] == [0.30, 0.30, 0.15, 0.15, 0.10]

    # Vehicle modifiers
    vm = cfg["vehicle_modifiers"]
    assert vm["heavy_freight"]["risk_modifier"] == 0.5
    assert vm["commercial_light"]["risk_modifier"] == 0.0
    assert vm["emergency"]["risk_modifier"] == -1.5
    assert vm["two_wheeler"]["risk_modifier"] == 0.0

    # Hard veto thresholds
    veto = cfg["hard_veto_thresholds"]
    assert veto["rainfall_mm_threshold"] == 75.0
    assert veto["slope_deg_threshold"] == 30.0
    assert veto["verified_crowd_incidents_threshold"] == 3

    # Edge cost formula
    assert "Ri / 2.5" in cfg["edge_cost_parameters"]["formula"]


def test_schema_geolocation_validation():
    """Verify GeoLocation validates bounding box and accuracy."""
    # Valid Northeast coordinate
    valid_loc = GeoLocation(latitude=25.1147, longitude=92.3654, accuracy_m=3.0)
    assert valid_loc.latitude == 25.1147
    assert valid_loc.longitude == 92.3654

    # Invalid latitude out of Northeast bounds (< 20.0 or > 30.0)
    with pytest.raises(ValidationError):
        GeoLocation(latitude=12.9716, longitude=77.5946)

    # Invalid longitude out of Northeast bounds (< 88.0 or > 98.0)
    with pytest.raises(ValidationError):
        GeoLocation(latitude=25.0, longitude=75.0)


def test_schema_incident_report_and_route_evaluation():
    """Verify IncidentReport and RouteEvaluation validation and honesty labels."""
    loc = GeoLocation(latitude=25.1147, longitude=92.3654)
    report = IncidentReport(
        user_id_hash="test-user-hash-123",
        location=loc,
        incident_type=IncidentType.LANDSLIDE,
        vehicle_type=VehicleType.COMMERCIAL_LIGHT,
    )
    assert report.honesty_label == HonestyLabel.USER_SUBMITTED
    assert report.authority_notice == "SIMULATION — not connected to official NDMA systems"

    route_eval = RouteEvaluation(
        corridor_name="NH-6 Guwahati-Silchar via Sonapur Tunnel",
        base_distance_km=310.0,
        effective_cost=620.0,
        average_risk_score=7.5,
        is_blocked=False,
        trade_off="Distance: 310km, Risk: 7.5",
        advisory_brief="Passable with caution",
    )
    assert route_eval.honesty_label == HonestyLabel.VERIFIED_STATIC
    assert route_eval.authority_notice == "SIMULATION — not connected to official NDMA systems"
