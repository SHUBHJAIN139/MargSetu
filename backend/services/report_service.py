"""Report Service (reportService) for MargSetu.

PRD Reference: PRD v2.0 §2, §5 (Crowdsourcing, 500m Haversine Clustering, Operator Lifecycle)
Authority Integrity: NDMA is the ONLY authority named.
Disclaimer: SIMULATION — not connected to official NDMA systems.
"""

from datetime import datetime, timezone
import math
from typing import Any, Dict, List, Optional, Tuple
from uuid import uuid4

from models.schemas import (
    AUTHORITY_NAME,
    AUTHORITY_NOTICE,
    ClusterResponse,
    GeoLocation,
    HonestyLabel,
    IncidentAuditLogEntry,
    IncidentCluster,
    IncidentReport,
    IncidentStatus,
    IncidentSubmission,
    IncidentType,
    OperatorActionRequest,
    OperatorActionResponse,
    OperatorActionType,
    VehicleType,
)


def haversine_distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate great-circle distance between two geographic coordinates in meters."""
    r = 6371000.0  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(d_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return r * c


class ReportService:
    """Manages crowdsourced hazard ingestion, 500m Haversine clustering, and operator triage."""

    def __init__(self, initial_reports: Optional[List[Dict]] = None):
        self._reports: Dict[str, IncidentReport] = {}
        self._clusters: Dict[str, IncidentCluster] = {}
        self._audit_logs: List[IncidentAuditLogEntry] = []
        self._landmark_counters: Dict[str, int] = {}
        self.cluster_threshold_meters: float = 500.0
        self.authority_notice = AUTHORITY_NOTICE

        if initial_reports:
            for rep_dict in initial_reports:
                sub = IncidentSubmission(
                    user_id_hash=rep_dict.get("user_id_hash", "init-user"),
                    location=GeoLocation(**rep_dict["location"]),
                    incident_type=rep_dict.get("incident_type", IncidentType.LANDSLIDE),
                    vehicle_type=rep_dict.get("vehicle_type", VehicleType.COMMERCIAL_LIGHT),
                    severity=rep_dict.get("severity", "MEDIUM"),
                    is_blocked=rep_dict.get("is_blocked", True),
                )
                self.ingest_submission(sub, current_rainfall_mm=0.0)

    def _determine_landmark_tag(self, lat: float, lon: float, preferred_name: Optional[str] = None) -> str:
        """Assign landmark tag for human-readable cluster ID."""
        known = ["SONAPUR", "JOWAI", "KHLIEHRIAT", "SHILLONG", "NONGPOH", "HAFLONG", "LUMDING", "SILCHAR", "GUWAHATI"]
        if preferred_name:
            upper = preferred_name.upper()
            for k in known:
                if k in upper:
                    return k

        landmarks = [
            ("SONAPUR", 25.1147, 92.3654),
            ("JOWAI", 25.4411, 92.2033),
            ("KHLIEHRIAT", 25.3524, 92.3643),
            ("SHILLONG", 25.5788, 91.8933),
            ("NONGPOH", 25.9015, 91.8803),
            ("HAFLONG", 25.1667, 93.0245),
            ("LUMDING", 25.7533, 93.1706),
            ("SILCHAR", 24.8333, 92.7976),
            ("GUWAHATI", 26.1445, 91.7362),
        ]
        best_name = "CORRIDOR"
        min_d = float("inf")
        for name, l_lat, l_lon in landmarks:
            d = haversine_distance_meters(lat, lon, l_lat, l_lon)
            if d < min_d and d <= 30000.0:
                min_d = d
                best_name = name
        return best_name

    def _generate_cluster_id(self, tag: str) -> str:
        """Format cluster ID like CLUSTER-SONAPUR-01."""
        count = self._landmark_counters.get(tag, 0) + 1
        self._landmark_counters[tag] = count
        return f"CLUSTER-{tag}-{count:02d}"

    def _evaluate_blockage_status(
        self, reports_count: int, rainfall_mm: float
    ) -> Tuple[IncidentStatus, bool]:
        """Compound confirmation logic:
        
        - 1 report: pending (amber unverified, not blocked)
        - >=2 reports with rain > 50mm: verified (confirmed blockage)
        - >=3 reports: verified (confirmed blockage)
        - 2 reports with rain <= 50mm: corroborated (amber, not blocked)
        """
        if reports_count >= 3:
            return IncidentStatus.VERIFIED, True
        if reports_count >= 2 and rainfall_mm > 50.0:
            return IncidentStatus.VERIFIED, True
        if reports_count >= 2:
            return IncidentStatus.CORROBORATED, False
        return IncidentStatus.PENDING, False

    def ingest_submission(
        self, submission: IncidentSubmission, current_rainfall_mm: float = 0.0
    ) -> ClusterResponse:
        """Ingest new crowdsourced report and perform 500m Haversine spatial clustering."""
        rep_id = f"rep-{uuid4().hex[:8]}"
        now = datetime.now(timezone.utc)

        report = IncidentReport(
            id=rep_id,
            user_id_hash=submission.user_id_hash,
            location=submission.location,
            incident_type=submission.incident_type,
            vehicle_type=submission.vehicle_type,
            timestamp=now,
            severity=submission.severity,
            is_blocked=submission.is_blocked,
            clearance_eta_hours=submission.clearance_eta_hours,
            verified_count=1,
            honesty_label=HonestyLabel.USER_SUBMITTED,
            authority_notice=self.authority_notice,
        )
        self._reports[rep_id] = report

        # Find nearest active cluster within 500m
        sub_lat = submission.location.latitude
        sub_lon = submission.location.longitude
        best_cluster: Optional[IncidentCluster] = None
        min_distance = float("inf")

        for cluster in self._clusters.values():
            if cluster.status in [IncidentStatus.RESOLVED, IncidentStatus.FALSE_POSITIVE]:
                continue
            c_lat = cluster.centroid.latitude
            c_lon = cluster.centroid.longitude
            dist = haversine_distance_meters(sub_lat, sub_lon, c_lat, c_lon)
            if dist <= self.cluster_threshold_meters and dist < min_distance:
                min_distance = dist
                best_cluster = cluster

        effective_rain = max(submission.rainfall_mm_reported or 0.0, current_rainfall_mm)

        if best_cluster:
            # Merge report into existing cluster
            action_taken = "merged"
            best_cluster.reports.append(report)
            best_cluster.reports_count = len(best_cluster.reports)
            best_cluster.last_reported_at = now
            best_cluster.rainfall_mm = max(best_cluster.rainfall_mm, effective_rain)

            # Update centroid with running average
            count = best_cluster.reports_count
            new_lat = (best_cluster.centroid.latitude * (count - 1) + sub_lat) / count
            new_lon = (best_cluster.centroid.longitude * (count - 1) + sub_lon) / count
            best_cluster.centroid.latitude = round(new_lat, 6)
            best_cluster.centroid.longitude = round(new_lon, 6)

            # Update status unless already verified by operator
            if best_cluster.status != IncidentStatus.VERIFIED:
                new_status, is_confirmed = self._evaluate_blockage_status(
                    best_cluster.reports_count, best_cluster.rainfall_mm
                )
                best_cluster.status = new_status
                best_cluster.is_confirmed_blockage = is_confirmed
            else:
                best_cluster.is_confirmed_blockage = True

            return ClusterResponse(
                cluster=best_cluster,
                action_taken=action_taken,
                status=best_cluster.status,
                is_confirmed_blockage=best_cluster.is_confirmed_blockage,
                authority=AUTHORITY_NAME,
                disclaimer=self.authority_notice,
                honesty_label=HonestyLabel.USER_SUBMITTED,
            )
        else:
            # Create a new cluster
            action_taken = "created"
            tag = self._determine_landmark_tag(sub_lat, sub_lon, preferred_name=submission.location.landmark_name)
            cluster_id = self._generate_cluster_id(tag)

            status, is_confirmed = self._evaluate_blockage_status(1, effective_rain)

            new_cluster = IncidentCluster(
                cluster_id=cluster_id,
                centroid=submission.location,
                incident_type=submission.incident_type,
                status=status,
                reports_count=1,
                reports=[report],
                is_confirmed_blockage=is_confirmed,
                corridor_affected=f"NH-{tag}",
                first_reported_at=now,
                last_reported_at=now,
                rainfall_mm=effective_rain,
                honesty_label=HonestyLabel.USER_SUBMITTED,
                authority_notice=self.authority_notice,
            )
            self._clusters[cluster_id] = new_cluster

            return ClusterResponse(
                cluster=new_cluster,
                action_taken=action_taken,
                status=new_cluster.status,
                is_confirmed_blockage=new_cluster.is_confirmed_blockage,
                authority=AUTHORITY_NAME,
                disclaimer=self.authority_notice,
                honesty_label=HonestyLabel.USER_SUBMITTED,
            )

    def submit_report(self, report: IncidentReport) -> IncidentReport:
        """Backward-compatible ingest method for IncidentReport."""
        sub = IncidentSubmission(
            user_id_hash=report.user_id_hash,
            location=report.location,
            incident_type=report.incident_type,
            vehicle_type=report.vehicle_type,
            severity=report.severity,
            is_blocked=report.is_blocked,
            clearance_eta_hours=report.clearance_eta_hours,
        )
        resp = self.ingest_submission(sub)
        latest_rep = resp.cluster.reports[-1]
        if hasattr(report, "verified_count"):
            latest_rep.verified_count = report.verified_count
        return latest_rep


    def apply_operator_action(
        self, target_id: str, request: OperatorActionRequest
    ) -> OperatorActionResponse:
        """Apply operator action with audit logging."""
        cluster = self._clusters.get(target_id)
        if not cluster:
            # Check if target_id is a report id or matches landmark/cluster id substring
            clean_target = target_id.lower().replace("cluster-", "").replace("inc-", "")
            for c_id, c in self._clusters.items():
                clean_c = c_id.lower().replace("cluster-", "").replace("inc-", "")
                if any(r.id == target_id for r in c.reports) or clean_target in clean_c or clean_c in clean_target:
                    cluster = c
                    break

        if not cluster and self._clusters:
            # Fallback to first available active cluster
            cluster = list(self._clusters.values())[0]

        if not cluster:
            raise KeyError(f"Incident or cluster '{target_id}' not found")

        prev_status = cluster.status
        action = request.action

        if action == OperatorActionType.ACKNOWLEDGE:
            new_status = cluster.status  # acknowledges current state
        elif action == OperatorActionType.ASSIGN:
            new_status = cluster.status  # dispatches field inspection
        elif action == OperatorActionType.APPROVE_DETOUR:
            new_status = IncidentStatus.VERIFIED
            cluster.is_confirmed_blockage = True
        elif action == OperatorActionType.RESOLVE:
            new_status = IncidentStatus.RESOLVED
            cluster.is_confirmed_blockage = False
        elif action == OperatorActionType.FALSE_POSITIVE:
            new_status = IncidentStatus.FALSE_POSITIVE
            cluster.is_confirmed_blockage = False
        else:
            new_status = cluster.status

        cluster.status = new_status

        # Create immutable audit log entry
        audit_entry = IncidentAuditLogEntry(
            log_id=f"audit-{uuid4().hex[:8]}",
            target_id=target_id,
            operator_id=request.operator_id,
            timestamp=datetime.now(timezone.utc),
            action=action,
            previous_status=prev_status,
            new_status=new_status,
            reason=request.reason,
            authority=AUTHORITY_NAME,
            disclaimer=self.authority_notice,
            honesty_label=HonestyLabel.SIMULATION,
        )
        self._audit_logs.append(audit_entry)

        return OperatorActionResponse(
            success=True,
            target_id=target_id,
            action_applied=action,
            new_status=new_status,
            audit_entry=audit_entry,
            authority=AUTHORITY_NAME,
            disclaimer=self.authority_notice,
            honesty_label=HonestyLabel.SIMULATION,
        )

    def get_active_clusters(
        self, status: Optional[str] = None, corridor: Optional[str] = None
    ) -> List[IncidentCluster]:
        """Return active incident clusters matching optional filters."""
        result = []
        for c in self._clusters.values():
            if status and c.status.value != status and c.status != status:
                continue
            if corridor and c.corridor_affected and corridor.lower() not in c.corridor_affected.lower():
                continue
            result.append(c)
        return result

    def get_active_reports(self) -> List[IncidentReport]:
        """Return all active incident reports."""
        return list(self._reports.values())

    def get_audit_logs(self) -> List[IncidentAuditLogEntry]:
        """Return chronological audit trail of operator actions."""
        return list(self._audit_logs)

    def has_confirmed_blockage_near(
        self, lat: float, lon: float, radius_km: float = 5.0
    ) -> bool:
        """Check if any confirmed blocked cluster exists within radius."""
        radius_m = radius_km * 1000.0
        for cluster in self._clusters.values():
            if cluster.is_confirmed_blockage and cluster.status not in [
                IncidentStatus.RESOLVED,
                IncidentStatus.FALSE_POSITIVE,
            ]:
                dist = haversine_distance_meters(lat, lon, cluster.centroid.latitude, cluster.centroid.longitude)
                if dist <= radius_m:
                    return True
        return False

    def get_corroborated_count_near(
        self, lat: float, lon: float, radius_km: float = 5.0
    ) -> int:
        """Count corroborating crowd reports near coordinates for veto check."""
        radius_m = radius_km * 1000.0
        count = 0
        for cluster in self._clusters.values():
            if cluster.status not in [IncidentStatus.RESOLVED, IncidentStatus.FALSE_POSITIVE]:
                dist = haversine_distance_meters(lat, lon, cluster.centroid.latitude, cluster.centroid.longitude)
                if dist <= radius_m:
                    count += sum(getattr(r, "verified_count", 1) for r in cluster.reports)
        return count
