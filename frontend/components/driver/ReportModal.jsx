'use client';

import React, { useState } from 'react';
import {
  X,
  AlertTriangle,
  Droplets,
  Wrench,
  CheckCircle2,
  MapPin,
  Compass,
  Send,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { submitReport } from '../../lib/api';
import HonestyBadge from '../../lib/labels';

/**
 * ReportModal Component for Citizen / Driver Hazard Reporting.
 * PRD Reference: PRD v2.0 §0, §1, §4, §8, §11 (AC-2, AC-7, AC-9)
 * - Incident categories: landslide, waterlogging, road damage, clear
 * - Geolocated Sonapur shortcut (25.1147°N, 92.3654°E)
 * - Ingests to 500m Haversine clustering backend
 * - Labeled strictly as USER-SUBMITTED
 * - Touch targets >= 44px
 */
export default function ReportModal({
  isOpen = false,
  onClose = () => {},
  onReportSubmitted = () => {},
  defaultLocation = { latitude: 25.1147, longitude: 92.3654, landmark_name: 'Sonapur Tunnel' },
}) {
  const [incidentType, setIncidentType] = useState('landslide');
  const [severity, setSeverity] = useState('HIGH');
  const [isBlocked, setIsBlocked] = useState(true);
  const [location, setLocation] = useState(defaultLocation);
  const [description, setDescription] = useState('');
  const [rainfallMm, setRainfallMm] = useState(65.0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedCluster, setSubmittedCluster] = useState(null);
  const [geoLocating, setGeoLocating] = useState(false);
  const [geoMessage, setGeoMessage] = useState(null);

  if (!isOpen) return null;

  // Shortcut setter for Sonapur Tunnel Chokepoint
  const setSonapurShortcut = () => {
    setLocation({
      latitude: 25.1147,
      longitude: 92.3654,
      landmark_name: 'Sonapur Tunnel (NH-6)',
    });
    setGeoMessage('Coordinates set to Sonapur Tunnel North Portal');
    setTimeout(() => setGeoMessage(null), 2500);
  };

  const setKhliehriatShortcut = () => {
    setLocation({
      latitude: 25.3524,
      longitude: 92.3643,
      landmark_name: 'Khliehriat Slide Zone (NH-6)',
    });
    setGeoMessage('Coordinates set to Khliehriat Slide Zone');
    setTimeout(() => setGeoMessage(null), 2500);
  };

  const setHaflongShortcut = () => {
    setLocation({
      latitude: 25.1667,
      longitude: 93.0245,
      landmark_name: 'Haflong Hill Bypass (NH-27)',
    });
    setGeoMessage('Coordinates set to Haflong Bypass');
    setTimeout(() => setGeoMessage(null), 2500);
  };

  // Device GPS Location Hook
  const fetchCurrentLocation = () => {
    if (!navigator.geolocation) {
      setGeoMessage('Geolocation not supported on this browser');
      return;
    }
    setGeoLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          latitude: Number(pos.coords.latitude.toFixed(4)),
          longitude: Number(pos.coords.longitude.toFixed(4)),
          landmark_name: 'Live GPS Pin',
        });
        setGeoLocating(false);
        setGeoMessage('GPS location acquired');
        setTimeout(() => setGeoMessage(null), 2500);
      },
      (err) => {
        console.warn('GPS error:', err);
        setGeoLocating(false);
        setGeoMessage('Unable to retrieve GPS. Using default corridor pin.');
        setTimeout(() => setGeoMessage(null), 3000);
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await submitReport({
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy_m: 5.0,
          landmark_name: location.landmark_name,
        },
        hazard_type: incidentType.toUpperCase(),
        incident_type: incidentType.toLowerCase(),
        severity,
        description: description || `Hazard reported near ${location.landmark_name}`,
        notes: description || `Hazard reported near ${location.landmark_name}`,
        is_blocked: incidentType === 'clear' ? false : isBlocked,
        rainfall_mm_reported: rainfallMm,
      });

      setSubmittedCluster(response);
      if (onReportSubmitted) onReportSubmitted(response);

      // Auto close after showing optimistic confirmation
      setTimeout(() => {
        setIsSubmitting(false);
        setSubmittedCluster(null);
        onClose();
      }, 1800);
    } catch (err) {
      console.error('Submit report error:', err);
      setIsSubmitting(false);
    }
  };

  const hazardOptions = [
    {
      id: 'landslide',
      label: 'Landslide',
      subtext: 'Rockfall / mudflow',
      icon: AlertTriangle,
      activeClass: 'bg-red-600 text-white border-red-500 shadow-md',
      inactiveClass: 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700',
    },
    {
      id: 'waterlogging',
      label: 'Waterlogging',
      subtext: 'Flash flood / ponding',
      icon: Droplets,
      activeClass: 'bg-sky-600 text-white border-sky-500 shadow-md',
      inactiveClass: 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700',
    },
    {
      id: 'road_collapse',
      label: 'Road Damage',
      subtext: 'Subsidence / cave-in',
      icon: Wrench,
      activeClass: 'bg-amber-600 text-white border-amber-500 shadow-md',
      inactiveClass: 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700',
    },
    {
      id: 'clear',
      label: 'Road Clear',
      subtext: 'Corridor passable',
      icon: ShieldCheck,
      activeClass: 'bg-emerald-600 text-white border-emerald-500 shadow-md',
      inactiveClass: 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700',
    },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-modal-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="w-full max-w-md bg-slate-900 border-t-2 sm:border-2 border-slate-700 rounded-t-3xl sm:rounded-2xl p-4 shadow-2xl text-slate-100 flex flex-col gap-3.5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-2.5">
          <div>
            <div className="flex items-center gap-2">
              <h2 id="report-modal-title" className="text-base font-bold text-white">
                Report Highway Disruption
              </h2>
              <HonestyBadge label="USER-SUBMITTED" size="xs" />
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Citizen reports cluster into 500m corroboration zones
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-touch min-w-touch p-1 text-slate-400 hover:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400 flex items-center justify-center"
            aria-label="Close report modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success Confirmation Notification */}
        {submittedCluster ? (
          <div className="p-4 bg-emerald-950/90 border-2 border-emerald-500 rounded-2xl flex flex-col items-center justify-center text-center gap-2 animate-in zoom-in-95">
            <CheckCircle2 className="w-10 h-10 text-emerald-400" />
            <div className="text-sm font-bold text-emerald-200 uppercase tracking-wide">
              Report Submitted Successfully
            </div>
            <p className="text-xs text-emerald-100">
              {submittedCluster.action_taken === 'merged'
                ? `Merged into spatial cluster (${submittedCluster.cluster?.cluster_id || 'Corroborated'})`
                : 'Registered as new corridor incident cluster'}
            </p>
            <HonestyBadge label="USER-SUBMITTED" size="sm" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            {/* 1. Hazard Type Selector (>=44px touch targets) */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5 font-mono uppercase">
                Hazard Category
              </label>
              <div className="grid grid-cols-2 gap-2">
                {hazardOptions.map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = incidentType === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setIncidentType(opt.id)}
                      className={`min-h-touch p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all focus:outline-none focus:ring-2 focus:ring-sky-400 touch-manipulation ${
                        isSelected ? opt.activeClass : opt.inactiveClass
                      }`}
                    >
                      <Icon className="w-5 h-5 shrink-0" />
                      <div>
                        <div className="text-xs font-bold">{opt.label}</div>
                        <div className="text-[10px] opacity-80">{opt.subtext}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Geolocation & Sonapur Shortcut */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300 font-mono uppercase">
                  Incident Location
                </label>
                {geoMessage && (
                  <span className="text-[10px] font-mono text-emerald-400 animate-pulse">
                    {geoMessage}
                  </span>
                )}
              </div>

              {/* One-Tap Chokepoint Shortcuts */}
              <div className="flex flex-wrap gap-1.5 mb-2">
                <button
                  type="button"
                  onClick={setSonapurShortcut}
                  className="min-h-[36px] px-2.5 py-1 bg-red-950/80 hover:bg-red-900 border border-red-700/80 text-rose-200 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-red-400"
                >
                  <MapPin className="w-3.5 h-3.5 text-red-400" />
                  Sonapur Tunnel Shortcut (25.1147°N)
                </button>

                <button
                  type="button"
                  onClick={setKhliehriatShortcut}
                  className="min-h-[36px] px-2 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg text-[11px] font-medium flex items-center gap-1 focus:outline-none"
                >
                  Khliehriat
                </button>

                <button
                  type="button"
                  onClick={setHaflongShortcut}
                  className="min-h-[36px] px-2 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg text-[11px] font-medium flex items-center gap-1 focus:outline-none"
                >
                  Haflong
                </button>
              </div>

              {/* Coordinates Display + GPS Acquire */}
              <div className="flex items-center gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <div className="flex-1">
                  <div className="text-[10px] font-mono text-slate-400">
                    {location.landmark_name}
                  </div>
                  <div className="text-xs font-mono font-bold text-slate-200">
                    {location.latitude.toFixed(4)}°N, {location.longitude.toFixed(4)}°E
                  </div>
                </div>
                <button
                  type="button"
                  onClick={fetchCurrentLocation}
                  disabled={geoLocating}
                  className="min-h-touch min-w-touch px-3 py-1.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 border border-slate-700 rounded-lg text-xs font-semibold text-sky-400 flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-sky-400 disabled:opacity-50"
                  title="Acquire live GPS"
                >
                  <Compass className={`w-4 h-4 ${geoLocating ? 'animate-spin' : ''}`} />
                  GPS
                </button>
              </div>
            </div>

            {/* 3. Road Passability Toggle */}
            {incidentType !== 'clear' && (
              <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                <div>
                  <div className="text-xs font-semibold text-slate-200">
                    Road Impassable / Blocked?
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Triggers corridor hard veto upon corroboration
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isBlocked}
                  onClick={() => setIsBlocked(!isBlocked)}
                  className={`min-h-touch min-w-[56px] px-2.5 py-1.5 rounded-full font-mono text-xs font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-sky-400 ${
                    isBlocked
                      ? 'bg-red-600 text-white'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  {isBlocked ? 'YES' : 'NO'}
                </button>
              </div>
            )}

            {/* 4. Optional Description */}
            <div>
              <label
                htmlFor="hazard-description"
                className="text-xs font-semibold text-slate-300 block mb-1 font-mono uppercase"
              >
                Observations / Details (Optional)
              </label>
              <input
                id="hazard-description"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Mudflow 200m before tunnel north portal"
                className="w-full min-h-touch px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-400"
              />
            </div>

            {/* Dual Mandatory Disclaimer */}
            <div className="p-2 bg-slate-950/60 rounded-xl border border-slate-800/80 text-[10px] text-slate-400 text-center font-sans space-y-0.5">
              <p className="font-semibold text-rose-400">
                MargSetu is not a replacement for official emergency services.
              </p>
              <p className="text-slate-500">
                Reports are ingested into NDMA simulation database.
              </p>
            </div>

            {/* Submit Button (>=44px touch target) */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full min-h-touch py-3 px-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-sm font-bold tracking-wide uppercase rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-white disabled:opacity-50 touch-manipulation"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Submitting Report...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Submit Citizen Hazard Report
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
