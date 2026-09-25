"""SMS Service (smsService) for MargSetu.

PRD Reference: PRD v2.0 §9 (Simulated Compact 160-char SMS Fallback)
Authority Integrity: NDMA is the ONLY authority named.
Disclaimer: SIMULATION — not connected to official NDMA systems.
"""

from typing import Dict, List
from models.schemas import AUTHORITY_NAME, AUTHORITY_NOTICE, HonestyLabel


class SMSService:
    """Formats and queues ultra-compact (<160 char) offline emergency SMS payloads."""

    def __init__(self):
        self._sent_messages: List[Dict] = []

    def format_offline_sms(
        self,
        recipient_phone: str,
        corridor_id: str,
        is_blocked: bool,
        chokepoint_name: str,
    ) -> Dict:
        """Construct SMS text under 160 chars strictly adhering to simulation disclosures."""
        status_text = "BLOCKED" if is_blocked else "OPEN-CAUTION"
        # Truncated compact advisory
        body = (
            f"[{AUTHORITY_NAME}-SIM] {corridor_id}:{status_text} at {chokepoint_name}. "
            f"SIMULATION-no official dispatch"
        )
        record = {
            "recipient": recipient_phone,
            "body": body[:160],
            "char_count": len(body[:160]),
            "honesty_label": HonestyLabel.SIMULATION.value,
            "disclaimer": AUTHORITY_NOTICE,
        }
        self._sent_messages.append(record)
        return record
