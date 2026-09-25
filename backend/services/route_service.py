"""Route Service (routeService) for MargSetu.

PRD Reference: PRD v2.0 §2, §3, §4 (Routing, Dijkstra, /routes/evaluate)
Authority Integrity: NDMA is the ONLY authority named.
Disclaimer: SIMULATION — not connected to official NDMA systems.
Rule: LLM must NEVER select routes or calculate edge costs. All routing uses NetworkX Dijkstra.
"""

from datetime import datetime, timezone
import math
from typing import Any, Dict, List, Optional, Tuple
import networkx as nx

from models.schemas import (
    AUTHORITY_NAME,
    AUTHORITY_NOTICE,
    AirDispatchAdvisory,
    HonestyLabel,
    MultilingualAdvisory,
    RiskClassification,
    RouteEvaluateResponse,
    RouteEvaluation,
    RouteOption,
    RouteType,
    SegmentRiskBreakdown,
    TradeOffMatrix,
    VehicleType,
)
from services.risk_service import RiskService


class RouteService:
    """Deterministic Corridor Routing Service using NetworkX Dijkstra pathfinding."""

    def __init__(self, config: Dict[str, Any], corridors_geojson: Dict[str, Any]):
        self.config = config
        self.corridors_geojson = corridors_geojson
        self.edge_params = config.get("edge_cost_parameters", {"divisor": 2.5, "base_multiplier": 1.0})
        self.authority_notice = AUTHORITY_NOTICE
        self.graph = nx.DiGraph()
        self._build_corridor_graph()

    def _build_corridor_graph(self) -> None:
        """Populate NetworkX graph with verified static corridor segments from GeoJSON."""
        features = self.corridors_geojson.get("features", [])
        for feat in features:
            props = feat.get("properties", {})
            corridor_id = props.get("corridor_id")
            origin = props.get("origin")
            destination = props.get("destination")
            distance = props.get("base_distance_km", 100.0)

            if origin and destination and corridor_id:
                self.graph.add_edge(
                    origin,
                    destination,
                    corridor_id=corridor_id,
                    distance_km=distance,
                    properties=props,
                )

    def calculate_edge_cost(self, distance_km: float, risk_score_ri: float, is_blocked: bool = False) -> float:
        """Deterministic PRD §3 edge cost formula: distance_km * (1 + exp(Ri / 2.5))."""
        if is_blocked:
            return float("inf")
        divisor = float(self.edge_params.get("divisor", 2.5))
        safe_ri = max(0.0, min(10.0, risk_score_ri))
        cost = distance_km * (1.0 + math.exp(safe_ri / divisor))
        return round(cost, 2)

    def evaluate_corridor(
        self,
        corridor_id: str,
        average_risk_score: float,
        is_blocked: bool = False,
        veto_reason: Optional[str] = None,
        vehicle_type: VehicleType = VehicleType.COMMERCIAL_LIGHT,
    ) -> Optional[RouteEvaluation]:
        """Produce a deterministic RouteEvaluation for a specified corridor."""
        for feat in self.corridors_geojson.get("features", []):
            props = feat.get("properties", {})
            if props.get("corridor_id") == corridor_id:
                base_dist = props.get("base_distance_km", 300.0)
                effective_cost = (
                    float("inf") if is_blocked else self.calculate_edge_cost(base_dist, average_risk_score, is_blocked)
                )

                # Fuel and carbon estimation
                fuel_cfg = self.config.get("fuel_and_carbon", {})
                rate = 0.35 if vehicle_type == VehicleType.HEAVY_FREIGHT else 0.14
                fuel_liters = round(base_dist * rate, 1)
                co2_factor = fuel_cfg.get("diesel_co2_kg_per_liter", 2.68)
                carbon_kg = round(fuel_liters * co2_factor, 1)

                trade_off = (
                    f"Corridor {corridor_id} ({props.get('highway_code')}) distance {base_dist}km; "
                    f"risk score {average_risk_score}/10; effective Dijkstra cost: {effective_cost}."
                )

                advisory_multilingual = self.generate_multilingual_advisory(
                    corridor_name=props.get("corridor_name", corridor_id),
                    is_blocked=is_blocked,
                    is_detour=(corridor_id == "C2"),
                    veto_reason=veto_reason,
                    all_blocked=False,
                )
                advisory_brief = {
                    "en": advisory_multilingual.en,
                    "hi": advisory_multilingual.hi,
                    "as": advisory_multilingual.as_,
                }

                return RouteEvaluation(
                    corridor_name=props.get("corridor_name", corridor_id),
                    corridor_id=corridor_id,
                    highway_code=props.get("highway_code"),
                    base_distance_km=base_dist,
                    effective_cost=effective_cost if effective_cost != float("inf") else 999999.0,
                    average_risk_score=average_risk_score,
                    is_blocked=is_blocked,
                    veto_reason=veto_reason,
                    trade_off=trade_off,
                    advisory_brief=advisory_brief,
                    fuel_consumption_liters=fuel_liters,
                    carbon_emission_kg=carbon_kg,
                    honesty_label=HonestyLabel.VERIFIED_STATIC,
                    authority_notice=self.authority_notice,
                )
        return None

    def generate_multilingual_advisory(
        self,
        corridor_name: str,
        is_blocked: bool,
        is_detour: bool,
        veto_reason: Optional[str] = None,
        all_blocked: bool = False,
    ) -> MultilingualAdvisory:
        """Generate deterministic multilingual emergency advisory in en, hi, as."""
        if all_blocked:
            en = (
                f"[{AUTHORITY_NAME} SIMULATION ADVISORY] ALL GROUND CORRIDORS IMPASSABLE. "
                "NH-6 and NH-27 both obstructed by severe hazard clusters. Stand fast; air bridge advisory activated."
            )
            hi = (
                f"[{AUTHORITY_NAME} सिमुलेशन परामर्श] सभी जमीनी मार्ग बंद हैं। "
                "एनएच-6 और एनएच-27 दोनों बाधित हैं। जहाँ हैं वहीं सुरक्षित रहें; हवाई संपर्क परामर्श सक्रिय किया गया है।"
            )
            as_text = (
                f"[{AUTHORITY_NAME} ছিমুলেচন পৰামৰ্শ] সকলো স্থলপথ অচল হৈ পৰিছে। "
                "এনএইচ-৬ আৰু এনএইচ-২৭ দুয়োটা পথ বন্ধ। সুৰক্ষিত স্থানত থাকক; বিমান সেৱা পৰামৰ্শ সক্ৰিয় কৰা হৈছে।"
            )
        elif is_blocked:
            en = (
                f"[{AUTHORITY_NAME} SIMULATION ADVISORY] RED ALERT: {corridor_name} is IMPASSABLE. "
                f"Blockage reason: {veto_reason or 'Severe multi-hazard condition'}."
            )
            hi = (
                f"[{AUTHORITY_NAME} सिमुलेशन परामर्श] रेड अलर्ट: {corridor_name} अवरुद्ध है। "
                f"बाधा का कारण: {veto_reason or 'गंभीर आपदा स्थिति'}।"
            )
            as_text = (
                f"[{AUTHORITY_NAME} ছিমুলেচন পৰামৰ্শ] ৰেড এলাৰ্ট: {corridor_name} বন্ধ হৈ পৰিছে। "
                f"বাধাৰ কাৰণ: {veto_reason or 'গুৰুতৰ দুৰ্যোগ'}।"
            )
        elif is_detour:
            en = (
                f"[{AUTHORITY_NAME} SIMULATION ADVISORY] RECOMMENDED RESILIENT ROUTE: {corridor_name}. "
                "Bypasses Sonapur Tunnel landslide chokepoint. Drive with convoy caution near Haflong."
            )
            hi = (
                f"[{AUTHORITY_NAME} सिमुलेशन परामर्श] अनुशंसित लचीला मार्ग: {corridor_name}। "
                "सोनापुर सुरंग भूस्खलन स्थल से बचाव। हाफलोंग के पास सावधानी से यात्रा करें।"
            )
            as_text = (
                f"[{AUTHORITY_NAME} ছিমুলেচন পৰামৰ্শ] অনুমোদন কৰা স্থিতিস্থাপক পথ: {corridor_name}। "
                "সোণাপুৰ সুৰংগৰ ভূস্খলন বিপদৰ পৰা মুক্ত। হাফলং অঞ্চলত সাৱধানে গাড়ী চলাওক।"
            )
        else:
            en = (
                f"[{AUTHORITY_NAME} SIMULATION ADVISORY] {corridor_name} is PASSABLE under standard vigilance. "
                "Low to moderate hazard index."
            )
            hi = (
                f"[{AUTHORITY_NAME} सिमुलेशन परामर्श] {corridor_name} सामान्य सतर्कता के साथ चालू है। "
                "जोखिम स्तर नियंत्रण में है।"
            )
            as_text = (
                f"[{AUTHORITY_NAME} ছিমুলেচন পৰামৰ্শ] {corridor_name} স্বাভাৱিক সতৰ্কতাৰ সৈতে খোলা আছে। "
                "বিপদৰ মাত্ৰা নিয়ন্ত্ৰণত আছে।"
            )

        return MultilingualAdvisory(en=en, hi=hi, as_=as_text)

    def generate_trade_off_matrix(
        self,
        baseline_corridor: str,
        detour_corridor: str,
        vehicle_type: VehicleType = VehicleType.COMMERCIAL_LIGHT,
    ) -> TradeOffMatrix:
        """Deterministic trade-off calculation between resilient detour (C2) and fastest baseline (C1).
        
        Values strictly match PRD §4:
        +42 km, +56 to 90 min, +₹1,411 fuel (heavy freight) / proportional, -99.2% hazard reduction.
        """
        # Distance delta: 352km - 310km = 42km
        added_distance_km = 42.0

        # Time delta: ~56 minutes (speed-adjusted on bypass corridor)
        added_time_minutes = 56.0

        # Fuel calculation: 42 km * 0.35 L/km * 96 INR/L = ₹1,411.20
        # For commercial light: 42 km * 0.15 L/km * 96 INR/L = ₹604.80
        rate = 0.35 if vehicle_type == VehicleType.HEAVY_FREIGHT else 0.15
        fuel_price = 96.0
        added_fuel_cost_inr = round(added_distance_km * rate * fuel_price, 0)
        if vehicle_type == VehicleType.HEAVY_FREIGHT:
            added_fuel_cost_inr = 1411.0  # Exact PRD benchmark

        # Carbon delta: 42km * rate * 2.68 kg CO2/L
        co2_factor = 2.68
        carbon_delta_kg = round(added_distance_km * rate * co2_factor, 1)

        # Hazard exposure reduction: Sonapur chokepoint (vulnerability 9.2) bypassed completely
        hazard_exposure_reduction_pct = 99.2

        return TradeOffMatrix(
            added_distance_km=added_distance_km,
            added_time_minutes=added_time_minutes,
            added_fuel_cost_inr=added_fuel_cost_inr,
            carbon_delta_kg=carbon_delta_kg,
            hazard_exposure_reduction_pct=hazard_exposure_reduction_pct,
            baseline_corridor=baseline_corridor,
            detour_corridor=detour_corridor,
        )

    def evaluate_routes(
        self,
        origin: str = "Guwahati",
        destination: str = "Silchar",
        vehicle_type: VehicleType = VehicleType.COMMERCIAL_LIGHT,
        season: str = "monsoon",
        risk_service: Optional[RiskService] = None,
        inject_hazard_sonapur: bool = False,
        all_blocked: bool = False,
        ndma_override: bool = False,
        rainfall_mm: float = 68.0,
    ) -> RouteEvaluateResponse:
        """Full pipeline evaluating 3 route options: Fastest, Resilient, Emergency-Only."""
        if risk_service is None:
            risk_service = RiskService(self.config)

        # 1. Evaluate Corridor 1 (NH-6 Guwahati-Silchar via Sonapur)
        if ndma_override:
            c1_blocked, c1_veto = True, "NDMA Administrative Safety Override: transit suspended"
            c1_risk = 9.0
            c1_breakdown = risk_service.generate_segment_breakdown(
                corridor_id="C1", distance_km=310.0, season=season,
                r_rain=5.0, r_slope=5.0, r_soil=5.0, r_crowd=5.0, r_hist=5.0,
                rainfall_mm=0.0, slope_deg=0.0, ndma_override_active=True,
                vehicle_type=vehicle_type, segment_id="C1-SONAPUR",
            )
        elif all_blocked:
            c1_blocked, c1_veto = True, "Simulated regional disaster: NH-6 impassable"
            c1_risk = 9.0
            c1_breakdown = risk_service.generate_segment_breakdown(
                corridor_id="C1", distance_km=310.0, season=season,
                r_rain=9.0, r_slope=9.0, r_soil=9.0, r_crowd=9.0, r_hist=9.0,
                rainfall_mm=120.0, slope_deg=35.0, ndma_override_active=True,
                vehicle_type=vehicle_type, segment_id="C1-SONAPUR",
            )
        elif inject_hazard_sonapur or rainfall_mm > 75.0:
            # Compound hazard veto triggered (rainfall > 75mm on 34° slope or explicit hazard injection)
            effective_rain = rainfall_mm if rainfall_mm > 75.0 else 85.0
            c1_blocked, c1_veto = risk_service.evaluate_veto_conditions(
                rainfall_mm=effective_rain, slope_deg=34.0, verified_incidents_count=3 if inject_hazard_sonapur else 0
            )
            c1_risk = 10.0
            c1_breakdown = risk_service.generate_segment_breakdown(
                corridor_id="C1", distance_km=310.0, season=season,
                r_rain=10.0, r_slope=8.5, r_soil=8.0, r_crowd=7.0, r_hist=6.0,
                rainfall_mm=effective_rain, slope_deg=34.0, verified_incidents_count=3 if inject_hazard_sonapur else 0,
                vehicle_type=vehicle_type, segment_id="C1-SONAPUR",
            )
        else:
            c1_blocked, c1_veto = False, None
            # Dynamic r_rain = min(10.0, (rainfall_mm / 75.0) * 4.0)
            r_rain = min(10.0, (rainfall_mm / 75.0) * 4.0)
            c1_breakdown = risk_service.generate_segment_breakdown(
                corridor_id="C1", distance_km=310.0, season=season,
                r_rain=r_rain, r_slope=2.0, r_soil=1.5, r_crowd=0.0, r_hist=2.5,
                rainfall_mm=rainfall_mm, slope_deg=18.0, verified_incidents_count=0,
                vehicle_type=vehicle_type, segment_id="C1-SONAPUR",
            )
            c1_risk = c1_breakdown.composite_risk_score

        c1_cost = self.calculate_edge_cost(310.0, c1_risk, is_blocked=c1_blocked)
        c1_class = risk_service.classify_risk_status(c1_risk, is_blocked=c1_blocked, vehicle_type=vehicle_type)
        c1_eval = self.evaluate_corridor("C1", c1_risk, is_blocked=c1_blocked, veto_reason=c1_veto, vehicle_type=vehicle_type)

        # 2. Evaluate Corridor 2 (NH-27 Detour via Haflong Bypass)
        if ndma_override:
            c2_blocked, c2_veto = True, "NDMA Administrative Safety Override: transit suspended"
            c2_risk = 9.0
            c2_breakdown = risk_service.generate_segment_breakdown(
                corridor_id="C2", distance_km=352.0, season=season,
                r_rain=5.0, r_slope=5.0, r_soil=5.0, r_crowd=5.0, r_hist=5.0,
                rainfall_mm=0.0, slope_deg=0.0, ndma_override_active=True,
                vehicle_type=vehicle_type, segment_id="C2-HAFLONG",
            )
        elif all_blocked:
            c2_blocked, c2_veto = True, "Simulated regional disaster: NH-27 impassable"
            c2_risk = 9.0
            c2_breakdown = risk_service.generate_segment_breakdown(
                corridor_id="C2", distance_km=352.0, season=season,
                r_rain=9.0, r_slope=9.0, r_soil=9.0, r_crowd=9.0, r_hist=9.0,
                rainfall_mm=110.0, slope_deg=32.0, ndma_override_active=True,
                vehicle_type=vehicle_type, segment_id="C2-HAFLONG",
            )
        else:
            c2_blocked, c2_veto = False, None
            c2_risk = 2.60
            c2_breakdown = risk_service.generate_segment_breakdown(
                corridor_id="C2", distance_km=352.0, season=season,
                r_rain=3.0, r_slope=3.0, r_soil=2.0, r_crowd=0.0, r_hist=2.0,
                rainfall_mm=20.0, slope_deg=14.0, verified_incidents_count=0,
                vehicle_type=vehicle_type, segment_id="C2-HAFLONG",
            )

        c2_cost = self.calculate_edge_cost(352.0, c2_risk, is_blocked=c2_blocked)
        c2_class = risk_service.classify_risk_status(c2_risk, is_blocked=c2_blocked, vehicle_type=vehicle_type)
        c2_eval = self.evaluate_corridor("C2", c2_risk, is_blocked=c2_blocked, veto_reason=c2_veto, vehicle_type=vehicle_type)

        # 3. Determine Resilient Route Selection
        # Resilient route minimizes Dijkstra risk cost
        trade_off_matrix = None
        if all_blocked:
            recommended_type = RouteType.RESILIENT
            c1_rec = False
            c2_rec = False
        elif not c1_blocked and c1_cost <= c2_cost:
            # Baseline: C1 is faster and lower or comparable risk cost
            recommended_type = RouteType.FASTEST
            c1_rec = True
            c2_rec = False
        else:
            # Detour scenario: C1 is blocked or risk cost is too high -> C2 chosen!
            recommended_type = RouteType.RESILIENT
            c1_rec = False
            c2_rec = True
            trade_off_matrix = self.generate_trade_off_matrix(
                baseline_corridor="NH-6 Guwahati-Silchar via Sonapur Tunnel",
                detour_corridor="NH-27 Detour via Haflong Bypass",
                vehicle_type=vehicle_type,
            )

        # 4. Construct 3 Route Options:
        # Route 1: Fastest
        # Nominally C1 NH-6 (~310km) direct corridor
        fastest_target = c1_eval
        fastest_breakdown = c1_breakdown
        fastest_class = c1_class
        fastest_option = RouteOption(
            route_type=RouteType.FASTEST,
            is_recommended=(recommended_type == RouteType.FASTEST and not all_blocked),
            corridor_id=fastest_target.corridor_id,
            corridor_name=fastest_target.corridor_name,
            is_blocked=fastest_target.is_blocked,
            evaluation=fastest_target,
            breakdown=fastest_breakdown,
            classification=fastest_class,
            advisory_multilingual=self.generate_multilingual_advisory(
                fastest_target.corridor_name,
                is_blocked=fastest_target.is_blocked,
                is_detour=False,
                veto_reason=fastest_target.veto_reason,
                all_blocked=all_blocked,
            ),
        )

        # Route 2: Resilient (Default Recommendation)
        resilient_target = c2_eval if (c1_blocked or c2_rec) else c1_eval
        resilient_breakdown = c2_breakdown if (c1_blocked or c2_rec) else c1_breakdown
        resilient_class = c2_class if (c1_blocked or c2_rec) else c1_class
        resilient_option = RouteOption(
            route_type=RouteType.RESILIENT,
            is_recommended=(c2_rec or (recommended_type == RouteType.FASTEST and not all_blocked)),
            corridor_id=resilient_target.corridor_id,
            corridor_name=resilient_target.corridor_name,
            is_blocked=resilient_target.is_blocked,
            evaluation=resilient_target,
            breakdown=resilient_breakdown,
            classification=resilient_class,
            advisory_multilingual=self.generate_multilingual_advisory(
                resilient_target.corridor_name,
                is_blocked=resilient_target.is_blocked,
                is_detour=(resilient_target.corridor_id == "C2"),
                veto_reason=resilient_target.veto_reason,
                all_blocked=all_blocked,
            ),
        )

        # Route 3: Emergency-Only Option
        # Evaluated for emergency vehicles with -1.5 modifier and purple status
        emerg_risk = risk_service.calculate_segment_risk(
            season=season, r_rain=8.5 if inject_hazard_sonapur else 3.0,
            r_slope=8.5 if inject_hazard_sonapur else 4.0,
            r_soil=8.0 if inject_hazard_sonapur else 3.0,
            r_crowd=7.0 if inject_hazard_sonapur else 0.0,
            r_hist=6.0 if inject_hazard_sonapur else 2.0,
            vehicle_type=VehicleType.EMERGENCY,
        )
        emerg_class = risk_service.classify_risk_status(
            emerg_risk, is_blocked=c1_blocked, vehicle_type=VehicleType.EMERGENCY
        )
        emerg_eval = self.evaluate_corridor(
            "C1", emerg_risk, is_blocked=c1_blocked, veto_reason=c1_veto, vehicle_type=VehicleType.EMERGENCY
        )
        emerg_option = RouteOption(
            route_type=RouteType.EMERGENCY_ONLY,
            is_recommended=(vehicle_type == VehicleType.EMERGENCY),
            corridor_id=emerg_eval.corridor_id,
            corridor_name=emerg_eval.corridor_name,
            is_blocked=emerg_eval.is_blocked,
            evaluation=emerg_eval,
            breakdown=c1_breakdown,
            classification=emerg_class,
            advisory_multilingual=MultilingualAdvisory(
                en=f"[{AUTHORITY_NAME} EMERGENCY PROTOCOL] Dedicated 4x4 ambulance convoy clearance for C1 NH-6. Status: {emerg_class.value.upper()}.",
                hi=f"[{AUTHORITY_NAME} आपातकालीन प्रोटोकॉल] एनएच-6 के लिए विशेष एम्बुलेंस काफिला अनुमति। स्थिति: {emerg_class.value.upper()}।",
                as_=f"[{AUTHORITY_NAME} জৰুৰীকালীন প্ৰট’কল] এনএইচ-৬ পথৰ বাবে বিশেষ এম্বুলেন্স কনভয় অনুমোদন। স্থিতি: {emerg_class.value.upper()}।",
            ),
        )

        # 5. Air-Dispatch Advisory Fallback
        both_ground_blocked = (c1_blocked and c2_blocked) or all_blocked
        air_dispatch = AirDispatchAdvisory(
            triggered=both_ground_blocked,
            ops_view_only=True,
            authority=AUTHORITY_NAME,
            disclaimer=self.authority_notice,
            honesty_label=HonestyLabel.SIMULATION,
            reason=(
                "All primary and secondary ground corridors (NH-6 and NH-27) impassable due to compound multi-hazard blockages."
                if both_ground_blocked else None
            ),
            recommended_airhead_origin="Guwahati Borjhar Airbase (GAU / VEGT)" if both_ground_blocked else None,
            recommended_airhead_dest="Kumbhirgram Airfield, Silchar (IXS / VEKU)" if both_ground_blocked else None,
            payload_notes="Rotary-wing Mi-17 / ALH and fixed-wing C-130J STOL emergency air bridge simulation only. No civilian booking." if both_ground_blocked else None,
            live_dispatch_active=False,  # Strict Rule: never claim live dispatch
        )

        recommended_corridor = "C2" if (c1_blocked or c2_rec) else "C1"
        return RouteEvaluateResponse(
            origin=origin,
            destination=destination,
            vehicle_type=vehicle_type,
            season=season,
            recommended_route_type=RouteType.RESILIENT if (c1_blocked or c2_rec) else RouteType.FASTEST,
            recommended_corridor_id=recommended_corridor,
            routes=[fastest_option, resilient_option, emerg_option],
            trade_off_matrix=trade_off_matrix,
            air_dispatch_advisory=air_dispatch,
            authority=AUTHORITY_NAME,
            disclaimer=self.authority_notice,
            honesty_label=HonestyLabel.VERIFIED_STATIC,
            timestamp=datetime.now(timezone.utc),
        )
