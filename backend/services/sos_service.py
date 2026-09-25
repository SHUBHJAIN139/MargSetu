"""SOS Service (sosService) for MargSetu.

PRD Reference: PRD v2.0 §2, §6, §7, §8 (SOS 4-Layer Cascade, State Machine & Privacy), §9 (Build Order Item 5)
Authority Integrity: NDMA is the ONLY authority named.
Disclaimer: SIMULATION — not connected to official NDMA systems.
Emergency Notice: MargSetu is not a replacement for official emergency services.
Strict Rule: State 'delivered' is NEVER represented as 'rescued'; is_dispatched=False is permanently enforced.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from urllib.parse import quote
from uuid import uuid4

from models.schemas import (
    AUTHORITY_NAME,
    AUTHORITY_NOTICE,
    CascadeLayerInfo,
    GeoLocation,
    HonestyLabel,
    OperatorSOSActionRequest,
    OperatorSOSActionType,
    SOSAlert,
    SOSAuditLogEntry,
    SOSFailureState,
    SOSLayer,
    SOSPayload,
    SOSRecord,
    SOSResponse,
    SOSState,
    SOSStatusPollResponse,
    SOS_EMERGENCY_NOTICE,
)


class SOSService:
    """Manages emergency SOS distress signals and 4-layer cascade state machine."""

    DELIVERED_STATUS_LABEL = "Signal Delivered to Queue - Awaiting Operator Review"

    def __init__(self):
        self._records: Dict[str, SOSRecord] = {}
        self._alerts: Dict[str, SOSAlert] = {}
        self._audit_logs: List[SOSAuditLogEntry] = []

    def build_cascade_layers(
        self,
        location: GeoLocation,
        distress_type: str = "STRANDED_HAZARD",
        network_condition: str = "online",
    ) -> List[CascadeLayerInfo]:
        """Construct metadata and hooks for the 4-layer transmission cascade."""
        lat = location.latitude
        lon = location.longitude

        # Compact SMS body (<160 chars) with verified coordinates
        sms_text = (
            f"[{AUTHORITY_NAME}-SIM] SOS! Loc: {lat:.4f}N, {lon:.4f}E. "
            f"Distr: {distress_type}. MargSetu sim-not official dispatch"
        )[:160]

        # Layer 1: IP / Mobile Data (SIMULATION)
        layer_1 = CascadeLayerInfo(
            layer=SOSLayer.LAYER_1_IP,
            name="Layer 1: IP/Data Direct Transmission",
            status="active" if network_condition == "online" else "timed_out",
            honesty_label=HonestyLabel.SIMULATION,
            details={
                "transport": "HTTPS REST POST /sos",
                "simulated_timeout_seconds": 5,
                "latency_ms": 120 if network_condition == "online" else 5000,
                "endpoint": "/sos",
            },
        )

        # Layer 2: Peer-to-Peer Delay-Tolerant Mesh (SIMULATION)
        layer_2 = CascadeLayerInfo(
            layer=SOSLayer.LAYER_2_MESH,
            name="Layer 2: Delay-Tolerant Mountain Mesh Network",
            status="queued_offline" if network_condition in ["offline", "degraded"] else "standby",
            honesty_label=HonestyLabel.SIMULATION,
            details={
                "topology": "Store-and-forward delay-tolerant mesh",
                "corridor_nodes": [
                    "Guwahati-Hub",
                    "Shillong-Relay",
                    "Sonapur-Portal-Node",
                    "Silchar-Gateway",
                ],
                "hop_count": 2 if network_condition in ["offline", "degraded"] else 0,
            },
        )

        # Layer 3: Native Device OS Telephony Hooks (REAL OS hooks / VERIFIED STATIC)
        layer_3 = CascadeLayerInfo(
            layer=SOSLayer.LAYER_3_OS_HOOKS,
            name="Layer 3: Telephony OS Call/SMS Intent Hooks",
            status="ready",
            honesty_label=HonestyLabel.VERIFIED_STATIC,
            details={
                "ddma_helpline": "1077",
                "national_emergency": "112",
                "emergency_numbers": ["1077", "112"],
                "tel_uri_1077": "tel:1077",
                "tel_uri_112": "tel:112",
                "sms_body": sms_text,
                "sms_char_count": len(sms_text),
                "sms_uri": f"sms:1077?body={quote(sms_text)}",
                "description": "Native OS dialer/SMS intents functioning completely offline.",
            },
        )

        # Layer 4: Physical Rescue Vector Metadata (SIMULATION)
        layer_4 = CascadeLayerInfo(
            layer=SOSLayer.LAYER_4_AIR_VECTOR,
            name="Layer 4: Physical Evacuation & Air Rescue Vectoring",
            status="locked",
            honesty_label=HonestyLabel.SIMULATION,
            details={
                "corridor": "Guwahati Borjhar (GAU/VEGT) to Silchar Kumbhirgram (IXS/VEKU)",
                "target_coordinates": {"latitude": lat, "longitude": lon},
                "ops_view_only": True,
                "live_dispatch_active": False,
                "chokepoint_ref": "Sonapur Tunnel Chokepoint (NH-6)" if abs(lat - 25.1147) < 0.1 else "Corridor Transit",
            },
        )

        return [layer_1, layer_2, layer_3, layer_4]

    def _append_audit_log(
        self,
        sos_id: str,
        action: str,
        from_state: str,
        to_state: str,
        from_failure_state: Optional[str] = None,
        to_failure_state: Optional[str] = None,
        operator_id: Optional[str] = None,
        reason: Optional[str] = None,
    ) -> SOSAuditLogEntry:
        """Create and store an immutable audit log entry."""
        log_entry = SOSAuditLogEntry(
            log_id=f"audit-sos-{uuid4().hex[:8]}",
            sos_id=sos_id,
            timestamp=datetime.now(timezone.utc),
            operator_id=operator_id or "SYSTEM",
            action=action,
            from_state=from_state,
            to_state=to_state,
            from_failure_state=from_failure_state,
            to_failure_state=to_failure_state,
            reason=reason or f"Automatic transition to {to_state}",
            authority=AUTHORITY_NAME,
            disclaimer=AUTHORITY_NOTICE,
            emergency_notice=SOS_EMERGENCY_NOTICE,
            honesty_label=HonestyLabel.SIMULATION,
        )
        self._audit_logs.append(log_entry)
        if sos_id in self._records:
            self._records[sos_id].audit_trail.append(log_entry)
        return log_entry

    def ingest_sos(self, payload: SOSPayload) -> SOSResponse:
        """Ingest an emergency distress signal and advance the state machine."""
        event_id = f"sos-{uuid4().hex[:8]}"
        network_cond = (payload.network_condition or "online").lower()

        cascade_layers = self.build_cascade_layers(
            location=payload.location,
            distress_type=payload.distress_type,
            network_condition=network_cond,
        )

        # Initial state: INITIATED
        current_state = SOSState.INITIATED
        failure_state = SOSFailureState.NONE
        active_layer = SOSLayer.LAYER_1_IP
        status_label = "Distress Signal Initiated"

        # Initialize record
        record = SOSRecord(
            id=event_id,
            sender_id_hash=payload.sender_id_hash,
            location=payload.location,
            distress_type=payload.distress_type,
            urgency_level=payload.urgency_level,
            message=payload.message,
            state=current_state,
            failure_state=failure_state,
            active_layer=active_layer,
            status_label=status_label,
            is_dispatched=False,  # Permanently False
            cascade_layers=cascade_layers,
            audit_trail=[],
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
            authority=AUTHORITY_NAME,
            disclaimer=AUTHORITY_NOTICE,
            emergency_notice=SOS_EMERGENCY_NOTICE,
            honesty_label=HonestyLabel.SIMULATION,
        )
        self._records[event_id] = record

        # Transition 1: INITIATED -> SENDING
        self._append_audit_log(
            sos_id=event_id,
            action="SENDING",
            from_state=SOSState.INITIATED.value,
            to_state=SOSState.SENDING.value,
            from_failure_state=SOSFailureState.NONE.value,
            to_failure_state=SOSFailureState.NONE.value,
            reason="Transmission in flight",
        )
        record.state = SOSState.SENDING

        # Evaluate network delivery / simulated timeout
        if network_cond == "offline":
            # Timeout / connection failure path
            self._append_audit_log(
                sos_id=event_id,
                action="CONNECTION_TIMEOUT",
                from_state=SOSState.SENDING.value,
                to_state=SOSState.SENDING.value,
                from_failure_state=SOSFailureState.NONE.value,
                to_failure_state=SOSFailureState.FAILED.value,
                reason="Direct IP connection timed out after 5s",
            )
            record.failure_state = SOSFailureState.FAILED

            # Transition to FALLBACK_OFFERED
            self._append_audit_log(
                sos_id=event_id,
                action="FALLBACK_OFFERED",
                from_state=SOSState.SENDING.value,
                to_state=SOSState.SENDING.value,
                from_failure_state=SOSFailureState.FAILED.value,
                to_failure_state=SOSFailureState.FALLBACK_OFFERED.value,
                reason="Offering Layer 2 Mesh queue and Layer 3 Telephony hooks (1077/112)",
            )
            record.failure_state = SOSFailureState.FALLBACK_OFFERED
            record.active_layer = SOSLayer.LAYER_3_OS_HOOKS
            record.status_label = (
                "Connection Timed Out — Offline Fallback Active: "
                "Use native OS Call/SMS hooks for 1077/112 or Mesh store-and-forward"
            )
        else:
            # Successful ingestion into operational queue
            self._append_audit_log(
                sos_id=event_id,
                action="DELIVERED",
                from_state=SOSState.SENDING.value,
                to_state=SOSState.DELIVERED.value,
                from_failure_state=SOSFailureState.NONE.value,
                to_failure_state=SOSFailureState.NONE.value,
                reason="Distress packet delivered to NDMA operator review queue",
            )
            record.state = SOSState.DELIVERED
            record.failure_state = SOSFailureState.NONE
            record.active_layer = SOSLayer.LAYER_1_IP
            # STRICT SAFETY RULE: NEVER "Rescued", always queue confirmation
            record.status_label = self.DELIVERED_STATUS_LABEL

        record.updated_at = datetime.now(timezone.utc)

        # Store backward-compatible alert
        self._alerts[event_id] = SOSAlert(
            id=event_id,
            sender_id_hash=payload.sender_id_hash,
            location=payload.location,
            distress_type=payload.distress_type,
            urgency_level=payload.urgency_level,
            message=payload.message,
            timestamp=record.created_at,
            is_dispatched=False,
            honesty_label=HonestyLabel.SIMULATION,
            authority_notice=AUTHORITY_NOTICE,
        )

        return SOSResponse(
            event_id=record.id,
            state=record.state,
            failure_state=record.failure_state,
            is_dispatched=False,
            status_label=record.status_label,
            cascade_layers=record.cascade_layers,
            authority=AUTHORITY_NAME,
            disclaimer=AUTHORITY_NOTICE,
            emergency_notice=SOS_EMERGENCY_NOTICE,
            honesty_label=HonestyLabel.SIMULATION,
        )

    def get_sos(self, event_id: str) -> Optional[SOSStatusPollResponse]:
        """Poll the current lifecycle progress of an SOS distress signal."""
        record = self._records.get(event_id)
        if not record:
            return None

        return SOSStatusPollResponse(
            event_id=record.id,
            state=record.state,
            failure_state=record.failure_state,
            active_layer=record.active_layer,
            is_dispatched=False,
            status_label=record.status_label,
            location=record.location,
            distress_type=record.distress_type,
            urgency_level=record.urgency_level,
            cascade_layers=record.cascade_layers,
            audit_trail=record.audit_trail,
            created_at=record.created_at,
            updated_at=record.updated_at,
            authority=AUTHORITY_NAME,
            disclaimer=AUTHORITY_NOTICE,
            emergency_notice=SOS_EMERGENCY_NOTICE,
            honesty_label=HonestyLabel.SIMULATION,
        )

    def apply_operator_action(
        self, event_id: str, request: OperatorSOSActionRequest
    ) -> SOSRecord:
        """Apply operator triage action (acknowledge, assign, resolve, trigger_fallback)."""
        record = self._records.get(event_id)
        if not record:
            raise KeyError(f"SOS event '{event_id}' not found")

        prev_state = record.state
        prev_fail = record.failure_state
        action = request.action
        action_val = action.value if hasattr(action, "value") else str(action)
        op_id = request.operator_id
        reason = request.reason or f"Operator {op_id} action {action_val}"

        if action_val in (OperatorSOSActionType.ACKNOWLEDGE.value, "verify"):
            record.state = SOSState.ACKNOWLEDGED
            record.failure_state = SOSFailureState.NONE
            record.status_label = f"Signal Verified & Acknowledged by Operator {op_id} — Monitoring Situation"
        elif action_val in (OperatorSOSActionType.ASSIGN.value, "relay"):
            record.state = SOSState.ASSIGNED
            record.failure_state = SOSFailureState.NONE
            record.status_label = "Beacon Relayed to Assam SDMA / DDMA 1077 EOC"
        elif action_val == OperatorSOSActionType.RESOLVE.value:
            record.state = SOSState.RESOLVED
            record.failure_state = SOSFailureState.NONE
            record.status_label = "Distress Signal Closed and Marked Resolved by Operator"
        elif action_val == OperatorSOSActionType.TRIGGER_FALLBACK.value:
            record.failure_state = SOSFailureState.FALLBACK_OFFERED
            record.active_layer = SOSLayer.LAYER_3_OS_HOOKS
            record.status_label = "Operator Activated Offline Fallback Layer (OS Hooks & Mesh)"

        # Strictly ensure safety invariants
        record.is_dispatched = False
        record.updated_at = datetime.now(timezone.utc)

        self._append_audit_log(
            sos_id=event_id,
            action=action_val.upper(),
            from_state=prev_state.value,
            to_state=record.state.value,
            from_failure_state=prev_fail.value,
            to_failure_state=record.failure_state.value,
            operator_id=op_id,
            reason=reason,
        )

        return record

    def transition_offline_state(
        self, event_id: str, new_failure_state: SOSFailureState, reason: Optional[str] = None
    ) -> SOSRecord:
        """Advance failure/degraded states (e.g. queued_offline -> retry_pending -> delivered)."""
        record = self._records.get(event_id)
        if not record:
            raise KeyError(f"SOS event '{event_id}' not found")

        prev_state = record.state
        prev_fail = record.failure_state
        record.failure_state = new_failure_state

        if new_failure_state == SOSFailureState.QUEUED_OFFLINE:
            record.active_layer = SOSLayer.LAYER_2_MESH
            record.status_label = "Distress Signal Queued in Local Store-and-Forward Mesh"
        elif new_failure_state == SOSFailureState.RETRY_PENDING:
            record.status_label = "Network Connectivity Detected — Retry Pending"
        elif new_failure_state == SOSFailureState.NONE:
            record.state = SOSState.DELIVERED
            record.active_layer = SOSLayer.LAYER_1_IP
            record.status_label = self.DELIVERED_STATUS_LABEL

        record.is_dispatched = False
        record.updated_at = datetime.now(timezone.utc)

        self._append_audit_log(
            sos_id=event_id,
            action=f"TRANSITION_{new_failure_state.value.upper()}",
            from_state=prev_state.value,
            to_state=record.state.value,
            from_failure_state=prev_fail.value,
            to_failure_state=new_failure_state.value,
            reason=reason or f"State transitioned to {new_failure_state.value}",
        )

        return record

    def list_records(
        self, state: Optional[str] = None, failure_state: Optional[str] = None
    ) -> List[SOSRecord]:
        """List SOS records with optional state filtering."""
        results = list(self._records.values())
        if state:
            results = [r for r in results if r.state.value == state]
        if failure_state:
            results = [r for r in results if r.failure_state.value == failure_state]
        return results

    # Backward-compatible APIs for earlier modules & test suites
    def trigger_sos(
        self,
        sender_id_hash: str,
        location: GeoLocation,
        distress_type: str = "STRANDED_HAZARD",
        message: Optional[str] = None,
    ) -> SOSAlert:
        """Register an SOS alert backward-compatible with Module 1."""
        payload = SOSPayload(
            sender_id_hash=sender_id_hash,
            location=location,
            distress_type=distress_type,
            message=message,
            network_condition="online",
        )
        resp = self.ingest_sos(payload)
        return self._alerts[resp.event_id]

    def get_queued_alerts(self) -> List[SOSAlert]:
        """List active simulated alerts backward-compatible with Module 1."""
        return list(self._alerts.values())

    list_sos = list_records
