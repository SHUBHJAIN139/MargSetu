"""Unit Tests for MargSetu Deterministic Risk Engine (Build Order Item 2).

Verifies all 10 mandated criteria:
1. Baseline dry condition Ri < 4 -> green
2. Moderate rain/slope Ri 4-6 -> amber
3. Severe conditions Ri > 6 -> red
4. Hard veto gate: (rainfall_mm > 75 and slope_deg > 30) -> cost = inf, is_blocked = true, veto_reason
5. Hard veto gate: verified_crowd_incidents >= 3 -> cost = inf, is_blocked = true, veto_reason
6. Hard veto gate: ndma_override == true -> cost = inf, is_blocked = true, veto_reason
7. Seasonal weight transitions (Monsoon vs Winter)
8. Vehicle modifiers: heavy_freight (+0.5), commercial_light (0.0), ambulance/emergency (-1.5)
9. Edge cost calculation: cost_km = distance_km * (1 + exp(Ri / 2.5))
10. Segment risk breakdown dict generation for UI component bar
"""

import json
import math
from pathlib import Path
import pytest

from models.schemas import (
    AUTHORITY_NAME,
    AUTHORITY_NOTICE,
    HonestyLabel,
    RiskClassification,
    SegmentRiskBreakdown,
    VehicleType,
)
from services.risk_service import RiskService


@pytest.fixture
def config():
    cfg_path = Path(__file__).resolve().parent.parent / "data" / "config.json"
    with open(cfg_path, "r", encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture
def risk_service(config):
    return RiskService(config)


def test_baseline_dry_condition_green(risk_service):
    """1. Baseline dry condition Ri < 4 -> green."""
    # Low inputs in monsoon: 0.4*1.0 + 0.3*2.0 + 0.15*1.0 + 0.1*0.0 + 0.05*1.0 = 1.20
    ri = risk_service.calculate_segment_risk(
        season="monsoon",
        r_rain=1.0,
        r_slope=2.0,
        r_soil=1.0,
        r_crowd=0.0,
        r_hist=1.0,
        vehicle_type=VehicleType.COMMERCIAL_LIGHT,
    )
    assert ri < 4.0, f"Expected Ri < 4.0, got {ri}"
    assert ri == 1.20

    status = risk_service.classify_risk_status(ri, is_blocked=False)
    assert status == RiskClassification.GREEN

    breakdown = risk_service.generate_segment_breakdown(
        corridor_id="C1",
        distance_km=50.0,
        season="monsoon",
        r_rain=1.0,
        r_slope=2.0,
        r_soil=1.0,
        r_crowd=0.0,
        r_hist=1.0,
        rainfall_mm=10.0,
        slope_deg=12.0,
    )
    assert breakdown.classification == RiskClassification.GREEN
    assert breakdown.is_blocked is False


def test_moderate_rain_slope_amber(risk_service):
    """2. Moderate rain/slope Ri 4-6 -> amber."""
    # Moderate inputs: 0.4*5.0 + 0.3*5.0 + 0.15*4.0 + 0.1*3.0 + 0.05*2.0 = 4.50
    ri = risk_service.calculate_segment_risk(
        season="monsoon",
        r_rain=5.0,
        r_slope=5.0,
        r_soil=4.0,
        r_crowd=3.0,
        r_hist=2.0,
        vehicle_type=VehicleType.COMMERCIAL_LIGHT,
    )
    assert 4.0 <= ri <= 6.0, f"Expected 4.0 <= Ri <= 6.0, got {ri}"
    assert ri == 4.50

    status = risk_service.classify_risk_status(ri, is_blocked=False)
    assert status == RiskClassification.AMBER

    breakdown = risk_service.generate_segment_breakdown(
        corridor_id="C1",
        distance_km=50.0,
        season="monsoon",
        r_rain=5.0,
        r_slope=5.0,
        r_soil=4.0,
        r_crowd=3.0,
        r_hist=2.0,
        rainfall_mm=45.0,
        slope_deg=22.0,
    )
    assert breakdown.classification == RiskClassification.AMBER
    assert breakdown.is_blocked is False


def test_severe_conditions_red(risk_service):
    """3. Severe conditions Ri > 6 -> red."""
    # High inputs: 0.4*8.5 + 0.3*8.0 + 0.15*7.0 + 0.1*5.0 + 0.05*6.0 = 7.65
    ri = risk_service.calculate_segment_risk(
        season="monsoon",
        r_rain=8.5,
        r_slope=8.0,
        r_soil=7.0,
        r_crowd=5.0,
        r_hist=6.0,
        vehicle_type=VehicleType.COMMERCIAL_LIGHT,
    )
    assert ri > 6.0, f"Expected Ri > 6.0, got {ri}"
    assert ri == 7.65

    status = risk_service.classify_risk_status(ri, is_blocked=False)
    assert status == RiskClassification.RED

    breakdown = risk_service.generate_segment_breakdown(
        corridor_id="C1",
        distance_km=50.0,
        season="monsoon",
        r_rain=8.5,
        r_slope=8.0,
        r_soil=7.0,
        r_crowd=5.0,
        r_hist=6.0,
        rainfall_mm=70.0,
        slope_deg=28.0,
    )
    assert breakdown.classification == RiskClassification.RED
    assert breakdown.is_blocked is False


def test_hard_veto_compound_hazard(risk_service):
    """4. Hard veto gate: (rainfall_mm > 75 and slope_deg > 30) -> cost = inf, is_blocked = true, veto_reason."""
    rainfall_mm = 85.0
    slope_deg = 34.0

    is_blocked, veto_reason = risk_service.evaluate_veto_conditions(
        rainfall_mm=rainfall_mm,
        slope_deg=slope_deg,
        verified_incidents_count=0,
    )
    assert is_blocked is True
    assert "Compound Hazard Veto" in veto_reason
    assert "85.0mm" in veto_reason
    assert "34.0°" in veto_reason

    cost = risk_service.calculate_edge_cost(distance_km=40.0, risk_score_ri=8.0, is_blocked=is_blocked)
    assert cost == float("inf")

    # Commercial vehicle -> DARK_RED
    breakdown_comm = risk_service.generate_segment_breakdown(
        corridor_id="C1",
        distance_km=40.0,
        season="monsoon",
        r_rain=8.5,
        r_slope=8.5,
        r_soil=8.0,
        r_crowd=2.0,
        r_hist=7.0,
        rainfall_mm=rainfall_mm,
        slope_deg=slope_deg,
        vehicle_type=VehicleType.COMMERCIAL_LIGHT,
    )
    assert breakdown_comm.is_blocked is True
    assert breakdown_comm.classification == RiskClassification.DARK_RED
    assert breakdown_comm.effective_edge_cost == float("inf")

    # Emergency vehicle -> PURPLE (emergency bypass permitted)
    breakdown_emerg = risk_service.generate_segment_breakdown(
        corridor_id="C1",
        distance_km=40.0,
        season="monsoon",
        r_rain=8.5,
        r_slope=8.5,
        r_soil=8.0,
        r_crowd=2.0,
        r_hist=7.0,
        rainfall_mm=rainfall_mm,
        slope_deg=slope_deg,
        vehicle_type=VehicleType.EMERGENCY,
    )
    assert breakdown_emerg.is_blocked is True
    assert breakdown_emerg.classification == RiskClassification.PURPLE


def test_hard_veto_crowd_incidents(risk_service):
    """5. Hard veto gate: verified_crowd_incidents >= 3 -> cost = inf, is_blocked = true, veto_reason."""
    is_blocked, veto_reason = risk_service.evaluate_veto_conditions(
        rainfall_mm=20.0,
        slope_deg=15.0,
        verified_incidents_count=3,
    )
    assert is_blocked is True
    assert "Corroborated Blockage Veto" in veto_reason
    assert "3 verified crowd incidents" in veto_reason

    cost = risk_service.calculate_edge_cost(distance_km=60.0, risk_score_ri=5.0, is_blocked=is_blocked)
    assert cost == float("inf")

    breakdown = risk_service.generate_segment_breakdown(
        corridor_id="C1",
        distance_km=60.0,
        season="monsoon",
        r_rain=3.0,
        r_slope=3.0,
        r_soil=3.0,
        r_crowd=8.0,
        r_hist=3.0,
        verified_incidents_count=3,
    )
    assert breakdown.is_blocked is True
    assert breakdown.classification == RiskClassification.DARK_RED
    assert breakdown.effective_edge_cost == float("inf")


def test_hard_veto_ndma_override(risk_service):
    """6. Hard veto gate: ndma_override == true -> cost = inf, is_blocked = true, veto_reason."""
    is_blocked, veto_reason = risk_service.evaluate_veto_conditions(
        rainfall_mm=0.0,
        slope_deg=0.0,
        verified_incidents_count=0,
        ndma_override_active=True,
    )
    assert is_blocked is True
    assert f"{AUTHORITY_NAME} Administrative Safety Override" in veto_reason

    cost = risk_service.calculate_edge_cost(distance_km=25.0, risk_score_ri=1.0, is_blocked=is_blocked)
    assert cost == float("inf")

    breakdown = risk_service.generate_segment_breakdown(
        corridor_id="C2",
        distance_km=25.0,
        season="monsoon",
        r_rain=1.0,
        r_slope=1.0,
        r_soil=1.0,
        r_crowd=0.0,
        r_hist=1.0,
        ndma_override_active=True,
    )
    assert breakdown.is_blocked is True
    assert breakdown.classification == RiskClassification.DARK_RED
    assert breakdown.effective_edge_cost == float("inf")


def test_seasonal_weight_transitions(risk_service):
    """7. Seasonal weight transitions (Monsoon vs Winter)."""
    # Test high rain impact: rain=9.0, others=1.0
    rain_monsoon = risk_service.calculate_segment_risk(
        season="monsoon",
        r_rain=9.0,
        r_slope=1.0,
        r_soil=1.0,
        r_crowd=1.0,
        r_hist=1.0,
    )
    rain_winter = risk_service.calculate_segment_risk(
        season="winter",
        r_rain=9.0,
        r_slope=1.0,
        r_soil=1.0,
        r_crowd=1.0,
        r_hist=1.0,
    )
    # In monsoon, rain weight is 0.40 vs 0.15 in winter
    assert rain_monsoon > rain_winter, f"Monsoon rain score {rain_monsoon} should exceed winter {rain_winter}"

    # Test high environmental/fog impact: hist=9.0, others=1.0
    env_monsoon = risk_service.calculate_segment_risk(
        season="monsoon",
        r_rain=1.0,
        r_slope=1.0,
        r_soil=1.0,
        r_crowd=1.0,
        r_hist=9.0,
    )
    env_winter = risk_service.calculate_segment_risk(
        season="winter",
        r_rain=1.0,
        r_slope=1.0,
        r_soil=1.0,
        r_crowd=1.0,
        r_hist=9.0,
    )
    # In winter, hist/environmental weight is 0.40 vs 0.05 in monsoon
    assert env_winter > env_monsoon, f"Winter environmental score {env_winter} should exceed monsoon {env_monsoon}"


def test_vehicle_modifiers(risk_service):
    """8. Vehicle modifiers: heavy_freight (+0.5), commercial_light (0.0), ambulance/emergency (-1.5)."""
    # Factors chosen so raw composite score = 5.0 in monsoon
    # 0.4*5 + 0.3*5 + 0.15*5 + 0.1*5 + 0.05*5 = 5.0
    score_comm = risk_service.calculate_segment_risk(
        season="monsoon",
        r_rain=5.0,
        r_slope=5.0,
        r_soil=5.0,
        r_crowd=5.0,
        r_hist=5.0,
        vehicle_type=VehicleType.COMMERCIAL_LIGHT,
    )
    score_heavy = risk_service.calculate_segment_risk(
        season="monsoon",
        r_rain=5.0,
        r_slope=5.0,
        r_soil=5.0,
        r_crowd=5.0,
        r_hist=5.0,
        vehicle_type=VehicleType.HEAVY_FREIGHT,
    )
    score_emerg = risk_service.calculate_segment_risk(
        season="monsoon",
        r_rain=5.0,
        r_slope=5.0,
        r_soil=5.0,
        r_crowd=5.0,
        r_hist=5.0,
        vehicle_type=VehicleType.EMERGENCY,
    )
    score_twowheel = risk_service.calculate_segment_risk(
        season="monsoon",
        r_rain=5.0,
        r_slope=5.0,
        r_soil=5.0,
        r_crowd=5.0,
        r_hist=5.0,
        vehicle_type=VehicleType.TWO_WHEELER,
    )

    assert score_comm == 5.00
    assert score_heavy == 5.50
    assert score_emerg == 3.50
    assert score_twowheel == 5.00

    assert round(score_heavy - score_comm, 2) == 0.50
    assert round(score_comm - score_emerg, 2) == 1.50


def test_edge_cost_calculation(risk_service):
    """9. Edge cost calculation: cost_km = distance_km * (1 + exp(Ri / 2.5))."""
    dist = 100.0

    # Ri = 0.0 -> cost = 100 * (1 + exp(0)) = 100 * 2.0 = 200.0
    cost_0 = risk_service.calculate_edge_cost(distance_km=dist, risk_score_ri=0.0)
    assert cost_0 == 200.0

    # Ri = 2.5 -> cost = 100 * (1 + exp(1)) = 100 * (1 + e) = 371.83
    cost_2_5 = risk_service.calculate_edge_cost(distance_km=dist, risk_score_ri=2.5)
    expected_2_5 = round(dist * (1.0 + math.exp(1.0)), 2)
    assert cost_2_5 == expected_2_5
    assert cost_2_5 == 371.83

    # Ri = 5.0 -> cost = 100 * (1 + exp(2)) = 100 * (1 + e^2) = 838.91
    cost_5_0 = risk_service.calculate_edge_cost(distance_km=dist, risk_score_ri=5.0)
    expected_5_0 = round(dist * (1.0 + math.exp(2.0)), 2)
    assert cost_5_0 == expected_5_0
    assert cost_5_0 == 838.91

    # Blocked -> inf
    cost_blocked = risk_service.calculate_edge_cost(distance_km=dist, risk_score_ri=5.0, is_blocked=True)
    assert cost_blocked == float("inf")


def test_segment_risk_breakdown_dict_for_ui(risk_service):
    """10. Segment risk breakdown dict generation for UI component bar."""
    breakdown = risk_service.generate_segment_breakdown(
        corridor_id="C1",
        segment_id="C1-SEG-04-SONAPUR",
        distance_km=35.0,
        season="monsoon",
        r_rain=7.0,
        r_slope=6.0,
        r_soil=5.0,
        r_crowd=4.0,
        r_hist=3.0,
        rainfall_mm=55.0,
        slope_deg=25.0,
        verified_incidents_count=1,
        vehicle_type=VehicleType.COMMERCIAL_LIGHT,
    )

    assert isinstance(breakdown, SegmentRiskBreakdown)
    assert breakdown.corridor_id == "C1"
    assert breakdown.segment_id == "C1-SEG-04-SONAPUR"
    assert breakdown.authority_notice == AUTHORITY_NOTICE
    assert breakdown.honesty_label == HonestyLabel.VERIFIED_STATIC

    # Factor scores dict
    factors = breakdown.factor_scores
    assert set(factors.keys()) == {"rain", "slope", "soil", "crowd", "hist"}
    assert factors["rain"] == 7.0
    assert factors["slope"] == 6.0
    assert factors["soil"] == 5.0
    assert factors["crowd"] == 4.0
    assert factors["hist"] == 3.0

    # Weighted contributions dict
    weighted = breakdown.weighted_contributions
    assert set(weighted.keys()) == {"rain", "slope", "soil", "crowd", "hist"}
    assert weighted["rain"] == 2.80
    assert weighted["slope"] == 1.80
    assert weighted["soil"] == 0.75
    assert weighted["crowd"] == 0.40
    assert weighted["hist"] == 0.15

    # Percentage shares dict for UI stacked bar
    shares = breakdown.percentage_shares
    assert set(shares.keys()) == {"rain", "slope", "soil", "crowd", "hist"}
    total_share = round(sum(shares.values()), 1)
    assert total_share == 100.0, f"Percentage shares must sum to 100.0%, got {total_share}%"

    # Effective edge cost
    assert breakdown.effective_edge_cost > 35.0
    assert breakdown.is_blocked is False
    assert breakdown.classification in [RiskClassification.AMBER, RiskClassification.RED]

    # Clean model dump serialization
    dumped = breakdown.model_dump()
    assert dumped["authority_notice"] == "SIMULATION — not connected to official NDMA systems"
    assert dumped["honesty_label"] == "VERIFIED STATIC"
    assert isinstance(dumped["percentage_shares"], dict)
