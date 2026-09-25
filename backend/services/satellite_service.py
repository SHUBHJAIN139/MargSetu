"""Satellite Service (satelliteService) for MargSetu.

PRD Reference: PRD v2.0 §9 (Earth Observation & SAR Slope Deformation Simulation)
Authority Integrity: NDMA is the ONLY authority named.
Disclaimer: SIMULATION — not connected to official NDMA systems.
Strict Rule: NEVER imply real-time satellite capability, downlink, or live spy imagery.
All outputs are strictly synthetic simulations for demonstration.
"""

from typing import Dict, List
from models.schemas import AUTHORITY_NAME, AUTHORITY_NOTICE, HonestyLabel


class SatelliteService:
    """Provides synthetic InSAR/SAR slope displacement overlays for corridor monitoring."""

    def __init__(self):
        pass

    def get_slope_deformation_overlay(self, corridor_id: str) -> Dict:
        """Generate synthetic satellite radar displacement raster metadata.
        
        Strictly labeled SIMULATION — no real-time satellite capability implied.
        """
        return {
            "corridor_id": corridor_id,
            "sensor_type": "Synthetic InSAR Interferogram Simulation",
            "resolution_m": 20.0,
            "simulated_pass_time": "2026-09-19T06:00:00Z",
            "deformation_detected_mm": 14.5 if corridor_id == "C1" else 2.1,
            "displacement_hotspots": [
                {
                    "name": "Sonapur Tunnel Escarpment",
                    "coordinates": [92.3654, 25.1147],
                    "simulated_subsidence_mm": 18.2,
                }
            ] if corridor_id == "C1" else [],
            "authority": AUTHORITY_NAME,
            "disclaimer": AUTHORITY_NOTICE,
            "honesty_label": HonestyLabel.SIMULATION.value,
        }
