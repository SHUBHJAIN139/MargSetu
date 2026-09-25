'use client';

import React, { useState } from 'react';
import { 
  AlertTriangle, 
  CheckCircle2, 
  UserCheck, 
  XCircle, 
  CornerUpRight, 
  History, 
  Clock, 
  MapPin, 
  Layers, 
  ShieldAlert,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import HonestyBadge from '../common/HonestyBadge';

/**
 * IncidentsTab Component.
 * Operator triage interface for crowdsourced hazard clusters.
 * PRD Reference: PRD v2.0 §4, §8, §9 (Module 4).
 * Enforces audit logging for every operator action.
 */
export default function IncidentsTab({ 
  clusters = [], 
  onAction, 
  operatorId = 'NDMA-OPS-01',
  loading = false,
  onRefresh
}) {
  const [selectedClusterId, setSelectedClusterId] = useState(null);
  const [actionNotes, setActionNotes] = useState('');
  const [expandedClusterId, setExpandedClusterId] = useState(null);
  const [submittingAction, setSubmittingAction] = useState(false);

  const handleActionClick = async (clusterId, actionType) => {
    setSubmittingAction(true);
    try {
      await onAction(clusterId, {
        operator: operatorId,
        action: actionType,
        notes: actionNotes || `Operator applied ${actionType} at ${new Date().toLocaleTimeString()}`,
      });
      setActionNotes('');
    } finally {
      setSubmittingAction(false);
    }
  };

  const toggleExpand = (clusterId) => {
    setExpandedClusterId(prev => prev === clusterId ? null : clusterId);
  };

  return (
    <div className="space-y-4">
      {/* Header Info & Stats */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
        <div>
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <span>ACTIVE HAZARD CLUSTERS</span>
            <span className="bg-slate-800 text-sky-400 text-xs px-2 py-0.5 rounded font-mono">
              {clusters.length} Active
            </span>
          </h3>
          <p className="text-xs text-slate-400">
            500m Haversine spatial aggregation with automated compound corroboration
          </p>
        </div>
        <div className="flex items-center gap-2">
          <HonestyBadge label="USER-SUBMITTED" size="xs" />
        </div>
      </div>

      {/* Operator Badge Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-md p-2.5 flex items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-2 text-slate-300">
          <UserCheck className="w-3.5 h-3.5 text-sky-400" />
          <span>Active Operator Session:</span>
          <span className="text-sky-400 font-bold bg-sky-950/60 px-2 py-0.5 rounded border border-sky-500/30">
            {operatorId}
          </span>
        </div>
        <span className="text-[11px] text-slate-500">Every action strictly logged to audit trail</span>
      </div>

      {/* Clusters List */}
      {clusters.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-8 text-center text-slate-400">
          <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" />
          <p className="font-semibold text-slate-200">No Active Incident Clusters</p>
          <p className="text-xs text-slate-400 mt-1">All highway corridors operating with baseline clearance.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {clusters.map((cluster) => {
            const isExpanded = expandedClusterId === cluster.cluster_id;
            const isSonapur = cluster.centroid?.landmark_name?.includes('Sonapur') || cluster.cluster_id?.includes('sonapur');
            const isVerified = cluster.status === 'VERIFIED' || cluster.is_confirmed_blockage;
            const isCorroborated = cluster.status === 'CORROBORATED';

            return (
              <div 
                key={cluster.cluster_id}
                className={`rounded-lg border transition-all duration-200 ${
                  cluster.is_confirmed_blockage
                    ? 'bg-red-950/40 border-red-500/60 shadow-lg shadow-red-950/20'
                    : isCorroborated
                      ? 'bg-amber-950/30 border-amber-500/40'
                      : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Main Card Header */}
                <div className="p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <div className={`p-2 rounded mt-0.5 ${
                        cluster.is_confirmed_blockage 
                          ? 'bg-red-600/30 text-red-400 border border-red-500/40' 
                          : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      }`}>
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-bold text-slate-200">
                            {cluster.cluster_id}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                            {cluster.corridor_id || 'C1'}
                          </span>
                          {/* Corroboration Badge */}
                          {isVerified ? (
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-red-900/80 text-red-200 border border-red-600">
                              VERIFIED BLOCKAGE (3+ reports)
                            </span>
                          ) : isCorroborated ? (
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-900/80 text-amber-200 border border-amber-600">
                              CORROBORATED (2 reports)
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                              UNVERIFIED (1 report)
                            </span>
                          )}
                        </div>

                        <h4 className="text-sm font-bold text-white mt-1">
                          {cluster.incident_type ? cluster.incident_type.toUpperCase() : 'HAZARD REPORT'} — {cluster.centroid?.landmark_name || 'Highway Segment'}
                        </h4>
                        
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-slate-400 font-mono">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-sky-400" />
                            {cluster.centroid?.latitude?.toFixed(4)}°N, {cluster.centroid?.longitude?.toFixed(4)}°E
                          </span>
                          <span className="flex items-center gap-1">
                            <Layers className="w-3 h-3 text-amber-400" />
                            {cluster.report_count} citizen reports aggregated
                          </span>
                          {cluster.clearance_eta_hours && (
                            <span className="flex items-center gap-1 text-amber-300">
                              <Clock className="w-3 h-3" />
                              ETA: {cluster.clearance_eta_hours}h clearance
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <HonestyBadge label="USER-SUBMITTED" size="xs" />
                      <button
                        onClick={() => toggleExpand(cluster.cluster_id)}
                        className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-0.5 mt-1 font-mono"
                      >
                        {isExpanded ? (
                          <>Hide Details <ChevronUp className="w-3 h-3" /></>
                        ) : (
                          <>Actions &amp; Audit ({cluster.audit_log?.length || 0}) <ChevronDown className="w-3 h-3" /></>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Simplified Clean NDMA Operator Actions */}
                  <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {!isVerified ? (
                        <button
                          disabled={submittingAction}
                          onClick={() => handleActionClick(cluster.cluster_id, 'approve_detour')}
                          className="px-3.5 py-1.5 text-xs font-mono font-bold rounded-lg bg-red-600 text-white hover:bg-red-700 transition-transform active:scale-95 shadow-xs flex items-center gap-1.5"
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Verify Report (Hazard True — Divert to NH-27)</span>
                        </button>
                      ) : (
                        <div className="px-3 py-1 rounded-lg bg-red-950/80 border border-red-500/60 text-red-300 text-xs font-mono font-bold flex items-center gap-1.5">
                          <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                          <span>Hazard Verified by NDMA — Transit Diverted</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        disabled={submittingAction}
                        onClick={() => handleActionClick(cluster.cluster_id, 'resolve')}
                        className="px-3 py-1.5 text-xs font-mono font-bold rounded-lg bg-emerald-700 text-white hover:bg-emerald-600 transition-transform active:scale-95 shadow-xs flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Resolve &amp; Re-open</span>
                      </button>
                      <button
                        disabled={submittingAction}
                        onClick={() => handleActionClick(cluster.cluster_id, 'false_positive')}
                        className="px-2 py-1.5 text-xs font-mono text-slate-400 hover:text-red-400 transition-colors"
                        title="Dismiss as False Positive"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Details & Audit Log */}
                {isExpanded && (
                  <div className="px-3.5 pb-3.5 pt-2 border-t border-slate-800 bg-slate-950/60 rounded-b-lg space-y-3">
                    {/* Optional Note Input for Next Action */}
                    <div className="bg-slate-900 p-2.5 rounded border border-slate-800">
                      <label className="block text-[11px] font-mono text-slate-400 mb-1">
                        Operator Log Note (Optional reason attached to next action):
                      </label>
                      <input
                        type="text"
                        value={actionNotes}
                        onChange={(e) => setActionNotes(e.target.value)}
                        placeholder="e.g. Field sensor corroborates 82mm rainfall; reroute traffic via C2 Haflong"
                        className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500"
                      />
                    </div>

                    {/* Member Reports Preview */}
                    {cluster.reports && cluster.reports.length > 0 && (
                      <div>
                        <h5 className="text-xs font-mono font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                          <span>Aggregated Citizen Reports ({cluster.reports.length})</span>
                          <HonestyBadge label="USER-SUBMITTED" size="xs" />
                        </h5>
                        <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                          {cluster.reports.map((r, idx) => (
                            <div key={r.id || idx} className="bg-slate-900/80 rounded p-2 text-xs border border-slate-800">
                              <div className="flex items-center justify-between font-mono text-[10px] text-slate-400">
                                <span>Report ID: {r.id || `rep-${idx+1}`}</span>
                                <span>{new Date(r.timestamp).toLocaleTimeString()}</span>
                              </div>
                              <p className="text-slate-300 mt-1 text-xs">{r.description || 'Hazard blockage observed.'}</p>
                              {r.rainfall_mm && (
                                <div className="text-[10px] font-mono text-sky-400 mt-0.5">
                                  Rainfall reported: {r.rainfall_mm} mm
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Immutable Audit Log */}
                    <div>
                      <h5 className="text-xs font-mono font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                        <History className="w-3.5 h-3.5 text-sky-400" />
                        <span>Incident Audit Trail</span>
                        <HonestyBadge label="SIMULATION" size="xs" />
                      </h5>
                      <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                        {(!cluster.audit_log || cluster.audit_log.length === 0) ? (
                          <div className="text-xs text-slate-500 font-mono py-1">No prior operator actions logged.</div>
                        ) : (
                          cluster.audit_log.map((log, idx) => (
                            <div key={idx} className="bg-slate-900/90 rounded p-2 text-xs border border-slate-800 flex items-start gap-2">
                              <div className="w-2 h-2 rounded-full bg-sky-400 mt-1 shrink-0" />
                              <div className="flex-1 font-mono">
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="text-sky-300 font-semibold">{log.operator} ➔ {log.action}</span>
                                  <span className="text-slate-500 text-[10px]">{new Date(log.timestamp).toLocaleTimeString()}</span>
                                </div>
                                {log.notes && (
                                  <p className="text-slate-400 text-[11px] mt-0.5 font-sans">{log.notes}</p>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
