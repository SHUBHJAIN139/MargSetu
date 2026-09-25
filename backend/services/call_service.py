"""Call Service (callService) for MargSetu.

PRD Reference: PRD v2.0 §9 (Interactive Voice Response IVR Simulation)
Authority Integrity: NDMA is the ONLY authority named.
Disclaimer: SIMULATION — not connected to official NDMA systems.
"""

from typing import Dict, List
from models.schemas import AUTHORITY_NAME, AUTHORITY_NOTICE, HonestyLabel


class CallService:
    """Simulates multi-lingual interactive voice response flows for low-bandwidth users."""

    def __init__(self):
        self._call_logs: List[Dict] = []

    def generate_ivr_prompts(self, language: str = "en") -> Dict:
        """Generate structured IVR script options."""
        ivr_flow = {
            "authority": AUTHORITY_NAME,
            "disclaimer": AUTHORITY_NOTICE,
            "honesty_label": HonestyLabel.SIMULATION.value,
            "language": language,
            "greeting": (
                f"Welcome to the {AUTHORITY_NAME} MargSetu Emergency Advisory Simulation. "
                "Notice: This is a simulation and not connected to official systems."
            ),
            "options": {
                "1": "Check NH-6 Guwahati-Silchar Sonapur corridor status",
                "2": "Check NH-27 Haflong Detour status",
                "3": "Record crowd landslide observation",
                "9": "Simulate emergency SOS transmission",
            },
        }
        self._call_logs.append(ivr_flow)
        return ivr_flow
