"""Risk Service (riskService) for MargSetu.

PRD Reference: PRD v2.0 §3 (Deterministic Multi-hazard Risk Calculation)
Authority Integrity: NDMA is the ONLY authority named.
Disclaimer: SIMULATION — not connected to official NDMA systems.
Rule: LLM must NEVER compute risk scores. All logic is 100% deterministic arithmetic.
"""

import math
from typing import Any, Dict, List, Optional, Tuple

from models.schemas import (
    AUTHORITY_NAME,
    AUTHORITY_NOTICE,
    HonestyLabel,
    RiskClassification,
    SegmentRiskBreakdown,
    VehicleType,
)


class RiskService:
    """Deterministic Multi-Hazard Risk Scoring & Veto Engine.
    
    Implements PRD §3 formula:
    Ri = min(10.0, max(0.0, w_rain*R_rain + w_slope*R_slope + w_soil*R_soil + w_crowd*R_crowd + w_hist*R_hist + Delta_veh))
    """

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.seasonal_weights = config.get("seasonal_weights", {})
        self.vehicle_modifiers = config.get("vehicle_modifiers", {})
        self.hard_veto_thresholds = config.get("hard_veto_thresholds", {})
        self.risk_thresholds = config.get("risk_thresholds", {"green_max": 4.0, "amber_max": 6.0, "red_min": 6.0})
        self.edge_params = config.get("edge_cost_parameters", {"divisor": 2.5})
        self.authority_notice = AUTHORITY_NOTICE

    def evaluate_veto_conditions(
        self,
        rainfall_mm: float,
        slope_deg: float,
        verified_incidents_count: int,
        ndma_override_active: bool = False,
    ) -> Tuple[bool, Optional[str]]:
        """Evaluate hard veto criteria according to PRD §3.
        
        Hard veto triggered if:
        1. Compound hazard: rainfall_mm > 75.0 AND slope_deg > 30.0
        2. Crowd confirmation: verified_crowd_incidents >= 3
        3. Administrative override: ndma_override_active is True
        """
        rainfall_thresh = self.hard_veto_thresholds.get("rainfall_mm_threshold", 75.0)
        slope_thresh = self.hard_veto_thresholds.get("slope_deg_threshold", 30.0)
        crowd_thresh = self.hard_veto_thresholds.get("verified_crowd_incidents_threshold", 3)

        if ndma_override_active:
            return True, f"{AUTHORITY_NAME} Administrative Safety Override Active — corridor impassable"

        if rainfall_mm > rainfall_thresh and slope_deg > slope_thresh:
            return (
                True,
                f"Compound Hazard Veto: Extreme Rainfall ({rainfall_mm:.1f}mm > {rainfall_thresh}mm) "
                f"combined with steep slope ({slope_deg:.1f}° > {slope_thresh}°)",
            )

        if verified_incidents_count >= crowd_thresh:
            return (
                True,
                f"Corroborated Blockage Veto: {verified_incidents_count} verified crowd incidents "
                f"(threshold >= {crowd_thresh})",
            )

        return False, None

    def get_season_weights(self, season: str) -> Tuple[float, float, float, float, float]:
        """Retrieve (w_rain, w_slope, w_soil, w_crowd, w_hist) for given season."""
        season_lower = season.lower()
        season_cfg = self.seasonal_weights.get(season_lower, self.seasonal_weights.get("monsoon", {}))

        if "weights" in season_cfg and len(season_cfg["weights"]) >= 5:
            w = season_cfg["weights"]
            return float(w[0]), float(w[1]), float(w[2]), float(w[3]), float(w[4])

        w_rain = float(season_cfg.get("rain", season_cfg.get("rainfall", 0.40)))
        w_slope = float(season_cfg.get("slope", 0.30))
        w_soil = float(season_cfg.get("soil", season_cfg.get("historical_susceptibility", 0.15)))
        w_crowd = float(season_cfg.get("crowd", season_cfg.get("incident_cluster", 0.10)))
        w_hist = float(season_cfg.get("hist", season_cfg.get("environmental_factor", 0.05)))
        return w_rain, w_slope, w_soil, w_crowd, w_hist

    def get_vehicle_modifier(self, vehicle_type: VehicleType = VehicleType.COMMERCIAL_LIGHT) -> float:
        """Retrieve Delta_veh modifier for vehicle class."""
        v_key = vehicle_type.value if hasattr(vehicle_type, "value") else str(vehicle_type)
        mod_cfg = self.vehicle_modifiers.get(v_key, {})
        return float(mod_cfg.get("risk_modifier", 0.0))

    def calculate_segment_risk(
        self,
        season: str,
        r_rain: float,
        r_slope: float,
        r_soil: float,
        r_crowd: float,
        r_hist: float,
        vehicle_type: VehicleType = VehicleType.COMMERCIAL_LIGHT,
    ) -> float:
        """Compute clamped composite segment risk score Ri [0.0 - 10.0].
        
        Formula:
        Ri = min(10.0, max(0.0, w_rain*R_rain + w_slope*R_slope + w_soil*R_soil + w_crowd*R_crowd + w_hist*R_hist + Delta_veh))
        """
        w_rain, w_slope, w_soil, w_crowd, w_hist = self.get_season_weights(season)
        delta_veh = self.get_vehicle_modifier(vehicle_type)

        raw_score = (
            w_rain * r_rain
            + w_slope * r_slope
            + w_soil * r_soil
            + w_crowd * r_crowd
            + w_hist * r_hist
            + delta_veh
        )

        clamped = max(0.0, min(10.0, raw_score))
        return round(clamped, 2)

    def classify_risk_status(
        self,
        risk_score: float,
        is_blocked: bool = False,
        vehicle_type: VehicleType = VehicleType.COMMERCIAL_LIGHT,
    ) -> RiskClassification:
        """Classify segment risk into clean status colors for UI rendering.
        
        - dark_red: Blocked by hard veto (cost = inf, impassable)
        - purple: Emergency-only transit (passable by emergency 4x4 / convoy despite obstruction)
        - green: Ri < 4.0 (Normal / low risk)
        - amber: 4.0 <= Ri <= 6.0 (Moderate risk / caution)
        - red: Ri > 6.0 (High hazard / dangerous)
        """
        if is_blocked:
            v_type = vehicle_type.value if hasattr(vehicle_type, "value") else str(vehicle_type)
            if v_type == VehicleType.EMERGENCY.value or v_type == "emergency" or v_type == "ambulance":
                return RiskClassification.PURPLE
            return RiskClassification.DARK_RED

        green_max = self.risk_thresholds.get("green_max", 4.0)
        amber_max = self.risk_thresholds.get("amber_max", 6.0)

        if risk_score < green_max:
            return RiskClassification.GREEN
        elif risk_score <= amber_max:
            return RiskClassification.AMBER
        else:
            return RiskClassification.RED

    def calculate_edge_cost(
        self,
        distance_km: float,
        risk_score_ri: float,
        is_blocked: bool = False,
    ) -> float:
        """Deterministic PRD §3 edge cost formula: distance_km * (1 + exp(Ri / 2.5)).
        
        If segment is blocked, cost is infinity.
        """
        if is_blocked:
            return float("inf")

        divisor = float(self.edge_params.get("divisor", 2.5))
        safe_ri = max(0.0, min(10.0, risk_score_ri))
        cost = distance_km * (1.0 + math.exp(safe_ri / divisor))
        return round(cost, 2)

    def generate_segment_breakdown(
        self,
        corridor_id: str,
        distance_km: float,
        season: str,
        r_rain: float,
        r_slope: float,
        r_soil: float,
        r_crowd: float,
        r_hist: float,
        rainfall_mm: float = 0.0,
        slope_deg: float = 0.0,
        verified_incidents_count: int = 0,
        ndma_override_active: bool = False,
        vehicle_type: VehicleType = VehicleType.COMMERCIAL_LIGHT,
        segment_id: Optional[str] = None,
    ) -> SegmentRiskBreakdown:
        """Generate comprehensive multi-factor breakdown and classification for UI stacked bar."""
        # 1. Compute composite risk score
        composite_score = self.calculate_segment_risk(
            season=season,
            r_rain=r_rain,
            r_slope=r_slope,
            r_soil=r_soil,
            r_crowd=r_crowd,
            r_hist=r_hist,
            vehicle_type=vehicle_type,
        )

        # 2. Check hard veto
        is_blocked, veto_reason = self.evaluate_veto_conditions(
            rainfall_mm=rainfall_mm,
            slope_deg=slope_deg,
            verified_incidents_count=verified_incidents_count,
            ndma_override_active=ndma_override_active,
        )

        # 3. Classify status color
        classification = self.classify_risk_status(
            risk_score=composite_score,
            is_blocked=is_blocked,
            vehicle_type=vehicle_type,
        )

        # 4. Calculate effective edge cost
        edge_cost = self.calculate_edge_cost(
            distance_km=distance_km,
            risk_score_ri=composite_score,
            is_blocked=is_blocked,
        )

        # 5. Factor scores and weighted contributions
        w_rain, w_slope, w_soil, w_crowd, w_hist = self.get_season_weights(season)
        factor_scores = {
            "rain": round(float(r_rain), 2),
            "slope": round(float(r_slope), 2),
            "soil": round(float(r_soil), 2),
            "crowd": round(float(r_crowd), 2),
            "hist": round(float(r_hist), 2),
        }

        weighted_contributions = {
            "rain": round(w_rain * r_rain, 3),
            "slope": round(w_slope * r_slope, 3),
            "soil": round(w_soil * r_soil, 3),
            "crowd": round(w_crowd * r_crowd, 3),
            "hist": round(w_hist * r_hist, 3),
        }

        total_weight_sum = sum(weighted_contributions.values())
        if total_weight_sum > 0:
            raw_shares = {
                k: round((v / total_weight_sum) * 100.0, 1)
                for k, v in weighted_contributions.items()
            }
            # Adjust rounding difference on largest item so shares sum to 100.0
            diff = round(100.0 - sum(raw_shares.values()), 1)
            largest_key = max(raw_shares, key=raw_shares.get)
            raw_shares[largest_key] = round(raw_shares[largest_key] + diff, 1)
            percentage_shares = raw_shares
        else:
            percentage_shares = {
                "rain": 20.0,
                "slope": 20.0,
                "soil": 20.0,
                "crowd": 20.0,
                "hist": 20.0,
            }

        return SegmentRiskBreakdown(
            corridor_id=corridor_id,
            segment_id=segment_id,
            composite_risk_score=composite_score,
            classification=classification,
            is_blocked=is_blocked,
            veto_reason=veto_reason,
            effective_edge_cost=edge_cost,
            factor_scores=factor_scores,
            weighted_contributions=weighted_contributions,
            percentage_shares=percentage_shares,
            season=season,
            vehicle_type=vehicle_type,
            honesty_label=HonestyLabel.VERIFIED_STATIC,
            authority_notice=self.authority_notice,
        )
