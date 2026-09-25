'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, MapPin, Loader2, X, Navigation } from 'lucide-react';
import { useTranslation } from '../../lib/i18n';

// Verified Northeast Lifeline Hubs & Chokepoints
export const PRESET_NORTHEAST_HUBS = [
  {
    name: 'Sonapur Tunnel',
    code: 'SONAPUR',
    lat: 25.1147,
    lng: 92.3654,
    highway: 'NH-6',
    desc: 'Critical mountain chokepoint (Meghalaya-Barak Valley)',
    riskLevel: 'HIGH_HAZARD',
  },
  {
    name: 'Haflong Bypass',
    code: 'HAFLONG',
    lat: 25.1764,
    lng: 93.0238,
    highway: 'NH-27',
    desc: 'Elevated structural bypass (Dima Hasao)',
    riskLevel: 'RESILIENT',
  },
  {
    name: 'Silchar Terminal',
    code: 'SILCHAR',
    lat: 24.8333,
    lng: 92.7789,
    highway: 'NH-6 / NH-27',
    desc: 'Barak Valley central relief logistics hub',
    riskLevel: 'SAFE',
  },
  {
    name: 'Guwahati Gateway',
    code: 'GUWAHATI',
    lat: 26.1445,
    lng: 91.7362,
    highway: 'NH-27',
    desc: 'Primary Northeast distribution node',
    riskLevel: 'SAFE',
  },
  {
    name: 'Shillong Sector',
    code: 'SHILLONG',
    lat: 25.5788,
    lng: 91.8933,
    highway: 'NH-6',
    desc: 'Meghalaya highland corridor transit',
    riskLevel: 'MODERATE',
  },
  {
    name: 'Agartala Lifeline',
    code: 'AGARTALA',
    lat: 23.8315,
    lng: 91.2868,
    highway: 'NH-208',
    desc: 'Tripura supply corridor terminus',
    riskLevel: 'SAFE',
  },
  {
    name: 'Aizawl Lifeline',
    code: 'AIZAWL',
    lat: 23.7271,
    lng: 92.7176,
    highway: 'NH-306',
    desc: 'Mizoram mountain supply artery',
    riskLevel: 'SAFE',
  },
];

export default function LocationSearchBar({
  onLocationSelect = () => {},
  onSelectLocation = null,
  placeholder = null,
  showPresetChips = true,
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const abortControllerRef = useRef(null);
  const containerRef = useRef(null);

  const notifySelection = (payload) => {
    if (onSelectLocation) onSelectLocation(payload);
    if (onLocationSelect) onLocationSelect(payload);
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search query against OSM Nominatim + local hubs
  const performSearch = useCallback(
    async (searchTerm) => {
      if (!searchTerm || searchTerm.trim().length < 2) {
        setResults([]);
        setSearching(false);
        return;
      }

      const cleanQuery = searchTerm.trim().toLowerCase();

      // First check local Northeast hubs for instant offline match
      const localMatches = PRESET_NORTHEAST_HUBS.filter(
        (hub) =>
          hub.name.toLowerCase().includes(cleanQuery) ||
          hub.highway.toLowerCase().includes(cleanQuery) ||
          hub.desc.toLowerCase().includes(cleanQuery)
      ).map((hub) => ({
        display_name: `${hub.name} (${hub.highway}) - ${hub.desc}`,
        lat: hub.lat,
        lon: hub.lng,
        is_hub: true,
        hub_data: hub,
      }));

      setSearching(true);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      try {
        // Query OpenStreetMap Nominatim with India countrycode filter
        const endpoint = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
          searchTerm
        )}&format=json&countrycodes=in&limit=5`;

        const resp = await fetch(endpoint, {
          signal: abortControllerRef.current.signal,
          headers: {
            Accept: 'application/json',
          },
        });

        if (resp.ok) {
          const data = await resp.json();
          const nominatimResults = data.map((item) => ({
            display_name: item.display_name,
            lat: parseFloat(item.lat),
            lon: parseFloat(item.lon),
            is_hub: false,
          }));

          // Merge: prioritize local verified hubs, then append Nominatim results
          const merged = [...localMatches, ...nominatimResults.slice(0, 5)];
          setResults(merged);
        } else {
          setResults(localMatches);
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.warn('Geocoding search network error, falling back to local hubs:', err.message);
          setResults(localMatches);
        }
      } finally {
        setSearching(false);
      }
    },
    []
  );

  // Debounce keystrokes by 500ms (respects OSM Nominatim 1 req/sec policy)
  useEffect(() => {
    if (!query) {
      setResults([]);
      setSearching(false);
      return;
    }

    const timer = setTimeout(() => {
      performSearch(query);
    }, 500);

    return () => clearTimeout(timer);
  }, [query, performSearch]);

  const handleSelect = (item) => {
    setQuery(item.is_hub ? item.hub_data.name : item.display_name.split(',')[0]);
    setIsOpen(false);
    notifySelection({
      lat: item.lat,
      lng: item.lon,
      name: item.is_hub ? item.hub_data.name : item.display_name.split(',')[0],
      displayName: item.display_name,
      isHub: item.is_hub,
      hubData: item.hub_data || null,
    });
  };

  const handleChipClick = (hub) => {
    setQuery(hub.name);
    setIsOpen(false);
    notifySelection({
      lat: hub.lat,
      lng: hub.lng,
      name: hub.name,
      displayName: `${hub.name} (${hub.highway})`,
      isHub: true,
      hubData: hub,
    });
  };

  const clearQuery = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative w-full space-y-2">
      {/* Search Input Box */}
      <div className="relative">
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none">
          {searching ? <Loader2 className="w-4 h-4 animate-spin text-brand" /> : <Search className="w-4 h-4" />}
        </div>

        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder || t('corridors_search_placeholder', 'Search Northeast location (e.g. Sonapur, Haflong)...')}
          className="w-full pl-10 pr-9 py-2.5 bg-white border border-line rounded-xl text-xs sm:text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand shadow-xs transition-all"
        />

        {query && (
          <button
            type="button"
            onClick={clearQuery}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted hover:text-ink rounded-full"
            title="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Autocomplete Results Dropdown */}
      {isOpen && results.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-line rounded-xl shadow-lg z-50 overflow-hidden divide-y divide-line/60 max-h-60 overflow-y-auto">
          {results.map((item, idx) => (
            <button
              key={`${item.lat}-${item.lon}-${idx}`}
              type="button"
              onClick={() => handleSelect(item)}
              className="w-full px-3.5 py-2.5 text-left hover:bg-[#FAF8F5] transition-colors flex items-start gap-2.5 group"
            >
              <MapPin
                className={`w-4 h-4 shrink-0 mt-0.5 ${
                  item.is_hub ? 'text-[#8B1A1A]' : 'text-brand'
                }`}
              />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-ink group-hover:text-brand truncate">
                  {item.display_name}
                </div>
                <div className="text-[10px] text-muted font-mono mt-0.5">
                  {item.lat.toFixed(4)}°N, {item.lon.toFixed(4)}°E
                  {item.is_hub && (
                    <span className="ml-1.5 px-1 py-0.2 bg-[#FAF0E6] text-[#78350F] rounded text-[9px] font-bold">
                      VERIFIED HUB
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* 1-Click Quick Select POI Chips */}
      {showPresetChips && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[11px]">
          <span className="text-[10px] text-muted font-mono shrink-0 mr-1 flex items-center gap-1">
            <Navigation className="w-3 h-3 text-brand" />
            <span>Northeast Hubs:</span>
          </span>
          {PRESET_NORTHEAST_HUBS.map((hub) => (
            <button
              key={hub.code}
              type="button"
              onClick={() => handleChipClick(hub)}
              className="px-2.5 py-1 bg-white hover:bg-[#FAF8F5] border border-line hover:border-brand rounded-lg text-ink font-medium whitespace-nowrap shadow-xs transition-colors shrink-0 flex items-center gap-1"
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  hub.riskLevel === 'HIGH_HAZARD'
                    ? 'bg-[#8B1A1A]'
                    : hub.riskLevel === 'RESILIENT'
                    ? 'bg-brand'
                    : 'bg-[#2E7D32]'
                }`}
              />
              <span>{hub.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
