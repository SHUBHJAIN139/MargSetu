"""Mesh Service (meshService) for MargSetu.

PRD Reference: PRD v2.0 §9 (Peer-to-Peer Store-and-Forward Mesh Network Simulation)
Authority Integrity: NDMA is the ONLY authority named.
Disclaimer: SIMULATION — not connected to official NDMA systems.
"""

from typing import Dict, List
from models.schemas import AUTHORITY_NAME, AUTHORITY_NOTICE, HonestyLabel


class MeshService:
    """Simulates delay-tolerant mesh store-and-forward synchronization between field devices."""

    def __init__(self):
        self._synced_packets: List[Dict] = []

    def sync_packet(self, origin_node: str, relay_node: str, payload: Dict) -> Dict:
        """Simulate packet hopping across corridor mountain nodes."""
        packet_record = {
            "origin_node": origin_node,
            "relay_node": relay_node,
            "payload_type": payload.get("type", "incident_sync"),
            "hop_count": payload.get("hop_count", 0) + 1,
            "honesty_label": HonestyLabel.SIMULATION.value,
            "authority_notice": AUTHORITY_NOTICE,
        }
        self._synced_packets.append(packet_record)
        return packet_record

    def get_mesh_status(self) -> Dict:
        """Return simulated mesh topology health."""
        return {
            "active_simulated_nodes": ["Guwahati-Hub", "Shillong-Relay", "Sonapur-Portal-Node", "Silchar-Gateway"],
            "packets_routed": len(self._synced_packets),
            "authority": AUTHORITY_NAME,
            "disclaimer": AUTHORITY_NOTICE,
            "honesty_label": HonestyLabel.SIMULATION.value,
        }
