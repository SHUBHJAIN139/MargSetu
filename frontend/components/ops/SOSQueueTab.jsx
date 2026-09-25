'use client';

import React, { useState } from 'react';
import { 
  AlertCircle, 
  CheckCircle2, 
  ShieldAlert, 
  UserCheck, 
  Radio, 
  PhoneCall, 
  Wifi, 
  Activity, 
  Clock, 
  MapPin, 
  Truck,
  HeartPulse
} from 'lucide-react';
import HonestyBadge from '../common/HonestyBadge';

/**
 * SOSQueueTab Component.
 * Real-time emergency distress queue with 4-layer cascade visibility.
 * STRICT COPY SAFETY: "delivered" is "Signal Delivered to Queue - Awaiting Operator Review".
 * Forbidden term "rescued" is NEVER displayed.
 * Disclaimers enforced on all triage cards.
 */
export default function SOSQueueTab({ 
  records = [], 
  onAction, 
  operatorId = 'NDMA-OPS-01',
  loading = false 
}) {
  const [actionNotes, setActionNotes] = useState('');
  const [selectedRecordId, setSelectedRecordId] = useState(null);
  const [submittingAction, setSubmittingAction] = useState(false);

  const handleAction = async (sosId, actionType) => {
    setSubmittingAction(true);
    try {
      await onAction(sosId, {
        operator: operatorId,
        action: actionType,
        notes: actionNotes || `Operator marked ${actionType} at ${new Date().toLocaleTimeString()}`,
      });
      setActionNotes('');
      setSelectedRecordId(null);
    } finally {
      setSubmittingAction(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Info */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
        <div>
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <span>EMERGENCY SOS DISTRESS QUEUE</span>
            <span className="bg-red-950 text-red-300 border border-red-800 text-xs px-2 py-0.5 rounded font-mono">
              {records.length} Pending Triage
            </span>
          </h3>
          <p className="text-xs text-slate-400">
            4-layer fallback cascade (IP Direct ➔ Mesh ➔ Telephony ➔ Evacuation Simulation)
          </p>
        </div>
        <HonestyBadge label="SIMULATION" size="xs" />
      </div>

      {/* Mandatory Safety Notice */}
      <div className="bg-amber-950/60 border border-amber-600/50 rounded-md p-2.5 text-xs text-amber-200">
        <div className="flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-bold text-amber-300">
              OPERATIONAL COPY SAFETY INVARIANT
            </p>
            <p className="text-[11px] text-amber-200/90 font-mono">
              Status &quot;delivered&quot; indicates distress signal reached operator queue. 
              Live rescue dispatch is strictly NOT active. MargSetu is not a replacement for official emergency services.
            </p>
          </div>
        </div>
      </div>

      {/* SOS Records List */}
      {records.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-8 text-center text-slate-400">
          <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" />
          <p className="font-semibold text-slate-200">No Pending SOS Signals</p>
          <p className="text-xs text-slate-400 mt-1">All corridor emergency distress beacons are currently resolved.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {records.map((sos) => {
            const isDelivered = sos.state === 'delivered';
            const isAcknowledged = sos.state === 'acknowledged';
            const isAssigned = sos.state === 'assigned';
            const isResolved = sos.state === 'resolved';

            // Safe human readable status (strictly no "rescued")
            const displayStatus = isDelivered 
              ? 'Signal Delivered to Queue - Awaiting Operator Review'
              : (isAcknowledged ? 'Operator Acknowledged' : (isAssigned ? 'Response Assigned' : (isResolved ? 'Resolved' : sos.state)));

            return (
              <div 
                key={sos.id} 
                className={`rounded-lg border transition-all ${
                  isResolved 
                    ? 'bg-slate-900/50 border-slate-800' 
                    : 'bg-red-950/30 border-red-500/50 shadow-md shadow-red-950/20'
                }`}
              >
                <div className="p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <div className="p-2 rounded bg-red-600/30 text-red-400 border border-red-500/40 mt-0.5 animate-pulse">
                        <HeartPulse className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-bold text-white">
                            {sos.id}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-red-900/80 text-red-200 border border-red-600 font-bold">
                            PRIORITY: {sos.medical_priority || 'HIGH'}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                            {sos.vehicle_type ? sos.vehicle_type.replace('_', ' ').toUpperCase() : 'COMMERCIAL'}
                          </span>
                          {sos.occupants_count && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                              {sos.occupants_count} Occupants
                            </span>
                          )}
                        </div>

                        {/* Location Details */}
                        <div className="mt-1.5">
                          <h4 className="text-sm font-bold text-slate-100">
                            {sos.location?.landmark_name || 'Corridor Distress Beacon'}
                          </h4>
                          <div className="flex items-center gap-3 text-xs text-slate-400 font-mono mt-0.5">
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-sky-400" />
                              {sos.location?.latitude?.toFixed(4)}°N, {sos.location?.longitude?.toFixed(4)}°E
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-slate-400" />
                              {new Date(sos.created_at || Date.now()).toLocaleTimeString()}
                            </span>
                          </div>
                        </div>

                        {/* Safe Status Badge */}
                        <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-xs font-mono">
                          <Activity className="w-3.5 h-3.5 text-amber-400" />
                          <span className="text-amber-300 font-semibold">{displayStatus}</span>
                        </div>
                      </div>
                    </div>

                    <HonestyBadge label="SIMULATION" size="xs" />
                  </div>

                  {/* 4-Layer Fallback Cascade Indicators */}
                  <div className="mt-3 pt-3 border-t border-slate-800/80">
                    <div className="text-[11px] font-mono text-slate-400 mb-1.5 flex items-center justify-between">
                      <span>4-LAYER CASCADE PROTOCOL STATUS:</span>
                      <span className="text-slate-500">Auto-Escalation Active</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-xs font-mono">
                      {/* Layer 1 */}
                      <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800 flex items-center gap-1.5">
                        <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                        <div>
                          <div className="text-[10px] text-slate-400">L1 IP Direct</div>
                          <div className="text-emerald-400 font-bold text-[11px]">DELIVERED</div>
                        </div>
                      </div>

                      {/* Layer 2 */}
                      <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800 flex items-center gap-1.5">
                        <Radio className="w-3.5 h-3.5 text-slate-500" />
                        <div>
                          <div className="text-[10px] text-slate-400">L2 Mesh Relay</div>
                          <div className="text-slate-500 text-[11px]">STANDBY</div>
                        </div>
                      </div>

                      {/* Layer 3 */}
                      <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800 flex items-center gap-1.5">
                        <PhoneCall className="w-3.5 h-3.5 text-sky-400" />
                        <div>
                          <div className="text-[10px] text-slate-400">L3 Telephony</div>
                          <div className="text-sky-300 text-[11px]">112 / 1077</div>
                        </div>
                      </div>

                      {/* Layer 4 */}
                      <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800 flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5 text-purple-400" />
                        <div>
                          <div className="text-[10px] text-slate-400">L4 Physical</div>
                          <div className="text-purple-300 text-[11px]">SIMULATED</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Operator Actions & Triage */}
                  <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {!isAcknowledged && !isAssigned && !isResolved && (
                        <button
                          disabled={submittingAction}
                          onClick={() => handleAction(sos.id, 'acknowledge')}
                          className="px-3 py-1 text-xs font-mono font-bold rounded bg-sky-950 text-sky-300 border border-sky-600/50 hover:bg-sky-900/80 transition-colors"
                        >
                          Acknowledge Distress
                        </button>
                      )}
                      {!isAssigned && !isResolved && (
                        <button
                          disabled={submittingAction}
                          onClick={() => handleAction(sos.id, 'assign')}
                          className="px-3 py-1 text-xs font-mono font-bold rounded bg-indigo-950 text-indigo-300 border border-indigo-600/50 hover:bg-indigo-900/80 transition-colors"
                        >
                          Assign Triage Unit
                        </button>
                      )}
                      {!isResolved && (
                        <button
                          disabled={submittingAction}
                          onClick={() => handleAction(sos.id, 'resolve')}
                          className="px-3 py-1 text-xs font-mono font-bold rounded bg-emerald-950 text-emerald-300 border border-emerald-600/50 hover:bg-emerald-900/80 transition-colors flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          Mark Resolved
                        </button>
                      )}
                    </div>

                    <div className="text-[11px] font-mono text-slate-500">
                      Live dispatch: <span className="text-red-400 font-bold">FALSE (Simulation)</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
