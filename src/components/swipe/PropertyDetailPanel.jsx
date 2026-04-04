import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  X, MapPin, CheckCircle2, XCircle, MinusCircle,
  Bed, Maximize2, Navigation, ArrowLeftRight, Loader2, ChevronLeft,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/api/apiClient";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

function makeIcon(color) {
  return new L.DivIcon({
    html: `<div style="background:${color};width:14px;height:14px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.35)"></div>`,
    className: "",
    iconAnchor: [7, 7],
  });
}
const homeIcon  = makeIcon("#ea580c");
const placeIcon = makeIcon("#6366f1");

// Fly to a single point
function MapFlyTo({ coords }) {
  const map = useMap();
  useEffect(() => { if (coords) map.flyTo(coords, 15, { duration: 0.7 }); }, [coords]);
  return null;
}

// Fit both points in view
function MapFitBounds({ bounds }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
  }, [bounds]);
  return null;
}

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const OSRM_PROFILE = { walk: "foot", cycle: "cycling", drive: "driving" };

async function fetchOSRMRoute(from, to, mode) {
  const profile = OSRM_PROFILE[mode];
  if (!profile) return null;
  try {
    const url = `https://router.project-osrm.org/route/v1/${profile}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.routes?.[0]) {
      return {
        coords: data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]),
        duration: Math.round(data.routes[0].duration / 60),
        distance: Math.round(data.routes[0].distance),
      };
    }
  } catch {}
  return null;
}

function formatDistance(m) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`;
}

const TRAVEL_MODES = [
  { key: "walk",    icon: "🚶", label: "Walk",    color: "#16a34a", gmaps: "walking" },
  { key: "cycle",   icon: "🚴", label: "Cycle",   color: "#d97706", gmaps: "bicycling" },
  { key: "transit", icon: "🚇", label: "Transit", color: "#2563eb", gmaps: "transit" },
  { key: "drive",   icon: "🚗", label: "Drive",   color: "#7c3aed", gmaps: "driving" },
];

const AMENITY_TABLE_MAP = {
  mrt: "amenity_mrt", hawker: "amenity_hawker",
  supermarket: "amenity_supermarket", parks: "amenity_park",
  hospital: "amenity_hospital", polyclinic: "amenity_polyclinic",
};
const AMENITY_META = {
  mrt:         { label: "MRT Station",      emoji: "🚇" },
  bus:         { label: "Bus Stop",         emoji: "🚌" },
  hawker:      { label: "Hawker Centre",    emoji: "🍜" },
  supermarket: { label: "Supermarket",      emoji: "🛒" },
  parks:       { label: "Parks / Greenery", emoji: "🌳" },
  hospital:    { label: "Hospital",         emoji: "🏥" },
  polyclinic:  { label: "Polyclinic",       emoji: "💊" },
};

// ─── Directions view (full map + modes) ──────────────────────────────────────
function DirectionsView({ listing, destination, onBack }) {
  const [direction, setDirection] = useState("from"); // from home / to home
  const [mode, setMode]           = useState("walk");
  const [route, setRoute]         = useState(null);
  const [loading, setLoading]     = useState(false);

  const from = direction === "from"
    ? { lat: listing.lat, lng: listing.lng }
    : { lat: destination.lat, lng: destination.lng };
  const to = direction === "from"
    ? { lat: destination.lat, lng: destination.lng }
    : { lat: listing.lat, lng: listing.lng };

  const fromAddr = direction === "from" ? listing.address : (destination.address || destination.label);
  const toAddr   = direction === "from" ? (destination.address || destination.label) : listing.address;

  useEffect(() => {
    if (mode === "transit") { setRoute(null); return; }
    setLoading(true);
    fetchOSRMRoute(from, to, mode).then(r => { setRoute(r); setLoading(false); });
  }, [mode, direction]);

  const bounds = [[listing.lat, listing.lng], [destination.lat, destination.lng]];
  const routeColor = TRAVEL_MODES.find(m => m.key === mode)?.color || "#6366f1";

  // Haversine fallback for transit
  const distM = haversineDistance(listing.lat, listing.lng, destination.lat, destination.lng);
  const transitMins = Math.round(distM / 300);

  const gmapsOrigin = encodeURIComponent(fromAddr);
  const gmapsDest   = encodeURIComponent(toAddr);
  const gmapsMode   = TRAVEL_MODES.find(m => m.key === mode)?.gmaps || "walking";

  return (
    <div className="flex flex-col h-full">
      {/* Back + header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 flex-shrink-0">
        <button onClick={onBack} className="p-1.5 hover:bg-slate-100 rounded-full">
          <ChevronLeft className="w-4 h-4 text-slate-500" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-400 truncate">From: {fromAddr}</p>
          <p className="text-xs font-semibold text-slate-700 truncate">To: {toAddr}</p>
        </div>
        {/* From ↔ To toggle */}
        <button
          onClick={() => setDirection(d => d === "from" ? "to" : "from")}
          className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-indigo-600 flex-shrink-0"
          title="Swap direction"
        >
          <ArrowLeftRight className="w-4 h-4" />
        </button>
      </div>

      {/* Mode selector */}
      <div className="flex gap-1 px-3 py-2 border-b border-slate-100 flex-shrink-0">
        {TRAVEL_MODES.map(({ key, icon, label }) => (
          <button
            key={key}
            onClick={() => setMode(key)}
            style={mode === key ? { borderColor: TRAVEL_MODES.find(m => m.key === key).color, backgroundColor: TRAVEL_MODES.find(m => m.key === key).color + "15" } : {}}
            className={`flex-1 flex flex-col items-center py-1.5 rounded-xl border text-xs transition-all ${
              mode === key ? "font-semibold" : "border-slate-100 text-slate-400 hover:bg-slate-50"
            }`}
          >
            <span className="text-base">{icon}</span>
            {loading && mode === key
              ? <Loader2 className="w-3 h-3 animate-spin mt-0.5" style={{ color: TRAVEL_MODES.find(m => m.key === key).color }} />
              : <span style={mode === key ? { color: TRAVEL_MODES.find(m => m.key === key).color } : {}}>
                  {key === "transit"
                    ? `~${transitMins}min`
                    : route && mode === key ? `${route.duration}min` : label}
                </span>
            }
          </button>
        ))}
      </div>

      {/* Map */}
      <div className="flex-1 min-h-0" style={{ height: "340px" }}>
        <MapContainer
          center={[listing.lat, listing.lng]}
          zoom={14}
          className="h-full w-full"
          scrollWheelZoom={true}
          zoomControl={true}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          <MapFitBounds bounds={bounds} />

          {/* Origin marker */}
          <Marker position={[from.lat, from.lng]} icon={homeIcon}>
            <Popup><div className="text-sm font-semibold">🏠 {fromAddr}</div></Popup>
          </Marker>
          {/* Destination marker */}
          <Marker position={[to.lat, to.lng]} icon={placeIcon}>
            <Popup><div className="text-sm font-semibold">📍 {toAddr}</div></Popup>
          </Marker>

          {/* Actual route or dashed line */}
          {route?.coords ? (
            <Polyline positions={route.coords} color={routeColor} weight={4} opacity={0.85} />
          ) : (
            <Polyline
              positions={[[from.lat, from.lng], [to.lat, to.lng]]}
              color={routeColor} weight={3} opacity={0.5} dashArray="8 6"
            />
          )}
        </MapContainer>
      </div>

      {/* Route info + Google Maps link */}
      <div className="px-4 py-3 border-t border-slate-100 flex-shrink-0 space-y-2">
        {mode !== "transit" && route ? (
          <div className="flex items-center justify-between">
            <div>
              <span className="text-lg font-bold text-slate-900">{route.duration} min</span>
              <span className="text-sm text-slate-400 ml-2">{formatDistance(route.distance)}</span>
            </div>
            <span className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded-full">via OpenStreetMap</span>
          </div>
        ) : mode === "transit" ? (
          <div className="flex items-center justify-between">
            <div>
              <span className="text-lg font-bold text-slate-900">~{transitMins} min</span>
              <span className="text-sm text-slate-400 ml-2">{formatDistance(distM)}</span>
            </div>
            <span className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded-full">estimated</span>
          </div>
        ) : loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin" /> Calculating route...
          </div>
        ) : null}

        <a
          href={`https://www.google.com/maps/dir/?api=1&origin=${gmapsOrigin}&destination=${gmapsDest}&travelmode=${gmapsMode}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition-colors"
        >
          <Navigation className="w-4 h-4" />
          Open in Google Maps
        </a>
      </div>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────
export default function PropertyDetailPanel({ listing, profile, scoreBreakdown, lifeScore, onClose }) {
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [loadingKey, setLoadingKey]             = useState(null);
  const [directionsMode, setDirectionsMode]     = useState(false);

  const hasCoords = !!(listing.lat && listing.lng);
  const typeLabels = { hdb: "HDB", condo: "Condo", landed: "Landed", executive_condo: "EC" };

  const handleAmenityClick = async (key, bd) => {
    if (selectedLocation?.key === key) {
      setSelectedLocation(null); setDirectionsMode(false); return;
    }
    setDirectionsMode(false);
    if (key === "bus") {
      setSelectedLocation({ key, label: "Bus Stop (approx)", lat: listing.lat, lng: listing.lng, approx: true });
      return;
    }
    const table = AMENITY_TABLE_MAP[key];
    if (!table || !bd?.name) { setSelectedLocation({ key, label: AMENITY_META[key]?.label, noCoords: true }); return; }
    setLoadingKey(key);
    try {
      const { data } = await supabase.from(table).select("lat, lng").eq("name", bd.name).limit(1);
      if (data?.[0]) {
        setSelectedLocation({ key, label: `${AMENITY_META[key].emoji} ${bd.name}`, address: bd.name + " Singapore", lat: data[0].lat, lng: data[0].lng });
      } else {
        setSelectedLocation({ key, label: AMENITY_META[key]?.label, noCoords: true });
      }
    } catch { setSelectedLocation({ key, label: AMENITY_META[key]?.label, noCoords: true }); }
    finally { setLoadingKey(null); }
  };

  const handlePlaceClick = (place, i) => {
    const key = `place_${i}`;
    if (selectedLocation?.key === key) { setSelectedLocation(null); setDirectionsMode(false); return; }
    setDirectionsMode(false);
    if (place.lat && place.lng) {
      setSelectedLocation({ key, label: place.label, address: place.address, lat: place.lat, lng: place.lng, mode: place.mode });
    }
  };

  const canShowDirections = hasCoords && selectedLocation?.lat && !selectedLocation.approx && !selectedLocation.noCoords;

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", stiffness: 320, damping: 30 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* ── Directions mode ── */}
          <AnimatePresence mode="wait">
            {directionsMode && selectedLocation ? (
              <motion.div
                key="directions"
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 40 }}
                className="flex flex-col flex-1 overflow-hidden"
                style={{ maxHeight: "88vh" }}
              >
                <DirectionsView
                  listing={listing}
                  destination={selectedLocation}
                  onBack={() => setDirectionsMode(false)}
                />
              </motion.div>
            ) : (

            /* ── Default view ── */
            <motion.div
              key="default"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col flex-1 overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 flex-shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full flex-shrink-0">
                    {typeLabels[listing.property_type] || listing.property_type}
                  </span>
                  <h2 className="font-bold text-slate-900 truncate">{listing.title}</h2>
                </div>
                <button onClick={onClose} className="ml-2 p-1.5 hover:bg-slate-100 rounded-full flex-shrink-0">
                  <X className="w-4 h-4 text-slate-500" />
                </button>
              </div>

              {/* Map */}
              <div className="h-56 flex-shrink-0">
                {hasCoords ? (
                  <MapContainer center={[listing.lat, listing.lng]} zoom={15}
                    className="h-full w-full" scrollWheelZoom={false} zoomControl={false}>
                    <TileLayer
                      url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                      attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    />
                    {selectedLocation?.lat && <MapFlyTo coords={[selectedLocation.lat, selectedLocation.lng]} />}

                    <Marker position={[listing.lat, listing.lng]} icon={homeIcon}>
                      <Popup><div className="text-sm font-semibold">🏠 {listing.title}</div></Popup>
                    </Marker>
                    {selectedLocation?.lat && !selectedLocation.approx && (
                      <>
                        <Marker position={[selectedLocation.lat, selectedLocation.lng]} icon={placeIcon}>
                          <Popup><div className="text-sm font-semibold">{selectedLocation.label}</div></Popup>
                        </Marker>
                        <Polyline
                          positions={[[listing.lat, listing.lng], [selectedLocation.lat, selectedLocation.lng]]}
                          color="#6366f1" weight={2} dashArray="6 4"
                        />
                      </>
                    )}
                    {profile?.important_places?.map((place, i) =>
                      place.lat && place.lng ? (
                        <Marker key={i} position={[place.lat, place.lng]} icon={placeIcon}>
                          <Popup>
                            <div className="text-sm font-semibold">{place.label}</div>
                            <div className="text-xs text-slate-400">{place.address}</div>
                          </Popup>
                        </Marker>
                      ) : null
                    )}
                  </MapContainer>
                ) : (
                  <div className="h-full bg-slate-100 flex items-center justify-center">
                    <div className="text-center text-slate-400">
                      <MapPin className="w-8 h-8 mx-auto mb-1 opacity-30" />
                      <p className="text-xs">Map unavailable</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto">
                <div className="p-4 space-y-4">

                  {/* Price row */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-2xl font-bold text-slate-900">${listing.price?.toLocaleString()}</div>
                      <div className="flex items-center gap-1 text-slate-500 text-xs mt-0.5">
                        <MapPin className="w-3 h-3 flex-shrink-0" /> {listing.address}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-slate-500 mt-1.5">
                        <span className="flex items-center gap-1"><Bed className="w-4 h-4" />{listing.num_bedrooms} BR</span>
                        {listing.floor_area_sqm && <span className="flex items-center gap-1"><Maximize2 className="w-4 h-4" />{listing.floor_area_sqm} sqm</span>}
                        {listing.storey_range && <span>Floor {listing.storey_range}</span>}
                        {listing.lease_remaining && <span>{listing.lease_remaining}yr lease</span>}
                      </div>
                    </div>
                    <div className="relative w-12 h-12 flex-shrink-0 flex items-center justify-center ml-3">
                      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 48 48">
                        <circle cx="24" cy="24" r="20" fill="#f1f5f9" stroke="#e2e8f0" strokeWidth="3" />
                        <circle cx="24" cy="24" r="20" fill="none"
                          stroke={lifeScore >= 70 ? "#22c55e" : lifeScore >= 40 ? "#f97316" : "#ef4444"}
                          strokeWidth="3" strokeLinecap="round"
                          strokeDasharray={`${2 * Math.PI * 20}`}
                          strokeDashoffset={`${2 * Math.PI * 20 * (1 - (lifeScore || 0) / 100)}`}
                        />
                      </svg>
                      <span className="relative text-xs font-bold text-slate-700">{lifeScore ?? "--"}%</span>
                    </div>
                  </div>

                  {/* Get Directions CTA */}
                  {canShowDirections && (
                    <button
                      onClick={() => setDirectionsMode(true)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition-colors"
                    >
                      <Navigation className="w-4 h-4" />
                      Get directions to {selectedLocation.label}
                    </button>
                  )}

                  <p className="text-xs text-slate-400 flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> Tap a location below to pin it on the map
                  </p>

                  {/* Amenities */}
                  {scoreBreakdown && Object.keys(AMENITY_META).some(k => scoreBreakdown[k]) && (
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Nearby Amenities</p>
                      <div className="space-y-1.5">
                        {Object.entries(AMENITY_META).map(([key, { label, emoji }]) => {
                          const bd = scoreBreakdown[key];
                          if (!bd) return null;
                          const isSelected = selectedLocation?.key === key;
                          const isLoading  = loadingKey === key;
                          const noData     = bd.minutes === null;
                          return (
                            <button
                              key={key}
                              onClick={() => hasCoords && handleAmenityClick(key, bd)}
                              disabled={!hasCoords || noData}
                              className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition-all ${
                                isSelected
                                  ? "border-indigo-300 bg-indigo-50"
                                  : hasCoords && !noData
                                    ? "border-slate-100 bg-slate-50 hover:border-indigo-200 hover:bg-indigo-50/50 cursor-pointer"
                                    : "border-slate-100 bg-slate-50 cursor-default opacity-60"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                {noData ? <MinusCircle className="w-4 h-4 text-slate-300" />
                                  : bd.status !== "none" ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                                  : <XCircle className="w-4 h-4 text-red-400" />}
                                <span className="text-sm text-slate-700">{emoji} {label}</span>
                                {bd.name && <span className="text-xs text-slate-400 truncate max-w-[110px]">{bd.name}</span>}
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {bd.minutes != null && <span className="text-sm font-semibold text-slate-700">{bd.minutes}min</span>}
                                {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                                  : isSelected ? <span className="text-[10px] text-indigo-600 font-medium">Pinned ✓</span>
                                  : hasCoords && !noData ? <Navigation className="w-3.5 h-3.5 text-slate-300" />
                                  : null}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Important Places */}
                  {profile?.important_places?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Important Places</p>
                      <div className="space-y-1.5">
                        {profile.important_places.map((place, i) => {
                          const bd  = scoreBreakdown?.[`place_${place.label}`];
                          const key = `place_${i}`;
                          const isSelected = selectedLocation?.key === key;
                          const hasPlace   = !!(place.lat && place.lng && hasCoords);
                          return (
                            <button
                              key={i}
                              onClick={() => hasPlace && handlePlaceClick(place, i)}
                              disabled={!hasPlace}
                              className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition-all ${
                                isSelected
                                  ? "border-indigo-300 bg-indigo-50"
                                  : hasPlace
                                    ? "border-slate-100 bg-slate-50 hover:border-indigo-200 hover:bg-indigo-50/50 cursor-pointer"
                                    : "border-slate-100 bg-slate-50 cursor-default opacity-60"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                {bd ? (
                                  bd.status === "full" ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                                  : bd.status === "partial" ? <CheckCircle2 className="w-4 h-4 text-amber-400" />
                                  : <XCircle className="w-4 h-4 text-red-400" />
                                ) : <MapPin className="w-4 h-4 text-slate-300" />}
                                <span className="text-sm text-slate-700">📍 {place.label}</span>
                                <span className="text-xs text-slate-400">
                                  {{ walk: "🚶", commute: "🚌", drive: "🚗" }[place.mode || "commute"]} ≤{place.minutes}min
                                </span>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {bd?.minutes != null && <span className="text-sm font-semibold text-slate-700">{bd.minutes}min</span>}
                                {isSelected
                                  ? <span className="text-[10px] text-indigo-600 font-medium">Pinned ✓</span>
                                  : hasPlace ? <Navigation className="w-3.5 h-3.5 text-slate-300" /> : null}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {listing.description && (
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Description</p>
                      <p className="text-sm text-slate-600 leading-relaxed">{listing.description}</p>
                    </div>
                  )}
                  <div className="h-4" />
                </div>
              </div>
            </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </>
  );
}
