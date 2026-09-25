"""MargSetu FastAPI Main Application.

PRD Reference: PRD v2.0 §0, §1, §2, §3, §9 (Build Order Item 1)
Authority Integrity: NDMA is the ONLY authority named.
Mandatory Disclaimer: SIMULATION — not connected to official NDMA systems.
"""

from contextlib import asynccontextmanager
from datetime import datetime, timezone
import json
import logging
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger("margsetu")

from fastapi import Body, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from models.schemas import (
    AUTHORITY_NAME,
    AUTHORITY_NOTICE,
    AdvisoryPolishRequest,
    AdvisoryPolishResponse,
    ClusterResponse,
    HealthResponse,
    HonestyLabel,
    IncidentSubmission,
    OperatorActionRequest,
    OperatorActionResponse,
    OperatorSOSActionRequest,
    RouteEvaluateResponse,
    SOS_EMERGENCY_NOTICE,
    SOSPayload,
    SOSRecord,
    SOSResponse,
    SOSStatusPollResponse,
    ScenarioApplyRequest,
    ScenarioResetResponse,
    ScenarioStateResponse,
    VehicleType,
)
from services.risk_service import RiskService
from services.route_service import RouteService
from services.report_service import ReportService
from services.sos_service import SOSService
from services.weather_service import WeatherService
from services.llm_service import LLMService
from services.sms_service import SMSService
from services.call_service import CallService
from services.mesh_service import MeshService
from services.satellite_service import SatelliteService
from services.scenario_service import ScenarioService
from database import db


BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
CONFIG_PATH = DATA_DIR / "config.json"
CORRIDORS_PATH = DATA_DIR / "corridors.geojson"
RESET_PATH = DATA_DIR / "scenario_reset.json"

# Auto-load .env configuration
ENV_FILE = BASE_DIR / ".env"
if ENV_FILE.exists():
    with open(ENV_FILE, "r", encoding="utf-8") as _f:
        for _line in _f:
            _line = _line.strip()
            if _line and not _line.startswith("#") and "=" in _line:
                _k, _v = _line.split("=", 1)
                os.environ.setdefault(_k.strip(), _v.strip())


def load_json_file(file_path: Path) -> Dict[str, Any]:
    """Safely load JSON data from disk."""
    if not file_path.exists():
        raise FileNotFoundError(f"Required data file missing: {file_path}")
    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager: loads baseline configuration, corridors, and initializes services."""
    # 1. Load configuration and corridor geojson
    config_data = load_json_file(CONFIG_PATH)
    corridors_geojson = load_json_file(CORRIDORS_PATH)
    reset_data = load_json_file(RESET_PATH) if RESET_PATH.exists() else {}

    # 2. Store loaded data in app state
    app.state.config = config_data
    app.state.corridors = corridors_geojson
    app.state.reset_data = reset_data

    # 3. Seed persistent relational database
    db.seed_baseline(reset_data)
    app.state.db = db

    # 4. Instantiate domain services
    app.state.risk_service = RiskService(config=config_data)
    app.state.route_service = RouteService(config=config_data, corridors_geojson=corridors_geojson)
    app.state.report_service = ReportService(initial_reports=reset_data.get("baseline_incidents", []))
    app.state.weather_service = WeatherService(baseline_weather=reset_data.get("baseline_weather", []))
    app.state.sos_service = SOSService()
    app.state.llm_service = LLMService(api_key=os.environ.get("GEMINI_API_KEY"))
    app.state.sms_service = SMSService()
    app.state.call_service = CallService()
    app.state.mesh_service = MeshService()
    app.state.satellite_service = SatelliteService()
    app.state.scenario_service = ScenarioService(
        reset_data=reset_data,
        weather_service=app.state.weather_service,
        report_service=app.state.report_service,
        risk_service=app.state.risk_service,
        route_service=app.state.route_service,
        sos_service=app.state.sos_service,
    )

    yield

    # Clean shutdown handling
    pass


app = FastAPI(
    title="MargSetu Core Engine",
    description=(
        "Disaster Resilient Lifeline Corridor Routing & Response System "
        "(SIH 2026 / SIH26002 - MDoNER - NDMA). "
        "Notice: SIMULATION — not connected to official NDMA systems."
    ),
    version="2.0.0",
    lifespan=lifespan,
)

# Configure CORS (open simulation API with credentials disabled for spec compliance)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", tags=["System"])
def read_root(request: Request):
    """Root endpoint: returns system metadata for API clients, redirects browsers to Swagger UI."""
    accept = request.headers.get("accept", "")
    if "text/html" in accept and "application/json" not in accept:
        return RedirectResponse(url="/docs")
    return {
        "service": "MargSetu Core Engine",
        "version": "2.0.0",
        "authority": AUTHORITY_NAME,
        "disclaimer": AUTHORITY_NOTICE,
        "honesty_label": HonestyLabel.VERIFIED_STATIC.value,
        "docs_url": "/docs",
        "health_url": "/health",
    }


@app.get("/health", response_model=HealthResponse, tags=["System"])
def health_check():
    """Deterministic system health check verifying corridor data and configuration."""
    corridors_feat = getattr(app.state, "corridors", {}).get("features", [])
    config_loaded = bool(getattr(app.state, "config", None))

    return HealthResponse(
        status="healthy",
        service="MargSetu Core Engine",
        version="2.0.0",
        authority=AUTHORITY_NAME,
        disclaimer=AUTHORITY_NOTICE,
        honesty_label=HonestyLabel.VERIFIED_STATIC,
        corridors_loaded=len(corridors_feat),
        config_loaded=config_loaded,
        timestamp=datetime.now(timezone.utc),
    )


@app.get("/api/corridors", tags=["Corridors"])
def get_corridors():
    """Return verified static GeoJSON FeatureCollection for Northeast lifeline corridors."""
    corridors = getattr(app.state, "corridors", None)
    if not corridors:
        raise HTTPException(status_code=500, detail="Corridor GeoJSON not initialized")
    return corridors


@app.get("/api/config", tags=["Configuration"])
def get_config():
    """Return deterministic routing and risk scoring configuration parameters."""
    cfg = getattr(app.state, "config", None)
    if not cfg:
        raise HTTPException(status_code=500, detail="Configuration not initialized")
    return cfg


@app.api_route("/routes/evaluate", methods=["GET", "POST"], response_model=RouteEvaluateResponse, tags=["Routing"])
def evaluate_routes(
    origin: str = "Guwahati",
    dest: str = "Silchar",
    vehicle: VehicleType = VehicleType.COMMERCIAL_LIGHT,
    season: str = "monsoon",
    inject_hazard_sonapur: bool = False,
    inject_hazard_haflong: bool = False,
    all_blocked: bool = False,
    rainfall_mm: Optional[float] = None,
    payload: Optional[Dict[str, Any]] = Body(default=None),
):
    """Deterministic Exponential-Dijkstra corridor route evaluation.
    
    Returns 3 route options (Fastest, Resilient [default], Emergency-Only),
    trade-off differentials matrix, and air-dispatch operational advisory fallback.
    Dynamically responds to active confirmed blockage clusters at Sonapur Tunnel.
    """
    route_service: RouteService = getattr(app.state, "route_service", None)
    risk_service: RiskService = getattr(app.state, "risk_service", None)
    report_service: ReportService = getattr(app.state, "report_service", None)

    if not route_service or not risk_service:
        raise HTTPException(status_code=500, detail="Routing services not initialized")

    scenario_service: ScenarioService = getattr(app.state, "scenario_service", None)

    # Resolve active rainfall from query param, active scenario, or default baseline (68.0mm)
    active_rainfall_mm = 68.0
    if rainfall_mm is not None:
        active_rainfall_mm = float(rainfall_mm)
    elif scenario_service:
        active_rainfall_mm = float(scenario_service.rainfall_mm)

    if payload:
        if "rainfall_mm" in payload and payload["rainfall_mm"] is not None:
            active_rainfall_mm = float(payload["rainfall_mm"])
        if "inject_hazard_sonapur" in payload:
            inject_hazard_sonapur = bool(payload["inject_hazard_sonapur"])
        if "inject_hazard_haflong" in payload:
            inject_hazard_haflong = bool(payload["inject_hazard_haflong"])
        if "all_blocked" in payload:
            all_blocked = bool(payload["all_blocked"])

    # Dynamic check: scenario controls + crowdsourced confirmed blockages
    has_sonapur_hazard = inject_hazard_sonapur or (active_rainfall_mm > 75.0)
    is_all_blocked = all_blocked or (has_sonapur_hazard and inject_hazard_haflong)
    is_ndma_override = False
    active_season = season

    if scenario_service:
        if scenario_service.inject_hazard_sonapur or (active_rainfall_mm > 75.0) or scenario_service.ndma_override:
            has_sonapur_hazard = True
        if (scenario_service.inject_hazard_sonapur or (active_rainfall_mm > 75.0)) and scenario_service.inject_hazard_haflong:
            is_all_blocked = True
        if scenario_service.ndma_override:
            is_ndma_override = True
        if scenario_service.season and season == "monsoon":
            active_season = scenario_service.season

    if report_service:
        has_confirmed = report_service.has_confirmed_blockage_near(25.1147, 92.3654, radius_km=5.0)
        crowd_count = report_service.get_corroborated_count_near(25.1147, 92.3654, radius_km=5.0)
        has_sonapur_hazard = has_sonapur_hazard or has_confirmed or (crowd_count >= 3)

    return route_service.evaluate_routes(
        origin=origin,
        destination=dest,
        vehicle_type=vehicle,
        season=active_season,
        risk_service=risk_service,
        inject_hazard_sonapur=has_sonapur_hazard,
        all_blocked=is_all_blocked,
        ndma_override=is_ndma_override,
        rainfall_mm=active_rainfall_mm,
    )


@app.post("/reports", response_model=ClusterResponse, tags=["Crowdsourcing"])
def submit_incident_report(submission: IncidentSubmission):
    """Ingest crowdsourced hazard report and perform 500m Haversine spatial clustering."""
    report_service: ReportService = getattr(app.state, "report_service", None)
    if not report_service:
        raise HTTPException(status_code=500, detail="Report service not initialized")
    res = report_service.ingest_submission(
        submission, current_rainfall_mm=submission.rainfall_mm_reported or 0.0
    )
    try:
        sub_dict = submission.model_dump()
        sub_dict["id"] = f"INC-{int(datetime.now().timestamp())}"
        sub_dict["cluster_id"] = res.cluster.cluster_id
        ht = submission.hazard_type or (submission.incident_type.value if hasattr(submission.incident_type, "value") else str(submission.incident_type))
        sub_dict["hazard_type"] = str(ht).upper()
        sub_dict["notes"] = submission.notes or submission.description or "Citizen field incident alert"
        sub_dict["status"] = res.cluster.status.value if hasattr(res.cluster.status, "value") else str(res.cluster.status)
        sub_dict["corroboration_level"] = res.cluster.reports_count
        db.insert_incident(sub_dict)
    except Exception as e:
        logger.warning(f"Could not persist incident to DB: {e}")
    return res


@app.get("/reports", tags=["Crowdsourcing"])
def get_incident_reports(status: Optional[str] = None, corridor: Optional[str] = None):
    """Retrieve all active incident clusters and member reports with honesty labeling."""
    report_service: ReportService = getattr(app.state, "report_service", None)
    if not report_service:
        raise HTTPException(status_code=500, detail="Report service not initialized")
    clusters = report_service.get_active_clusters(status=status, corridor=corridor)
    return {
        "clusters": [c.model_dump() for c in clusters],
        "total_clusters": len(clusters),
        "authority": AUTHORITY_NAME,
        "disclaimer": AUTHORITY_NOTICE,
        "honesty_label": HonestyLabel.USER_SUBMITTED.value,
    }


@app.post("/ops/incidents/{id}/action", response_model=OperatorActionResponse, tags=["Operations"])
def operator_incident_action(id: str, request: OperatorActionRequest):
    """Apply operator triage action (acknowledge, assign, resolve, false_positive, approve_detour)."""
    report_service: ReportService = getattr(app.state, "report_service", None)
    if not report_service:
        raise HTTPException(status_code=500, detail="Report service not initialized")
    try:
        res = report_service.apply_operator_action(target_id=id, request=request)
        try:
            action_val = request.action.value if hasattr(request.action, "value") else str(request.action)
            db.update_incident_status(
                incident_id=id,
                status=action_val,
                operator=request.operator_id or "NDMA-OP-01",
                reason=request.reason or request.notes,
            )
        except Exception as e:
            logger.warning(f"Could not sync incident operator action to DB: {e}")
        return res
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.post("/sos", response_model=SOSResponse, status_code=201, tags=["Emergency SOS"])
def submit_sos_alert(payload: SOSPayload):
    """Ingest emergency SOS signal and advance 4-layer cascade state machine."""
    sos_service: SOSService = getattr(app.state, "sos_service", None)
    if not sos_service:
        raise HTTPException(status_code=500, detail="SOS service not initialized")
    res = sos_service.ingest_sos(payload)
    try:
        rec = getattr(sos_service, "_records", {}).get(res.event_id)
        if rec:
            db.insert_sos_record({
                "id": rec.id if hasattr(rec, "id") else res.event_id,
                "sender_id_hash": getattr(rec, "sender_id_hash", payload.sender_id_hash),
                "location": rec.location.model_dump() if hasattr(rec.location, "model_dump") else rec.location,
                "vehicle_type": getattr(rec, "vehicle_type", payload.vehicle_type),
                "distress_type": rec.distress_type.value if hasattr(rec.distress_type, "value") else str(rec.distress_type),
                "urgency_level": rec.urgency_level.value if hasattr(rec.urgency_level, "value") else str(rec.urgency_level),
                "status": rec.state.value if hasattr(rec.state, "value") else str(rec.state),
                "status_label": getattr(rec, "status_label", "Signal Delivered to Queue"),
                "notes": getattr(rec, "notes", getattr(payload, "message", getattr(payload, "notes", ""))),
                "hooks": {h.channel: h.uri for h in rec.available_hooks} if hasattr(rec, "available_hooks") and rec.available_hooks else {},
            })
    except Exception as e:
        logger.warning(f"Could not persist SOS to DB: {e}")
    return res


@app.get("/sos/queue", tags=["Emergency SOS"])
def get_unified_sos_queue():
    """Unified queue endpoint matching frontend RealAdapter contract."""
    sos_service: SOSService = getattr(app.state, "sos_service", None)
    in_memory = [r.model_dump() for r in sos_service.list_records()] if sos_service else []
    db_records = db.get_all_sos()
    merged = {}
    for r in in_memory:
        r_id = r.get("event_id") or r.get("id")
        if r_id:
            merged[r_id] = r
    for r in db_records:
        r_id = r.get("id") or r.get("event_id")
        if r_id:
            merged[r_id] = r
    records_list = []
    for r in merged.values():
        rec_copy = dict(r)
        status_val = rec_copy.get("status") or rec_copy.get("state")
        rec_copy["status"] = status_val
        rec_copy["state"] = status_val
        if "id" in rec_copy and "event_id" not in rec_copy:
            rec_copy["event_id"] = rec_copy["id"]
        elif "event_id" in rec_copy and "id" not in rec_copy:
            rec_copy["id"] = rec_copy["event_id"]
        records_list.append(rec_copy)

    return {
        "records": records_list,
        "authority": AUTHORITY_NAME,
        "disclaimer": AUTHORITY_NOTICE,
        "emergency_notice": SOS_EMERGENCY_NOTICE,
        "honesty_label": HonestyLabel.SIMULATION.value,
    }


@app.get("/sos/{id}", response_model=SOSStatusPollResponse, tags=["Emergency SOS"])
def get_sos_status(id: str):
    """Poll the current lifecycle progress of an SOS distress signal."""
    sos_service: SOSService = getattr(app.state, "sos_service", None)
    if not sos_service:
        raise HTTPException(status_code=500, detail="SOS service not initialized")
    record = sos_service.get_sos(id)
    if not record:
        raise HTTPException(status_code=404, detail=f"SOS event '{id}' not found")
    return record


@app.post("/ops/sos/{id}/action", response_model=SOSRecord, tags=["Operations"])
def operator_sos_action(id: str, request: OperatorSOSActionRequest):
    """Apply operator triage action (acknowledge, assign, resolve, trigger_fallback)."""
    sos_service: SOSService = getattr(app.state, "sos_service", None)
    if not sos_service:
        raise HTTPException(status_code=500, detail="SOS service not initialized")
    try:
        updated = sos_service.apply_operator_action(event_id=id, request=request)
        try:
            status_val = updated.state.value if hasattr(updated.state, "value") else str(updated.state)
            action_name = request.action.value if hasattr(request.action, "value") else str(request.action)
            op_callsign = getattr(request, "operator_callsign", None) or getattr(request, "operator_id", "NDMA-OP-01")
            db.update_sos_status(
                event_id=id,
                new_status=status_val,
                operator_callsign=op_callsign,
                action_notes=request.notes or f"Action: {action_name}",
            )
        except Exception as e:
            logger.warning(f"Could not sync SOS operator action to DB: {e}")
        return updated
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.post("/ops/auth", tags=["Operations"])
def verify_operator_auth(payload: Dict[str, str]):
    """Verify operator passkey PIN (NDMA2026)."""
    pin = payload.get("pin", "").strip()
    if pin in ("NDMA2026", "1077"):
        return {
            "authenticated": True,
            "operator_callsign": "NDMA-OP-01",
            "sector": "Dispur / Shillong EOC",
            "authority": AUTHORITY_NAME,
        }
    raise HTTPException(status_code=401, detail="Access Denied: Invalid Operator PIN")


@app.get("/ops/sos", tags=["Operations"])
def get_ops_sos_queue(state: Optional[str] = None, failure_state: Optional[str] = None):
    """List all active and queued SOS alerts for the Ops dashboard."""
    sos_service: SOSService = getattr(app.state, "sos_service", None)
    if not sos_service:
        raise HTTPException(status_code=500, detail="SOS service not initialized")
    records = sos_service.list_records(state=state, failure_state=failure_state)
    return {
        "records": [r.model_dump() for r in records],
        "total_records": len(records),
        "authority": AUTHORITY_NAME,
        "disclaimer": AUTHORITY_NOTICE,
        "emergency_notice": SOS_EMERGENCY_NOTICE,
        "honesty_label": HonestyLabel.SIMULATION.value,
    }


@app.post("/advisory/polish", response_model=AdvisoryPolishResponse, tags=["Advisory Engine"])
def polish_emergency_advisory(request: AdvisoryPolishRequest):
    """Generate or polish multilingual corridor emergency advisory with template-first guarantee."""
    llm_service: LLMService = getattr(app.state, "llm_service", None)
    if not llm_service:
        raise HTTPException(status_code=500, detail="LLM service not initialized")
    return llm_service.polish_advisory(request)


@app.post("/scenario/apply", response_model=ScenarioStateResponse, tags=["Scenario Controls"])
def apply_scenario_controls(request: ScenarioApplyRequest):
    """Apply real-time environmental simulation adjustments (rainfall, hazard injections, NDMA override)."""
    scenario_service: ScenarioService = getattr(app.state, "scenario_service", None)
    if not scenario_service:
        raise HTTPException(status_code=500, detail="Scenario service not initialized")
    return scenario_service.apply_scenario(request)


@app.post("/scenario/reset", response_model=ScenarioResetResponse, tags=["Scenario Controls"])
def reset_scenario_to_baseline():
    """One-click byte-identical reset to baseline scenario state."""
    scenario_service: ScenarioService = getattr(app.state, "scenario_service", None)
    if not scenario_service:
        raise HTTPException(status_code=500, detail="Scenario service not initialized")
    res = scenario_service.reset_to_baseline()
    try:
        reset_data = getattr(app.state, "reset_data", {})
        db.reset_to_baseline(reset_data)
    except Exception as e:
        logger.warning(f"Could not reset SQLite database: {e}")
    return res


@app.get("/scenario/state", response_model=ScenarioStateResponse, tags=["Scenario Controls"])
def get_scenario_state():
    """Retrieve current active scenario simulation parameters and corridor vetoes."""
    scenario_service: ScenarioService = getattr(app.state, "scenario_service", None)
    if not scenario_service:
        raise HTTPException(status_code=500, detail="Scenario service not initialized")
    return scenario_service.get_state()


# ==============================================================================
# Persistent Relational Database Diagnostic Endpoints (SQLite WAL / PostGIS Schema)
# ==============================================================================

@app.get("/api/db/stats", tags=["Database"])
def get_database_stats():
    """Return diagnostic telemetry for persistent SQLite relational database."""
    return db.get_db_stats()


@app.get("/api/db/incidents", tags=["Database"])
def get_database_incidents():
    """Fetch all crowdsourced hazard reports persisted in the database."""
    return {"incidents": db.get_all_incidents(), "honesty_label": HonestyLabel.USER_SUBMITTED.value}


@app.get("/api/db/sos", tags=["Database"])
def get_database_sos():
    """Fetch all emergency distress beacons persisted in the database."""
    return {"sos_records": db.get_all_sos(), "honesty_label": HonestyLabel.SIMULATION.value}



@app.post("/reports/incident", response_model=ClusterResponse, tags=["Crowdsourcing"])
def submit_incident_report_alias(submission: IncidentSubmission):
    """Direct alias matching frontend RealAdapter.submitIncident."""
    return submit_incident_report(submission)


@app.get("/reports/corridor/{id}", tags=["Crowdsourcing"])
def get_corridor_incidents(id: str):
    """Fetch corridor incident reports matching frontend RealAdapter contract."""
    return {
        "corridor_id": id,
        "incidents": db.get_all_incidents(),
        "authority": AUTHORITY_NAME,
        "disclaimer": AUTHORITY_NOTICE,
        "honesty_label": HonestyLabel.USER_SUBMITTED.value,
    }






