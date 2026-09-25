"""MargSetu Pydantic v2 Core Domain Schemas.

PRD Reference: PRD v2.0 §0, §1, §2, §3, §9
Authority Integrity: NDMA is the ONLY authority named anywhere.
Disclaimer: SIMULATION — not connected to official NDMA systems.
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional, Union
from uuid import uuid4
from pydantic import BaseModel, ConfigDict, Field, model_validator


AUTHORITY_NAME: str = "NDMA"
AUTHORITY_NOTICE: str = "SIMULATION — not connected to official NDMA systems"
SOS_EMERGENCY_NOTICE: str = "MargSetu is not a replacement for official emergency services."


class HonestyLabel(str, Enum):
    """Honesty labeling for all data sources in MargSetu."""
    LIVE_API = "LIVE API"
    VERIFIED_STATIC = "VERIFIED STATIC"
    SIMULATION = "SIMULATION"
    USER_SUBMITTED = "USER-SUBMITTED"


class RiskClassification(str, Enum):
    """Corridor segment risk status classification for UI display.
    
    green: Ri < 4.0 (Normal / low risk)
    amber: 4.0 <= Ri <= 6.0 (Moderate risk / caution)
    red: Ri > 6.0 (High hazard / dangerous)
    dark_red: Blocked by hard veto (cost = inf, impassable)
    purple: Emergency-only transit (blocked for commercial/freight, emergency bypass)
    """
    GREEN = "green"
    AMBER = "amber"
    RED = "red"
    DARK_RED = "dark_red"
    PURPLE = "purple"


class VehicleType(str, Enum):
    """Vehicle categories supported in deterministic routing."""
    HEAVY_FREIGHT = "heavy_freight"
    COMMERCIAL_LIGHT = "commercial_light"
    EMERGENCY = "emergency"
    TWO_WHEELER = "two_wheeler"


class IncidentType(str, Enum):
    """Multi-hazard incident categories observed in Northeast corridors."""
    LANDSLIDE = "landslide"
    FLOOD = "flood"
    ROCKFALL = "rockfall"
    ROAD_COLLAPSE = "road_collapse"
    ROAD_DAMAGE = "road_damage"
    WATERLOGGING = "waterlogging"
    CLEAR = "clear"


class GeoLocation(BaseModel):
    """Geographic coordinate restricted to Northeast India lifeline region.
    
    Bounding Box: Lat 20.0°N to 30.0°N, Lon 88.0°E to 98.0°E.
    """
    model_config = ConfigDict(extra="ignore")

    latitude: float = Field(
        ...,
        ge=20.0,
        le=30.0,
        description="Latitude restricted to Northeast India bounding region (20.0°N to 30.0°N)"
    )
    longitude: float = Field(
        ...,
        ge=88.0,
        le=98.0,
        description="Longitude restricted to Northeast India bounding region (88.0°E to 98.0°E)"
    )
    accuracy_m: float = Field(
        default=5.0,
        ge=0.0,
        description="Estimated GPS accuracy in meters (default 5.0m)"
    )
    elevation_m: Optional[float] = Field(
        default=None,
        description="Terrain elevation above sea level in meters"
    )
    landmark_name: Optional[str] = Field(
        default=None,
        description="Nearest known corridor landmark or chokepoint"
    )


class IncidentReport(BaseModel):
    """Crowd-sourced or field-reported corridor disruption."""
    model_config = ConfigDict(extra="ignore")

    id: Optional[str] = Field(default=None, description="Unique report identifier")
    user_id_hash: str = Field(..., description="Anonymized SHA-256 hash of reporting device/user")
    location: GeoLocation = Field(..., description="Precise incident location")
    incident_type: IncidentType = Field(..., description="Hazard type classification")
    vehicle_type: VehicleType = Field(
        default=VehicleType.COMMERCIAL_LIGHT,
        description="Vehicle category operated by reporter"
    )
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="UTC timestamp of report generation"
    )
    severity: str = Field(
        default="MEDIUM",
        description="Severity assessment: LOW, MEDIUM, HIGH, CRITICAL"
    )
    is_blocked: bool = Field(
        default=True,
        description="Whether the corridor segment is impassable"
    )
    clearance_eta_hours: float = Field(
        default=0.0,
        ge=0.0,
        description="Estimated hours until clearance is complete"
    )
    verified_count: int = Field(
        default=1,
        ge=0,
        description="Number of corroborating crowd reports or field validations"
    )
    honesty_label: HonestyLabel = Field(
        default=HonestyLabel.USER_SUBMITTED,
        description="Honesty label reflecting data provenance"
    )
    authority_notice: str = Field(
        default=AUTHORITY_NOTICE,
        description="Mandatory NDMA simulation disclosure"
    )


class RouteEvaluation(BaseModel):
    """Deterministic routing evaluation for a corridor option."""
    model_config = ConfigDict(extra="ignore")

    corridor_name: str = Field(..., description="Human-readable corridor name")
    corridor_id: Optional[str] = Field(default=None, description="Unique corridor identifier (e.g. C1, C2, C3)")
    highway_code: Optional[str] = Field(default=None, description="Official highway designation (e.g. NH-6, NH-27)")
    base_distance_km: float = Field(..., ge=0.0, description="Nominal physical distance in km")
    effective_cost: float = Field(..., ge=0.0, description="Dijkstra risk-weighted routing cost")
    average_risk_score: float = Field(
        ...,
        ge=0.0,
        le=100.0,
        description="Composite multi-hazard risk index (0.0 to 100.0)"
    )
    is_blocked: bool = Field(
        default=False,
        description="True if segment or corridor is subject to hard veto"
    )
    veto_reason: Optional[str] = Field(
        default=None,
        description="Explicit rule trigger if vetoed (e.g. rainfall > 75mm & slope > 30deg)"
    )
    trade_off: str = Field(
        ...,
        description="Deterministic operational comparison between distance, time, and safety"
    )
    advisory_brief: Union[Dict[str, str], str] = Field(
        ...,
        description="Deterministic baseline driver advisory text or multilingual dict {en, hi, as}"
    )
    fuel_consumption_liters: Optional[float] = Field(
        default=None,
        ge=0.0,
        description="Calculated diesel/petrol consumption including elevation penalty"
    )
    carbon_emission_kg: Optional[float] = Field(
        default=None,
        ge=0.0,
        description="Estimated CO2 footprint in kilograms"
    )
    honesty_label: HonestyLabel = Field(
        default=HonestyLabel.VERIFIED_STATIC,
        description="Provenance label for geometry and base parameters"
    )
    authority_notice: str = Field(
        default=AUTHORITY_NOTICE,
        description="Mandatory NDMA simulation disclosure"
    )


class WeatherData(BaseModel):
    """Atmospheric conditions along corridor segment."""
    model_config = ConfigDict(extra="ignore")

    station_name: str
    location: GeoLocation
    rainfall_24h_mm: float = Field(default=0.0, ge=0.0)
    current_precipitation_rate_mmh: float = Field(default=0.0, ge=0.0)
    wind_speed_kmh: float = Field(default=0.0, ge=0.0)
    visibility_km: float = Field(default=10.0, ge=0.0)
    honesty_label: HonestyLabel = Field(default=HonestyLabel.LIVE_API)
    authority_notice: str = Field(default=AUTHORITY_NOTICE)


class SOSAlert(BaseModel):
    """Emergency SOS distress signal."""
    model_config = ConfigDict(extra="ignore")

    id: str
    sender_id_hash: str
    location: GeoLocation
    distress_type: str = Field(default="STRANDED_HAZARD")
    urgency_level: str = Field(default="CRITICAL")
    message: Optional[str] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_dispatched: bool = Field(
        default=False,
        description="Must remain False; live dispatch is strictly not implied"
    )
    honesty_label: HonestyLabel = Field(default=HonestyLabel.SIMULATION)
    authority_notice: str = Field(default=AUTHORITY_NOTICE)


class HealthResponse(BaseModel):
    """System health response model with NDMA simulation assurance."""
    model_config = ConfigDict(extra="ignore")

    status: str = Field(default="healthy", description="Operational status")
    service: str = Field(default="MargSetu Core Engine", description="Service identity")
    version: str = Field(default="2.0.0", description="Semantic system release")
    authority: str = Field(default=AUTHORITY_NAME, description="Single authorized authority: NDMA")
    disclaimer: str = Field(default=AUTHORITY_NOTICE, description="Mandatory simulation disclaimer")
    honesty_label: HonestyLabel = Field(
        default=HonestyLabel.VERIFIED_STATIC,
        description="Static verification of configuration & geometry"
    )
    corridors_loaded: int = Field(..., ge=0, description="Total validated lifeline corridors")
    config_loaded: bool = Field(default=True, description="Deterministic configuration loaded")
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Health check execution timestamp"
    )


class SegmentRiskBreakdown(BaseModel):
    """Detailed multi-hazard risk breakdown for UI visualization (e.g. stacked bar chart)."""
    model_config = ConfigDict(extra="ignore")

    corridor_id: str = Field(..., description="Corridor identifier (e.g. C1, C2, C3)")
    segment_id: Optional[str] = Field(default=None, description="Segment identifier")
    composite_risk_score: float = Field(..., ge=0.0, le=10.0, description="Composite risk Ri [0-10]")
    classification: RiskClassification = Field(..., description="Status color classification (green, amber, red, dark_red, purple)")
    is_blocked: bool = Field(default=False, description="Whether segment is blocked by hard veto")
    veto_reason: Optional[str] = Field(default=None, description="Explicit reason if hard veto triggered")
    effective_edge_cost: float = Field(..., description="Dijkstra effective cost (inf if blocked)")
    factor_scores: Dict[str, float] = Field(..., description="Normalized factor scores: rain, slope, soil, crowd, hist")
    weighted_contributions: Dict[str, float] = Field(..., description="Weighted factor contributions: w_i * R_i")
    percentage_shares: Dict[str, float] = Field(..., description="Percentage contribution to total risk for UI bar")
    season: str = Field(default="monsoon", description="Active season matrix applied")
    vehicle_type: VehicleType = Field(default=VehicleType.COMMERCIAL_LIGHT, description="Vehicle modifier applied")
    honesty_label: HonestyLabel = Field(default=HonestyLabel.VERIFIED_STATIC)
    authority_notice: str = Field(default=AUTHORITY_NOTICE)


class RouteType(str, Enum):
    """Routing optimization strategy categories."""
    FASTEST = "fastest"
    RESILIENT = "resilient"
    EMERGENCY_ONLY = "emergency_only"


class TradeOffMatrix(BaseModel):
    """Deterministic comparison between recommended resilient detour and fastest baseline."""
    model_config = ConfigDict(extra="ignore")

    added_distance_km: float = Field(..., description="Additional travel distance in km")
    added_time_minutes: float = Field(..., description="Additional estimated transit time in minutes")
    added_fuel_cost_inr: float = Field(..., description="Estimated additional fuel expense in INR")
    carbon_delta_kg: float = Field(..., description="Additional CO2 footprint in kg")
    hazard_exposure_reduction_pct: float = Field(..., description="Hazard risk exposure reduction percentage")
    baseline_corridor: str = Field(..., description="Baseline fastest corridor compared against (e.g. C1 NH-6)")
    detour_corridor: str = Field(..., description="Resilient detour corridor recommended (e.g. C2 NH-27)")


class MultilingualAdvisory(BaseModel):
    """Deterministic baseline emergency driver advisory in English, Hindi, and Assamese."""
    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    en: str = Field(..., description="English advisory text")
    hi: str = Field(..., description="Hindi advisory text (हिन्दी)")
    as_: str = Field(..., alias="as", description="Assamese advisory text (অসমীয়া)")


class AirDispatchAdvisory(BaseModel):
    """Operational contingency advisory when all ground lifeline corridors are blocked."""
    model_config = ConfigDict(extra="ignore")

    triggered: bool = Field(default=False, description="True if all ground routes are impassable")
    ops_view_only: bool = Field(default=True, description="Strictly restricted to emergency operations center view")
    authority: str = Field(default=AUTHORITY_NAME, description="Primary authority")
    disclaimer: str = Field(default=AUTHORITY_NOTICE, description="Simulation notice")
    honesty_label: HonestyLabel = Field(default=HonestyLabel.SIMULATION)
    reason: Optional[str] = Field(default=None, description="Trigger rationale")
    recommended_airhead_origin: Optional[str] = Field(default=None, description="Origin airfield / helipad")
    recommended_airhead_dest: Optional[str] = Field(default=None, description="Destination airfield / helipad")
    payload_notes: Optional[str] = Field(default=None, description="Aircraft category and payload remarks")
    live_dispatch_active: bool = Field(default=False, description="Strictly False; no live dispatch implied")


class RouteOption(BaseModel):
    """Individual evaluated corridor route option."""
    model_config = ConfigDict(extra="ignore")

    route_type: RouteType = Field(..., description="Route strategy: fastest, resilient, emergency_only")
    is_recommended: bool = Field(default=False, description="True if selected as prime recommendation")
    corridor_id: Optional[str] = Field(default=None, description="Corridor code: C1, C2, C3")
    corridor_name: Optional[str] = Field(default=None, description="Name of the corridor")
    is_blocked: Optional[bool] = Field(default=None, description="Whether corridor is blocked/vetoed")
    evaluation: RouteEvaluation = Field(..., description="Dijkstra route evaluation")
    breakdown: Optional[SegmentRiskBreakdown] = Field(default=None, description="Detailed hazard factor breakdown")
    classification: RiskClassification = Field(..., description="Status color: green, amber, red, dark_red, purple")
    advisory_multilingual: MultilingualAdvisory = Field(..., description="Advisories in en, hi, as")


class RouteEvaluateResponse(BaseModel):
    """Envelope response for GET /routes/evaluate."""
    model_config = ConfigDict(extra="ignore")

    origin: str = Field(..., description="Origin hub (e.g. Guwahati)")
    destination: str = Field(..., description="Destination hub (e.g. Silchar)")
    vehicle_type: VehicleType = Field(..., description="Vehicle category evaluated")
    season: str = Field(default="monsoon", description="Active season matrix")
    recommended_route_type: RouteType = Field(..., description="Strategy of the top recommendation")
    recommended_corridor_id: Optional[str] = Field(default=None, description="Recommended corridor ID (C1 or C2)")
    routes: List[RouteOption] = Field(..., description="Evaluated route options")
    trade_off_matrix: Optional[TradeOffMatrix] = Field(default=None, description="Detour trade-off differentials")
    air_dispatch_advisory: AirDispatchAdvisory = Field(..., description="Air bridge contingency advisory")
    authority: str = Field(default=AUTHORITY_NAME, description="Sole authority: NDMA")
    disclaimer: str = Field(default=AUTHORITY_NOTICE, description="Mandatory NDMA simulation disclosure")
    honesty_label: HonestyLabel = Field(default=HonestyLabel.VERIFIED_STATIC)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class IncidentStatus(str, Enum):
    """Lifecycle progression states for crowdsourced hazards."""
    PENDING = "pending"
    CORROBORATED = "corroborated"
    VERIFIED = "verified"
    RESOLVED = "resolved"
    FALSE_POSITIVE = "false_positive"


class OperatorActionType(str, Enum):
    """Operator operational triage actions."""
    ACKNOWLEDGE = "acknowledge"
    ASSIGN = "assign"
    RESOLVE = "resolve"
    FALSE_POSITIVE = "false_positive"
    APPROVE_DETOUR = "approve_detour"
    VERIFY = "verify"


class IncidentSubmission(BaseModel):
    """Payload for citizen or responder hazard submission."""
    model_config = ConfigDict(extra="ignore")

    user_id_hash: Optional[str] = Field(default_factory=lambda: f"user_{uuid4().hex[:8]}", description="Anonymized SHA-256 hash of reporter device")
    location: GeoLocation = Field(..., description="Precise hazard coordinates")
    incident_type: Optional[IncidentType] = Field(default=IncidentType.LANDSLIDE)
    hazard_type: Optional[str] = Field(default=None, description="Frontend alias for hazard/incident type")
    vehicle_type: VehicleType = Field(default=VehicleType.COMMERCIAL_LIGHT)
    severity: str = Field(default="HIGH")
    description: Optional[str] = None
    notes: Optional[str] = None
    cluster_id: Optional[str] = None
    photo_preview: Optional[str] = None
    has_photo: Optional[bool] = False
    is_blocked: bool = Field(default=True)
    clearance_eta_hours: float = Field(default=0.0)
    rainfall_mm_reported: Optional[float] = Field(default=0.0, ge=0.0, le=250.0)
    honesty_label: HonestyLabel = Field(default=HonestyLabel.USER_SUBMITTED)
    authority_notice: str = Field(default=AUTHORITY_NOTICE)

    @model_validator(mode="before")
    @classmethod
    def normalize_fields(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if not data.get("user_id_hash"):
                data["user_id_hash"] = f"user_{uuid4().hex[:8]}"
            ht = data.get("hazard_type") or data.get("incident_type")
            if ht:
                ht_str = str(ht).lower()
                if "clear" in ht_str:
                    data["incident_type"] = IncidentType.CLEAR
                    data["is_blocked"] = False
                elif "water" in ht_str or "flood" in ht_str:
                    data["incident_type"] = IncidentType.WATERLOGGING
                elif "damage" in ht_str or "collapse" in ht_str or "bridge" in ht_str or "cone" in ht_str:
                    data["incident_type"] = IncidentType.ROAD_COLLAPSE
                elif "rock" in ht_str:
                    data["incident_type"] = IncidentType.ROCKFALL
                else:
                    data["incident_type"] = IncidentType.LANDSLIDE
            if not data.get("description") and data.get("notes"):
                data["description"] = data.get("notes")
            elif not data.get("notes") and data.get("description"):
                data["notes"] = data.get("description")
        return data


class IncidentCluster(BaseModel):
    """Aggregated spatial cluster within 500m Haversine radius."""
    model_config = ConfigDict(extra="ignore")

    cluster_id: str = Field(..., description="Human readable cluster ID, e.g. CLUSTER-SONAPUR-01")
    centroid: GeoLocation
    incident_type: IncidentType
    status: IncidentStatus = Field(default=IncidentStatus.PENDING)
    reports_count: int = Field(default=1)
    reports: List[IncidentReport] = Field(default_factory=list)
    is_confirmed_blockage: bool = Field(default=False)
    corridor_affected: Optional[str] = None
    first_reported_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_reported_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    rainfall_mm: float = Field(default=0.0)
    honesty_label: HonestyLabel = Field(default=HonestyLabel.USER_SUBMITTED)
    authority_notice: str = Field(default=AUTHORITY_NOTICE)


class ClusterResponse(BaseModel):
    """Response returned upon report ingestion."""
    model_config = ConfigDict(extra="ignore")

    cluster: IncidentCluster
    action_taken: str = Field(..., description="'created' or 'merged'")
    status: IncidentStatus
    is_confirmed_blockage: bool
    authority: str = Field(default=AUTHORITY_NAME)
    disclaimer: str = Field(default=AUTHORITY_NOTICE)
    honesty_label: HonestyLabel = Field(default=HonestyLabel.USER_SUBMITTED)


class OperatorActionRequest(BaseModel):
    """Request payload for operator action."""
    model_config = ConfigDict(extra="ignore")

    operator_id: str = Field(..., description="Operator identifier (e.g. NDMA-OPS-04)")
    action: OperatorActionType
    reason: str = Field(..., description="Operational rationale")
    notes: Optional[str] = None


class IncidentAuditLogEntry(BaseModel):
    """Immutable audit entry for operator incident actions."""
    model_config = ConfigDict(extra="ignore")

    log_id: str
    target_id: str
    operator_id: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    action: OperatorActionType
    previous_status: IncidentStatus
    new_status: IncidentStatus
    reason: str
    authority: str = Field(default=AUTHORITY_NAME)
    disclaimer: str = Field(default=AUTHORITY_NOTICE)
    honesty_label: HonestyLabel = Field(default=HonestyLabel.SIMULATION)


class OperatorActionResponse(BaseModel):
    """Response returned upon operator action."""
    model_config = ConfigDict(extra="ignore")

    success: bool
    target_id: str
    action_applied: OperatorActionType
    new_status: IncidentStatus
    audit_entry: IncidentAuditLogEntry
    authority: str = Field(default=AUTHORITY_NAME)
    disclaimer: str = Field(default=AUTHORITY_NOTICE)
    honesty_label: HonestyLabel = Field(default=HonestyLabel.SIMULATION)


class SOSState(str, Enum):
    """Lifecycle states for emergency SOS distress events."""
    INITIATED = "initiated"
    SENDING = "sending"
    DELIVERED = "delivered"
    ACKNOWLEDGED = "acknowledged"
    ASSIGNED = "assigned"
    RESOLVED = "resolved"


class SOSFailureState(str, Enum):
    """Failure and degraded connectivity states for SOS."""
    NONE = "none"
    FAILED = "failed"
    FALLBACK_OFFERED = "fallback_offered"
    QUEUED_OFFLINE = "queued_offline"
    RETRY_PENDING = "retry_pending"


class SOSLayer(str, Enum):
    """The 4-layer cascade transport tiers for distress signal transmission."""
    LAYER_1_IP = "layer_1_ip"
    LAYER_2_MESH = "layer_2_mesh"
    LAYER_3_OS_HOOKS = "layer_3_os_hooks"
    LAYER_4_AIR_VECTOR = "layer_4_air_vector"


class OperatorSOSActionType(str, Enum):
    """Actions operators can perform on queued SOS events."""
    ACKNOWLEDGE = "acknowledge"
    ASSIGN = "assign"
    RESOLVE = "resolve"
    TRIGGER_FALLBACK = "trigger_fallback"
    VERIFY = "verify"
    RELAY = "relay"


class CascadeLayerInfo(BaseModel):
    """Metadata detailing the capability and status of a cascade transmission layer."""
    model_config = ConfigDict(extra="ignore")

    layer: SOSLayer
    name: str
    status: str
    honesty_label: HonestyLabel
    details: Dict[str, Any] = Field(default_factory=dict)


class SOSPayload(BaseModel):
    """Inbound distress payload from citizen or driver."""
    model_config = ConfigDict(extra="ignore")

    sender_id_hash: str = Field(default_factory=lambda: f"anon_{uuid4().hex[:12]}", description="Anonymized device/sender hash")
    location: GeoLocation
    distress_type: str = Field(default="STRANDED_HAZARD")
    urgency_level: str = Field(default="CRITICAL")
    message: Optional[str] = None
    network_condition: Optional[str] = Field(default="online", description="'online', 'degraded', or 'offline'")
    vehicle_type: Optional[VehicleType] = None


class SOSAuditLogEntry(BaseModel):
    """Immutable audit entry for SOS transitions and operator triage."""
    model_config = ConfigDict(extra="ignore")

    log_id: str
    sos_id: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    operator_id: Optional[str] = Field(default=None, description="Operator ID or 'SYSTEM'")
    action: str
    from_state: str
    to_state: str
    from_failure_state: Optional[str] = None
    to_failure_state: Optional[str] = None
    reason: Optional[str] = None
    authority: str = Field(default=AUTHORITY_NAME)
    disclaimer: str = Field(default=AUTHORITY_NOTICE)
    emergency_notice: str = Field(default=SOS_EMERGENCY_NOTICE)
    honesty_label: HonestyLabel = Field(default=HonestyLabel.SIMULATION)


class SOSRecord(BaseModel):
    """Internal server representation of an SOS distress event with full history."""
    model_config = ConfigDict(extra="ignore")

    id: str
    sender_id_hash: str
    location: GeoLocation
    distress_type: str = Field(default="STRANDED_HAZARD")
    urgency_level: str = Field(default="CRITICAL")
    message: Optional[str] = None
    state: SOSState = Field(default=SOSState.DELIVERED)
    failure_state: SOSFailureState = Field(default=SOSFailureState.NONE)
    active_layer: SOSLayer = Field(default=SOSLayer.LAYER_1_IP)
    status_label: str = Field(
        default="Signal Delivered to Queue - Awaiting Operator Review",
        description="Public status label. Under strict rules, MUST NEVER be labeled 'Rescued'."
    )
    is_dispatched: bool = Field(
        default=False,
        description="Strictly False: live dispatch is not implied or connected."
    )
    cascade_layers: List[CascadeLayerInfo] = Field(default_factory=list)
    audit_trail: List[SOSAuditLogEntry] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    authority: str = Field(default=AUTHORITY_NAME)
    disclaimer: str = Field(default=AUTHORITY_NOTICE)
    emergency_notice: str = Field(default=SOS_EMERGENCY_NOTICE)
    honesty_label: HonestyLabel = Field(default=HonestyLabel.SIMULATION)


class SOSResponse(BaseModel):
    """Immediate response payload returned upon SOS signal ingestion."""
    model_config = ConfigDict(extra="ignore")

    event_id: str
    state: SOSState
    failure_state: SOSFailureState = Field(default=SOSFailureState.NONE)
    is_dispatched: bool = Field(default=False)
    status_label: str
    cascade_layers: List[CascadeLayerInfo] = Field(default_factory=list)
    authority: str = Field(default=AUTHORITY_NAME)
    disclaimer: str = Field(default=AUTHORITY_NOTICE)
    emergency_notice: str = Field(default=SOS_EMERGENCY_NOTICE)
    honesty_label: HonestyLabel = Field(default=HonestyLabel.SIMULATION)


class SOSStatusPollResponse(BaseModel):
    """Detailed poll response for checking SOS lifecycle progress."""
    model_config = ConfigDict(extra="ignore")

    event_id: str
    state: SOSState
    failure_state: SOSFailureState = Field(default=SOSFailureState.NONE)
    active_layer: SOSLayer
    is_dispatched: bool = Field(default=False)
    status_label: str
    location: GeoLocation
    distress_type: str
    urgency_level: str
    cascade_layers: List[CascadeLayerInfo] = Field(default_factory=list)
    audit_trail: List[SOSAuditLogEntry] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime
    authority: str = Field(default=AUTHORITY_NAME)
    disclaimer: str = Field(default=AUTHORITY_NOTICE)
    emergency_notice: str = Field(default=SOS_EMERGENCY_NOTICE)
    honesty_label: HonestyLabel = Field(default=HonestyLabel.SIMULATION)


class OperatorSOSActionRequest(BaseModel):
    """Request payload for operator triage action on an SOS event."""
    model_config = ConfigDict(extra="ignore")

    operator_id: str = Field(..., description="Operator identifier (e.g. NDMA-OPS-01)")
    action: OperatorSOSActionType
    reason: Optional[str] = None
    notes: Optional[str] = None


class AdvisoryPolishRequest(BaseModel):
    """Request payload for generating or polishing multilingual emergency corridor advisories."""
    model_config = ConfigDict(extra="ignore")

    corridor_name: str = Field(..., description="Corridor designation and highway name (e.g. C1 NH-6)")
    is_blocked: bool = Field(default=False, description="Whether corridor is blocked")
    is_detour: bool = Field(default=False, description="Whether route is an alternate detour")
    all_blocked: bool = Field(default=False, description="True if all ground corridors are impassable")
    risk_score: float = Field(default=0.0, ge=0.0, le=100.0, description="Risk index Ri")
    rainfall_mm: float = Field(default=0.0, ge=0.0, description="Precipitation rate in mm")
    hazard_type: Optional[str] = Field(default=None, description="Dominant hazard (e.g. LANDSLIDE)")
    veto_reason: Optional[str] = Field(default=None, description="Veto trigger reason")
    detour_km: Optional[float] = Field(default=None, description="Added detour distance in km")
    eta_minutes: Optional[float] = Field(default=None, description="Additional estimated transit minutes")
    vehicle_type: Optional[VehicleType] = None
    authority_notice: str = Field(default=AUTHORITY_NOTICE)


class AdvisoryPolishResponse(BaseModel):
    """Structured response containing polished multilingual advisory with provenance."""
    model_config = ConfigDict(extra="ignore")

    advisory_brief: MultilingualAdvisory
    is_fallback: bool = Field(..., description="True if deterministic fallback template was used")
    source: str = Field(..., description="'gemini_polished' or 'template_fallback'")
    fallback_reason: Optional[str] = Field(default=None, description="Reason for fallback if triggered")
    latency_ms: float = Field(default=0.0, ge=0.0, description="Processing latency in milliseconds")
    authority: str = Field(default=AUTHORITY_NAME)
    disclaimer: str = Field(default=AUTHORITY_NOTICE)
    honesty_label: HonestyLabel = Field(default=HonestyLabel.SIMULATION)


class ScenarioApplyRequest(BaseModel):
    """Payload to alter demo environmental simulation conditions in real time."""
    model_config = ConfigDict(extra="ignore")

    rainfall_mm: Optional[float] = Field(
        default=None, ge=0.0, le=250.0, description="Precipitation level across chokepoints (0-250mm)"
    )
    inject_hazard_sonapur: Optional[bool] = Field(
        default=None, description="Inject landslide blockage at Sonapur Tunnel (NH-6)"
    )
    inject_hazard_haflong: Optional[bool] = Field(
        default=None, description="Inject hazard disruption at Haflong Bypass (NH-27)"
    )
    ndma_override: Optional[bool] = Field(
        default=None, description="Toggle NDMA Administrative Safety Override"
    )
    season: Optional[str] = Field(
        default=None, description="Seasonal risk weight profile (monsoon, post_monsoon, winter, pre_monsoon)"
    )
    simulated_fleet_positions: Optional[List[Dict[str, Any]]] = Field(
        default=None, description="Simulated emergency or freight vehicle positions"
    )


class ScenarioStateResponse(BaseModel):
    """Current state of demo scenario and environmental controls."""
    model_config = ConfigDict(extra="ignore")

    active_scenario_name: str
    rainfall_mm: float
    inject_hazard_sonapur: bool
    inject_hazard_haflong: bool
    ndma_override: bool
    season: str
    is_baseline: bool
    active_corridor_vetoes: List[str] = Field(default_factory=list)
    simulated_fleet_count: int = 0
    authority: str = Field(default=AUTHORITY_NAME)
    disclaimer: str = Field(default=AUTHORITY_NOTICE)
    honesty_label: HonestyLabel = Field(default=HonestyLabel.SIMULATION)


class ScenarioResetResponse(BaseModel):
    """Response returned upon one-click baseline restoration."""
    model_config = ConfigDict(extra="ignore")

    success: bool = True
    message: str
    baseline_scenario_name: str
    restored_timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    authority: str = Field(default=AUTHORITY_NAME)
    disclaimer: str = Field(default=AUTHORITY_NOTICE)
    honesty_label: HonestyLabel = Field(default=HonestyLabel.SIMULATION)






