"""MargSetu Services Package.

Contains all backend domain services:
- routeService (corridor graph & Dijkstra evaluation)
- riskService (deterministic multi-hazard score calculation)
- sosService (emergency SOS signal ingestion & queuing)
- reportService (citizen & field hazard incident aggregation)
- weatherService (atmospheric data aggregation & fallback)
- llmService (template-first advisory generation)
- smsService (offline compact SMS dispatch simulation)
- callService (voice IVR interactive simulation)
- meshService (ad-hoc peer-to-peer relay simulation)
- satelliteService (earth observation SAR overlay simulation)

All services strictly enforce NDMA Authority Integrity:
'SIMULATION — not connected to official NDMA systems'
"""

from .route_service import RouteService
from .risk_service import RiskService
from .sos_service import SOSService
from .report_service import ReportService
from .weather_service import WeatherService
from .llm_service import LLMService
from .sms_service import SMSService
from .call_service import CallService
from .mesh_service import MeshService
from .satellite_service import SatelliteService
from .scenario_service import ScenarioService

__all__ = [
    "RouteService",
    "RiskService",
    "SOSService",
    "ReportService",
    "WeatherService",
    "LLMService",
    "SMSService",
    "CallService",
    "MeshService",
    "SatelliteService",
    "ScenarioService",
]
