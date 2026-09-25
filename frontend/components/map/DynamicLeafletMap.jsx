'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Locate, AlertTriangle, ShieldCheck, Layers, MapPin } from 'lucide-react';
import { HonestyBadge } from '../../lib/labels';
import { TOKENS } from '../../lib/tokens';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';
const CARTO_API_KEY = process.env.NEXT_PUBLIC_CARTO_KEY || '';

/**
 * SSR-safe client Leaflet map component for MargSetu.
 * Spec Reference: DESIGN.md (FINAL v2) §1 & §3 & SIH 2026 Map Enhancements
 * - CartoDB Positron Light Tiles (Default) + Mapbox Outdoors (Terrain) + Mapbox Streets
 * - 6px dual-encoded highway polylines (C1 Sonapur, C2 Haflong, C3 West)
 * - Dynamic flyTo navigation from LocationSearchBar
 * - Interactive layer toggle
 */
export default function DynamicLeafletMap({
  activeRouteId = 'C1',
  isSonapurBlocked = false,
  isHaflongBlocked = false,
  driverLocation = { latitude: 25.1147, longitude: 92.3654, landmark_name: 'Sonapur Sector' },
  targetLocation = null, // External search selection { lat, lng, name }
  riskScore = 2.40,
  honestyLabel = 'VERIFIED STATIC',
  height = '240px',
  showLegend = true,
  onCorridorSelect = null,
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layersGroupRef = useRef(null);
  const tileLayerRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const [activeTileType, setActiveTileType] = useState('outdoors'); // 'outdoors' | 'light' | 'osm'
  const [showLayerMenu, setShowLayerMenu] = useState(false);

  // Corridor 1: NH-6 Guwahati-Silchar via Sonapur Tunnel
  const C1_COORDINATES = [
    [26.1445, 91.7362], // Guwahati
    [26.0821, 91.7820],
    [25.9015, 91.8803], // Nongpoh
    [25.7532, 91.8741],
    [25.5788, 91.8933], // Shillong
    [25.5012, 92.0124],
    [25.4411, 92.2033], // Jowai
    [25.3910, 92.3112],
    [25.3524, 92.3643], // Khliehriat
    [25.1147, 92.3654], // Sonapur Tunnel Chokepoint
    [25.0124, 92.4215],
    [24.9541, 92.5110],
    [24.8966, 92.5768], // Badarpur
    [24.8510, 92.6841],
    [24.8333, 92.7976], // Silchar
  ];

  // Corridor 2: NH-27 Detour via Haflong Bypass
  const C2_COORDINATES = [
    [26.1445, 91.7362], // Guwahati
    [26.1320, 91.9542],
    [26.1264, 92.2133], // Jagiroad
    [26.2150, 92.4512],
    [26.3452, 92.6841], // Nagaon
    [26.1820, 92.7812],
    [26.0121, 92.8687], // Dabaka
    [25.8752, 93.0415],
    [25.7533, 93.1706], // Lumding
    [25.5210, 93.1845],
    [25.3015, 93.1610], // Maibang
    [25.1667, 93.0245], // Haflong Bypass
    [25.0120, 92.8950],
    [24.8333, 92.7976], // Silchar
  ];

  // Corridor 3: NH-27 West Reference / Evacuation Staging
  const C3_COORDINATES = [
    [26.7271, 88.3953], // Siliguri
    [26.5400, 89.0100],
    [26.3200, 89.4500], // Cooch Behar
    [26.1800, 89.9800], // Dhubri/Bilasipara
    [26.1500, 90.6200], // Goalpara
    [26.1445, 91.7362], // Guwahati West
  ];

  const CHOKEPOINTS = [
    {
      id: 'CP-SONAPUR',
      name: 'Sonapur Tunnel (NH-6)',
      coords: [25.1147, 92.3654],
      isBlocked: isSonapurBlocked,
      desc: isSonapurBlocked ? 'Active Landslide Obstruction' : 'Operational Vulnerability Monitoring',
    },
    {
      id: 'CP-HAFLONG',
      name: 'Haflong Bypass (NH-27)',
      coords: [25.1667, 93.0245],
      isBlocked: isHaflongBlocked,
      desc: isHaflongBlocked ? 'Landslide Blockage Injected' : 'Resilient Elevated Corridor',
    },
  ];

  // Initialize Map
  useEffect(() => {
    let isSubscribed = true;

    async function initMap() {
      if (typeof window === 'undefined' || !mapContainerRef.current) return;

      const L = (await import('leaflet')).default;

      if (!isSubscribed || mapInstanceRef.current) return;

      const map = L.map(mapContainerRef.current, {
        center: [25.5, 92.4],
        zoom: 8,
        zoomControl: false,
        attributionControl: false,
      });

      // Default Basemap: Mapbox Outdoors if token provided, otherwise Carto Voyager
      const tileUrl = MAPBOX_TOKEN
        ? `https://api.mapbox.com/styles/v1/mapbox/outdoors-v12/tiles/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`
        : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

      const defaultTile = L.tileLayer(tileUrl, {
        tileSize: MAPBOX_TOKEN ? 512 : 256,
        zoomOffset: MAPBOX_TOKEN ? -1 : 0,
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      }).addTo(map);

      tileLayerRef.current = defaultTile;
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      const layersGroup = L.featureGroup().addTo(map);
      layersGroupRef.current = layersGroup;
      mapInstanceRef.current = map;

      if (isSubscribed) {
        setMapReady(true);
      }
    }

    initMap();

    return () => {
      isSubscribed = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Handle Tile Layer Switching (Mapbox Outdoors vs Mapbox Light vs OSM Standard)
  const switchTileLayer = async (type) => {
    if (!mapInstanceRef.current || typeof window === 'undefined') return;
    const L = (await import('leaflet')).default;

    if (tileLayerRef.current) {
      mapInstanceRef.current.removeLayer(tileLayerRef.current);
    }

    let newLayer;
    if (type === 'light') {
      newLayer = L.tileLayer(
        MAPBOX_TOKEN
          ? `https://api.mapbox.com/styles/v1/mapbox/light-v11/tiles/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`
          : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
        {
          tileSize: MAPBOX_TOKEN ? 512 : 256,
          zoomOffset: MAPBOX_TOKEN ? -1 : 0,
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap &copy; CARTO',
        }
      );
    } else if (type === 'osm') {
      newLayer = L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        {
          tileSize: 256,
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors',
        }
      );
    } else {
      // Default: Mapbox Outdoors (Topographical Relief) or Carto Voyager
      newLayer = L.tileLayer(
        MAPBOX_TOKEN
          ? `https://api.mapbox.com/styles/v1/mapbox/outdoors-v12/tiles/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`
          : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        {
          tileSize: MAPBOX_TOKEN ? 512 : 256,
          zoomOffset: MAPBOX_TOKEN ? -1 : 0,
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap &copy; CARTO',
        }
      );
    }

    newLayer.addTo(mapInstanceRef.current);
    tileLayerRef.current = newLayer;
    setActiveTileType(type);
    setShowLayerMenu(false);
  };

  // Fly to Searched Location
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !targetLocation) return;
    const { lat, lng } = targetLocation;
    if (lat && lng) {
      mapInstanceRef.current.flyTo([lat, lng], 11, {
        animate: true,
        duration: 1.2,
      });
    }
  }, [mapReady, targetLocation]);

  // Update polylines and markers
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || typeof window === 'undefined') return;

    const L = window.L || require('leaflet');
    const group = layersGroupRef.current;
    if (!group) return;

    group.clearLayers();

    // 1. C3 Polyline (Dashed grey reference)
    L.polyline(C3_COORDINATES, {
      color: '#6B7280',
      weight: 3,
      opacity: 0.65,
      dashArray: '5, 5',
    })
      .bindPopup('<b>C3 NH-27 West Reference</b><br/>Siliguri to Guwahati Lifeline')
      .addTo(group);

    // 2. C1 Polyline (NH-6 Guwahati-Silchar)
    const c1Color = isSonapurBlocked ? TOKENS.blocked : (activeRouteId === 'C1' ? TOKENS.brand : TOKENS.caution);
    const c1Dash = isSonapurBlocked ? '8, 8' : undefined;

    const c1Line = L.polyline(C1_COORDINATES, {
      color: c1Color,
      weight: 6, // 6px polyline per spec
      opacity: isSonapurBlocked ? 0.9 : 0.85,
      dashArray: c1Dash,
    })
      .bindPopup(
        `<b>C1 NH-6 Guwahati-Silchar (320 km)</b><br/>${
          isSonapurBlocked
            ? '<span style="color:#8B1A1A;font-weight:bold;">BLOCKED — Landslide Structural Veto</span>'
            : `<span>Risk Score: ${Number(riskScore).toFixed(2)}/10</span>`
        }`
      )
      .addTo(group);

    if (onCorridorSelect) {
      c1Line.on('click', () => onCorridorSelect('C1'));
    }

    // 3. C2 Polyline (NH-27 Haflong Detour)
    const c2Blocked = Boolean(isHaflongBlocked);
    const c2Color = c2Blocked ? TOKENS.blocked : (activeRouteId === 'C2' ? '#10B981' : '#0284C7');
    const c2Dash = c2Blocked ? '8, 8' : undefined;

    // Radiant emerald glowing halo when C2 is active or recommended (and not blocked)
    if ((activeRouteId === 'C2' || isSonapurBlocked) && !c2Blocked) {
      L.polyline(C2_COORDINATES, {
        color: '#10B981', // Radiant emerald
        weight: 12,
        opacity: 0.35,
      }).addTo(group);
    }

    const c2Line = L.polyline(C2_COORDINATES, {
      color: c2Color,
      weight: 6,
      opacity: c2Blocked ? 0.9 : 0.85,
      dashArray: c2Dash,
    })
      .bindPopup(
        `<b>C2 NH-27 Haflong Bypass (362 km)</b><br/>${
          c2Blocked
            ? '<span style="color:#8B1A1A;font-weight:bold;">BLOCKED — Haflong Landslide Injected</span>'
            : isSonapurBlocked
            ? '<span style="color:#0F6E5D;font-weight:bold;">Recommended Resilient Route (+42 km)</span>'
            : 'Alternate Mountain Corridor'
        }`
      )
      .addTo(group);

    if (onCorridorSelect) {
      c2Line.on('click', () => onCorridorSelect('C2'));
    }

    // 4. Critical Chokepoint Markers (Sonapur Tunnel)
    CHOKEPOINTS.forEach((cp) => {
      const isBlocked = cp.isBlocked;
      const markerHtml = `
        <div style="position:relative; width:30px; height:30px; display:flex; align-items:center; justify-content:center;">
          ${
            isBlocked
              ? `<div style="position:absolute; inset:-4px; border-radius:50%; background:rgba(139,26,26,0.3); animation:ping-emergency 1.8s infinite;"></div>`
              : `<div style="position:absolute; inset:-2px; border-radius:50%; background:rgba(15,110,93,0.2); animation:pulse-alive 2.5s infinite;"></div>`
          }
          <div style="width:22px; height:22px; border-radius:50%; background:${
            isBlocked ? '#8B1A1A' : '#0F6E5D'
          }; border:2px solid #FFFFFF; box-shadow:0 1px 4px rgba(0,0,0,0.25); display:flex; align-items:center; justify-content:center; color:#FFFFFF; font-size:12px; font-weight:bold;">
            ${isBlocked ? '✕' : '▲'}
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        html: markerHtml,
        className: 'chokepoint-marker',
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });

      L.marker(cp.coords, { icon: customIcon })
        .bindPopup(
          `<b>${cp.name}</b><br/><span style="color:${
            isBlocked ? '#8B1A1A' : '#0F6E5D'
          };font-weight:bold;">${cp.desc}</span><br/><small>Lat: ${cp.coords[0]}°N, Lon: ${
            cp.coords[1]
          }°E</small>`
        )
        .addTo(group);
    });

    // 5. Driver GPS Marker
    if (driverLocation) {
      const driverHtml = `
        <div style="position:relative; width:28px; height:28px; display:flex; align-items:center; justify-content:center;">
          <div style="position:absolute; inset:-4px; border-radius:50%; background:rgba(15,110,93,0.25); animation:pulse-alive 2s infinite;"></div>
          <div style="width:14px; height:14px; border-radius:50%; background:#0F6E5D; border:2px solid #FFFFFF; box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>
        </div>
      `;

      const driverIcon = L.divIcon({
        html: driverHtml,
        className: 'driver-gps-marker',
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      L.marker([driverLocation.latitude, driverLocation.longitude], {
        icon: driverIcon,
        zIndexOffset: 1000,
      })
        .bindPopup(
          `<b>Your Vehicle Location</b><br/>${
            driverLocation.landmark_name || 'Driver GPS'
          }<br/><small>Real-time Telemetry</small>`
        )
        .addTo(group);
    }

    // 6. Target Location Pin (From LocationSearchBar)
    if (targetLocation && targetLocation.lat && targetLocation.lng) {
      const targetHtml = `
        <div style="position:relative; width:32px; height:32px; display:flex; align-items:center; justify-content:center;">
          <div style="position:absolute; inset:-4px; border-radius:50%; background:rgba(224,138,0,0.35); animation:ping-emergency 1.5s infinite;"></div>
          <div style="width:20px; height:20px; border-radius:50%; background:#E08A00; border:2px solid #FFFFFF; box-shadow:0 1px 5px rgba(0,0,0,0.3); display:flex; align-items:center; justify-content:center; color:#FFFFFF; font-size:11px; font-weight:bold;">
            📍
          </div>
        </div>
      `;

      const targetIcon = L.divIcon({
        html: targetHtml,
        className: 'target-search-marker',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      L.marker([targetLocation.lat, targetLocation.lng], {
        icon: targetIcon,
        zIndexOffset: 1100,
      })
        .bindPopup(
          `<b>Inspected Location</b><br/>${
            targetLocation.name || 'Searched Coordinate'
          }<br/><small>${targetLocation.lat.toFixed(4)}°N, ${targetLocation.lng.toFixed(
            4
          )}°E</small>`
        )
        .addTo(group);
    }

    if (activeRouteId === 'C2' || isSonapurBlocked) {
      mapInstanceRef.current.panTo([25.1667, 93.0245], { animate: true });
    }
  }, [mapReady, activeRouteId, isSonapurBlocked, isHaflongBlocked, driverLocation, targetLocation, riskScore]);

  const handleRecenter = () => {
    if (mapInstanceRef.current && driverLocation) {
      mapInstanceRef.current.setView([driverLocation.latitude, driverLocation.longitude], 9, {
        animate: true,
      });
    }
  };

  return (
    <div
      style={{ height }}
      className="relative w-full rounded-xl overflow-hidden border border-line bg-surface shadow-xs"
    >
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Top Floating Status Chip */}
      <div className="absolute top-2.5 left-2.5 z-10 flex flex-col gap-1.5 pointer-events-none">
        <div className="bg-white/95 border border-line rounded-lg px-2.5 py-1.5 shadow-xs flex items-center gap-2 pointer-events-auto">
          <div
            className={`w-2.5 h-2.5 rounded-full shrink-0 ${
              isSonapurBlocked ? 'bg-[#8B1A1A] ping-emergency' : 'bg-[#2E7D32]'
            }`}
          />
          <div className="text-xs font-bold text-ink font-mono flex items-center gap-1.5">
            <span>{activeRouteId === 'C2' ? 'NH-27 Haflong' : 'NH-6 Sonapur'}</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded font-bold uppercase ${
                isSonapurBlocked
                  ? 'bg-[#FBEBEB] text-[#5A1010] border border-[#8B1A1A]'
                  : 'bg-[#EDF7ED] text-[#1E4620] border border-[#2E7D32]'
              }`}
            >
              {isSonapurBlocked ? 'BLOCKED' : `Ri ${Number(riskScore).toFixed(2)}`}
            </span>
          </div>
        </div>
        <div className="pointer-events-auto">
          <HonestyBadge label={honestyLabel} size="xs" />
        </div>
      </div>

      {/* Top Right Map Controls: Layer Switcher & Recenter */}
      <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1.5">
        {/* Layer Switcher Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowLayerMenu(!showLayerMenu)}
            className="p-2 bg-white hover:bg-paper text-ink rounded-lg border border-line shadow-xs flex items-center justify-center transition-colors"
            title="Switch Basemap (Mapbox Outdoors / Mapbox Light / OSM)"
            aria-label="Toggle basemap layer"
          >
            <Layers className="w-4 h-4 text-brand" />
          </button>

          {showLayerMenu && (
            <div className="absolute right-0 top-full mt-1 bg-white border border-line rounded-xl shadow-lg p-1.5 z-20 w-48 text-xs font-medium space-y-1">
              <div className="text-[10px] text-muted font-mono uppercase px-2 py-0.5">
                Basemap Layer
              </div>
              <button
                type="button"
                onClick={() => switchTileLayer('outdoors')}
                className={`w-full text-left px-2.5 py-1.5 rounded-md flex items-center justify-between ${
                  activeTileType === 'outdoors'
                    ? 'bg-[#E6F4F1] text-brand font-bold'
                    : 'text-ink hover:bg-[#FAF8F5]'
                }`}
              >
                <span>Mapbox Outdoors (Terrain)</span>
                {activeTileType === 'outdoors' && <span className="text-brand">✓</span>}
              </button>
              <button
                type="button"
                onClick={() => switchTileLayer('light')}
                className={`w-full text-left px-2.5 py-1.5 rounded-md flex items-center justify-between ${
                  activeTileType === 'light'
                    ? 'bg-[#E6F4F1] text-brand font-bold'
                    : 'text-ink hover:bg-[#FAF8F5]'
                }`}
              >
                <span>Mapbox Light (Paper)</span>
                {activeTileType === 'light' && <span className="text-brand">✓</span>}
              </button>
              <button
                type="button"
                onClick={() => switchTileLayer('osm')}
                className={`w-full text-left px-2.5 py-1.5 rounded-md flex items-center justify-between ${
                  activeTileType === 'osm'
                    ? 'bg-[#E6F4F1] text-brand font-bold'
                    : 'text-ink hover:bg-[#FAF8F5]'
                }`}
              >
                <span>OpenStreetMap (Standard)</span>
                {activeTileType === 'osm' && <span className="text-brand">✓</span>}
              </button>
            </div>
          )}
        </div>

        {/* Recenter Button */}
        <button
          type="button"
          onClick={handleRecenter}
          className="p-2 bg-white hover:bg-paper text-ink rounded-lg border border-line shadow-xs flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-brand"
          title="Recenter GPS"
          aria-label="Recenter map to driver GPS position"
        >
          <Locate className="w-4 h-4 text-brand" />
        </button>
      </div>

      {/* Chokepoint Veto Banner */}
      {isSonapurBlocked && (
        <div className="absolute bottom-2.5 left-2.5 right-12 z-10 pointer-events-auto">
          <div className="bg-[#FBEBEB] border border-[#8B1A1A] rounded-lg px-3 py-1.5 shadow-xs flex items-center gap-2 text-[#5A1010] text-xs font-medium">
            <AlertTriangle className="w-4 h-4 text-[#8B1A1A] shrink-0" />
            <span className="truncate">Sonapur Tunnel (NH-6): Landslide Structural Veto</span>
          </div>
        </div>
      )}
    </div>
  );
}
