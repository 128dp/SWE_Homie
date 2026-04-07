import React, { useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  X, MapPin, CheckCircle2, XCircle, MinusCircle,
  Bed, Maximize2, Navigation, ArrowLeftRight, Loader2, ChevronLeft,
  Train, Bus, UtensilsCrossed, ShoppingCart, Trees, Hospital, Stethoscope,
  Footprints, Car,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/api/apiClient";

// ─── Leaflet icon fix ─────────────────────────────────────────────────────────
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl:       "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl:     "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

function makeDot(color, size = 14, border = "white") {
  return new L.DivIcon({
    html: `<div style="background:${color};width:${size}px;height:${size}px;border-radius:50%;border:2.5px solid ${border};box-shadow:0 2px 8px rgba(0,0,0,0.3)"></div>`,
    className: "",
    iconAnchor: [size / 2, size / 2],
  });
}
const homeIcon  = makeDot("#ea580c", 18);
const placeIcon = makeDot("#6366f1");

// ─── Map helpers ──────────────────────────────────────────────────────────────
function MapController({ target, bounds, zoom = 15 }) {
  const map = useMap();
  const prevTarget = useRef(null);
  const prevBounds = useRef(null);

  useEffect(() => {
    if (bounds && bounds !== prevBounds.current) {
      prevBounds.current = bounds;
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15, animate: true });
    } else if (target && target !== prevTarget.current) {
      prevTarget.current = target;
      map.flyTo(target, zoom, { duration: 0.5 });
    }
  }, [target, bounds]);

  return null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const OSRM_PROFILE = { walk: "foot", drive: "driving" };

async function fetchOSRMRoute(from, to, mode) {
  const profile = OSRM_PROFILE[mode];
  if (!profile) return null;
  try {
    const res  = await fetch(`https://router.project-osrm.org/route/v1/${profile}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`);
    const data = await res.json();
    if (data.routes?.[0]) {
      const distance = Math.round(data.routes[0].distance);
      // OSRM public foot server returns unreliable durations (uses driving speeds).
      // Override walk time with 5 km/h = 83 m/min. Drive duration from OSRM is reliable.
      const duration = mode === "walk"
        ? Math.round(distance / 83)
        : Math.round(data.routes[0].duration / 60);
      return {
        coords: data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]),
        duration,
        distance,
      };
    }
  } catch {}
  return null;
}

async function fetchOneMapRoute(from, to, mode) {
  try {
    // Get token from your backend to avoid exposing credentials
    const tokenRes = await fetch('http://localhost:3001/api/onemap-token');
    const { token } = await tokenRes.json();
    if (!token) return null;

    const oneMapMode = mode === 'walk' ? 'walk' : mode === 'drive' ? 'drive' : 'pt';
    const url = `https://www.onemap.gov.sg/api/public/routingsvc/route?start=${from.lat},${from.lng}&end=${to.lat},${to.lng}&routeType=${oneMapMode}&token=${token}`;
    
    const res = await fetch(url);
    const data = await res.json();
    console.log('OneMap routing response:', JSON.stringify(data).slice(0, 300));

    if (data.status !== 1 && !data.route_summary) return null;

    const summary = data.route_summary || data.plan?.itineraries?.[0];
    if (!summary) return null;

    // Extract duration and distance
    let duration, distance;
    if (data.route_summary) {
      // Walk/drive response
      duration = Math.round(data.route_summary.total_time / 60);
      distance = data.route_summary.total_distance;
    } else {
      // PT response
      duration = Math.round(data.plan.itineraries[0].duration / 60);
      distance = data.plan.itineraries[0].legs?.reduce((sum, leg) => sum + (leg.distance || 0), 0) || 0;
    }

    // Extract polyline coords if available
    let coords = null;
    if (data.route_geometry) {
      // Decode encoded polyline
      coords = decodePolyline(data.route_geometry);
    } else if (data.plan?.itineraries?.[0]?.legs) {
      coords = data.plan.itineraries[0].legs.flatMap(leg =>
        leg.legGeometry?.points ? decodePolyline(leg.legGeometry.points) : []
      );
    }

    return { duration, distance, coords };
  } catch {
    return null;
  }
}

// Decode Google-encoded polyline format (used by OneMap)
function decodePolyline(encoded) {
  const coords = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let b, shift = 0, result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : result >> 1;
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : result >> 1;
    coords.push([lat / 1e5, lng / 1e5]);
  }
  return coords;
}

// Find nearest bus stop via Overpass (OSM), returns {lat, lng, name} or null
async function fetchNearestBusStop(lat, lng) {
  try {
    const query = `[out:json][timeout:10];node(around:400,${lat},${lng})[highway=bus_stop];out 1;`;
    const res = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
    const data = await res.json();
    const node = data.elements?.[0];
    if (!node) return null;
    return { lat: node.lat, lng: node.lon, name: node.tags?.name || node.tags?.ref || "Bus Stop" };
  } catch { return null; }
}

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000, r = d => d * Math.PI / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Singapore-calibrated transit estimates (straight-line haversine input)
// Matches server.js distanceToMinutes: ×1.6 detour, 200 m/min effective (~12 km/h)
// Train is faster door-to-door than bus, so we differentiate:
//   Train: ×1.5 detour, 250 m/min effective (~15 km/h)
//   Bus:   ×1.7 detour, 167 m/min effective (~10 km/h, more stops + wait)
function transitEstimate(distM, mode) {
  if (mode === "train") return { mins: Math.round(distM * 1.5 / 250), dist: Math.round(distM * 1.5) };
  if (mode === "bus")   return { mins: Math.round(distM * 1.7 / 167), dist: Math.round(distM * 1.7) };
  return null;
}

function fmtDist(m) { return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`; }

const TRAVEL_MODES = [
  { key: "walk",  label: "Walk",  Icon: Footprints, color: "#16a34a", gmaps: "walking" },
  { key: "train", label: "Train", Icon: Train,      color: "#2563eb", gmaps: "transit" },
  { key: "bus",   label: "Bus",   Icon: Bus,        color: "#0891b2", gmaps: "transit" },
  { key: "drive", label: "Drive", Icon: Car,        color: "#7c3aed", gmaps: "driving" },
];

const AMENITY_TABLE_MAP = {
  mrt: "amenity_mrt", hawker: "amenity_hawker",
  supermarket: "amenity_supermarket", parks: "amenity_park",
  hospital: "amenity_hospital", polyclinic: "amenity_polyclinic",
};

const AMENITY_META = {
  mrt:         { label: "MRT",         Icon: Train,           color: "#2563eb", bg: "#eff6ff" },
  bus:         { label: "Bus Stop",    Icon: Bus,             color: "#0891b2", bg: "#ecfeff" },
  hawker:      { label: "Hawker",      Icon: UtensilsCrossed, color: "#ea580c", bg: "#fff7ed" },
  supermarket: { label: "Supermarket", Icon: ShoppingCart,    color: "#16a34a", bg: "#f0fdf4" },
  parks:       { label: "Parks",       Icon: Trees,           color: "#15803d", bg: "#f0fdf4" },
  hospital:    { label: "Hospital",    Icon: Hospital,        color: "#dc2626", bg: "#fef2f2" },
  polyclinic:  { label: "Polyclinic",  Icon: Stethoscope,     color: "#9333ea", bg: "#faf5ff" },
};

const TYPE_LABELS = { hdb: "HDB", condo: "Condo", landed: "Landed", executive_condo: "EC" };

// ─── Main panel ───────────────────────────────────────────────────────────────
export default function PropertyDetailPanel({ listing, profile, scoreBreakdown, lifeScore, onClose }) {
  const [view,        setView]        = useState("detail"); // "detail" | "directions"
  const [selectedKey, setSelectedKey] = useState(null);
  const [selectedLoc, setSelectedLoc] = useState(null);   // { lat, lng, label, address }
  const [loadingKey,  setLoadingKey]  = useState(null);
  const [travelMode,  setTravelMode]  = useState("walk");
  const [route,       setRoute]       = useState(/** @type {{coords:[number,number][],duration:number,distance:number}|null} */(null));
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [dirFlipped,  setDirFlipped]  = useState(false);  // swap from/to
  const [detailRoute, setDetailRoute] = useState(/** @type {{coords:[number,number][]}|null} */(null)); // walk path in detail view

  const hasCoords  = !!(listing.lat && listing.lng);
  const scoreColor = lifeScore >= 70 ? "#22c55e" : lifeScore >= 40 ? "#f97316" : "#ef4444";
  const isTransit = travelMode === "train" || travelMode === "bus";

  // ── Map state ──────────────────────────────────────────────────────────────
  // In detail view: fly to selected amenity; in directions: fit route bounds
  const mapTarget = view === "detail" && selectedLoc?.lat
    ? [selectedLoc.lat, selectedLoc.lng] : null;
  const mapBounds = view === "directions" && hasCoords && selectedLoc?.lat
    ? [[listing.lat, listing.lng], [selectedLoc.lat, selectedLoc.lng]] : null;

  // Route colour
  const routeColor = TRAVEL_MODES.find(m => m.key === travelMode)?.color || "#6366f1";
  const gmapsMode  = TRAVEL_MODES.find(m => m.key === travelMode)?.gmaps || "walking";

  // Directions from/to (respects flip)
  const dirFrom = !dirFlipped
    ? { lat: listing.lat, lng: listing.lng, addr: listing.address }
    : { lat: selectedLoc?.lat, lng: selectedLoc?.lng, addr: selectedLoc?.address || selectedLoc?.label };
  const dirTo = !dirFlipped
    ? { lat: selectedLoc?.lat, lng: selectedLoc?.lng, addr: selectedLoc?.address || selectedLoc?.label }
    : { lat: listing.lat, lng: listing.lng, addr: listing.address };

  const straightDist = hasCoords && selectedLoc?.lat
    ? haversine(listing.lat, listing.lng, selectedLoc.lat, selectedLoc.lng) : 0;
  const transitEst = transitEstimate(straightDist, travelMode);

  // ── Fetch walk path in detail view whenever selectedLoc changes ───────────
  useEffect(() => {
    if (!hasCoords || !selectedLoc?.lat) { setDetailRoute(null); return; }
    (async () => {
      const result = await fetchOneMapRoute(
        { lat: listing.lat, lng: listing.lng },
        { lat: selectedLoc.lat, lng: selectedLoc.lng },
        "walk"
      ) || await fetchOSRMRoute(
        { lat: listing.lat, lng: listing.lng },
        { lat: selectedLoc.lat, lng: selectedLoc.lng },
        "walk"
      );
      setDetailRoute(result ? { coords: result.coords } : null);
    })();
  }, [selectedLoc]);

  // ── Fetch OSRM route when mode/dir changes in directions view ─────────────
  useEffect(() => {
    if (view !== "directions" || !hasCoords || !selectedLoc?.lat) return;
    setLoadingRoute(true);
    setRoute(null);
    (async () => {
      let result = null;

      if (travelMode === "train" || travelMode === "bus") {
        result = await fetchOneMapRoute(
          { lat: dirFrom.lat, lng: dirFrom.lng },
          { lat: dirTo.lat, lng: dirTo.lng },
          "pt"
        );
        // If OneMap PT fails, fall back to haversine estimate so UI always shows something
        if (!result) {
          const est = transitEstimate(straightDist, travelMode);
          if (est) result = { duration: est.mins, distance: est.dist, coords: null };
        }
      } else {
        result =
          await fetchOneMapRoute(
            { lat: dirFrom.lat, lng: dirFrom.lng },
            { lat: dirTo.lat, lng: dirTo.lng },
            travelMode
          ) ||
          await fetchOSRMRoute(
            { lat: dirFrom.lat, lng: dirFrom.lng },
            { lat: dirTo.lat, lng: dirTo.lng },
            travelMode
          );
      }

      setRoute(result);
      setLoadingRoute(false);
    })();
  }, [view, travelMode, dirFlipped]);

  // ── Amenity click ──────────────────────────────────────────────────────────
  const handleAmenityClick = async (key, bd) => {
    if (selectedKey === key) { setSelectedKey(null); setSelectedLoc(null); return; }
    setSelectedKey(key);
    setView("detail");

    if (key === "bus") {
      setLoadingKey(key);
      try {
        const stop = await fetchNearestBusStop(listing.lat, listing.lng);
        if (stop) setSelectedLoc({ lat: stop.lat, lng: stop.lng, label: `Bus Stop · ${stop.name}`, address: `Bus Stop ${stop.name}, Singapore` });
        else setSelectedLoc(null);
      } catch { setSelectedLoc(null); }
      finally { setLoadingKey(null); }
      return;
    }

    const table = AMENITY_TABLE_MAP[key];
    if (!table || !bd?.name) { setSelectedLoc(null); return; }
    setLoadingKey(key);
    try {
      // Fetch ALL rows with this name and pick the nearest to the listing.
      // Avoids returning a wrong-branch of a chain (e.g. wrong Sheng Siong).
      const { data } = await supabase.from(table).select("lat,lng").eq("name", bd.name);
      if (data?.length) {
        const nearest = data.reduce((best, row) => {
          const d = haversine(listing.lat, listing.lng, row.lat, row.lng);
          return d < best.d ? { row, d } : best;
        }, { row: data[0], d: Infinity }).row;
        setSelectedLoc({ lat: nearest.lat, lng: nearest.lng, label: AMENITY_META[key].label, address: `${bd.name}, Singapore` });
      } else {
        setSelectedLoc(null);
      }
    } catch { setSelectedLoc(null); }
    finally  { setLoadingKey(null); }
  };

  const handlePlaceClick = (place, i) => {
    const key = `place_${i}`;
    if (selectedKey === key) { setSelectedKey(null); setSelectedLoc(null); return; }
    setSelectedKey(key);
    setView("detail");
    if (place.lat && place.lng) {
      setSelectedLoc({ lat: place.lat, lng: place.lng, label: place.label, address: place.address });
    }
  };

  const openDirections = () => {
    setView("directions");
    setDirFlipped(false);
    setRoute(null);
    setTravelMode("walk");
  };

  const backToDetail = () => {
    setView("detail");
    setRoute(null);
  };

  const selectedLabel = selectedLoc?.label || (selectedKey ? AMENITY_META[selectedKey]?.label : null);
  const canDirections = hasCoords && selectedLoc?.lat;

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        key="bd"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        key="modal"
        initial={{ opacity: 0, scale: 0.97, y: 12 }}
        animate={{ opacity: 1, scale: 1,    y: 0  }}
        exit={{   opacity: 0, scale: 0.97, y: 12  }}
        transition={{ type: "spring", stiffness: 340, damping: 32 }}
        className="fixed z-50 inset-4 sm:inset-6 flex items-center justify-center pointer-events-none"
      >
        <div
          className="bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden pointer-events-auto flex w-full h-full relative"
          style={{ maxWidth: 1040, maxHeight: 720 }}
          onClick={e => e.stopPropagation()}
        >
          {/* Floating close */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-[9999] p-1.5 bg-white rounded-full shadow-md border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>

          {/* ── LEFT PANEL ── */}
          <div className="w-64 flex-shrink-0 flex flex-col border-r border-slate-100 overflow-hidden">
            <AnimatePresence mode="wait">

              {/* DIRECTIONS VIEW */}
              {view === "directions" && selectedLoc ? (
                <motion.div key="dir-panel"
                  initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="flex flex-col h-full overflow-hidden"
                >
                  {/* Back header */}
                  <div className="flex items-center gap-2 px-3 py-3 border-b border-slate-100 flex-shrink-0">
                    <button onClick={backToDetail} className="p-1.5 rounded-full hover:bg-slate-100 flex-shrink-0">
                      <ChevronLeft className="w-4 h-4 text-slate-500" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-slate-400 truncate">{dirFrom.addr}</p>
                      <p className="text-xs font-semibold text-slate-800 truncate">→ {dirTo.addr}</p>
                    </div>
                    <button onClick={() => { setDirFlipped(f => !f); setRoute(null); }}
                      className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-indigo-600 flex-shrink-0">
                      <ArrowLeftRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Mode grid */}
                  <div className="grid grid-cols-2 gap-1.5 p-3 border-b border-slate-100 flex-shrink-0">
                    {TRAVEL_MODES.map(({ key, Icon: ModeIcon, label, color }) => {
                      const active = travelMode === key;
                      const isTr   = key === "train" || key === "bus";
                      const est    = transitEstimate(straightDist, key);
                      const timeLabel = active && route ? `${route.duration}m` : null;
                      return (
                        <button key={key} onClick={() => { setTravelMode(key); setRoute(null); }}
                          style={active ? { borderColor: color, backgroundColor: color + "14", color } : {}}
                          className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-xs font-medium transition-all
                            ${active ? "" : "border-slate-200 text-slate-400 hover:bg-slate-50"}`}
                        >
                          {loadingRoute && active
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" style={{ color }} />
                            : <ModeIcon className="w-3.5 h-3.5 flex-shrink-0" />
                          }
                          <span>{timeLabel ?? label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Result */}
                  <div className="flex-1 px-4 py-4">
                  {route ? (
                    <div>
                      <p className="text-3xl font-bold text-slate-900">{route.duration} <span className="text-base font-normal text-slate-500">min</span></p>
                      <p className="text-xs text-slate-400 mt-1">{fmtDist(route.distance)} · {route.coords ? "via OneMap" : "estimated"}</p>
                      {isTransit && <p className="text-[10px] text-slate-300 mt-1">Includes walk & wait time</p>}
                    </div>
                  ) : loadingRoute ? (
                      <div className="flex items-center gap-2 text-sm text-slate-400">
                        <Loader2 className="w-4 h-4 animate-spin" /> Calculating…
                      </div>
                    ) : null}
                  </div>

                  {/* Google Maps link */}
                  <div className="px-3 pb-4 flex-shrink-0">
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(dirFrom.addr || "")}&destination=${encodeURIComponent(dirTo.addr || "")}&travelmode=${gmapsMode}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-colors"
                    >
                      <Navigation className="w-3.5 h-3.5" /> Open in Google Maps
                    </a>
                  </div>
                </motion.div>

              ) : (
              /* DETAIL VIEW */
              <motion.div key="detail-panel"
                initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 20, opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="flex flex-col h-full overflow-hidden"
              >
                {/* Property header */}
                <div className="px-4 pt-4 pb-3 border-b border-slate-100 flex-shrink-0">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    {TYPE_LABELS[listing.property_type] || listing.property_type}
                  </span>
                  <h2 className="text-sm font-bold text-slate-900 leading-snug mt-0.5 pr-6">{listing.title}</h2>
                  <p className="text-[11px] text-slate-400 flex items-start gap-1 mt-1">
                    <MapPin className="w-3 h-3 flex-shrink-0 mt-0.5" />
                    <span className="leading-tight">{listing.address}</span>
                  </p>

                  <div className="flex items-center justify-between mt-3">
                    <div>
                      <p className="text-base font-bold text-slate-900">${listing.price?.toLocaleString()}</p>
                      <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-slate-500 mt-0.5">
                        <span className="flex items-center gap-0.5"><Bed className="w-3 h-3" />{listing.num_bedrooms} BR</span>
                        {listing.floor_area_sqm && <span className="flex items-center gap-0.5"><Maximize2 className="w-3 h-3" />{listing.floor_area_sqm} sqm</span>}
                        {listing.lease_remaining && <span>{listing.lease_remaining}yr</span>}
                      </div>
                    </div>
                    {/* LifeScore ring */}
                    <div className="relative w-11 h-11 flex items-center justify-center flex-shrink-0">
                      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 44 44">
                        <circle cx="22" cy="22" r="17" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="3" />
                        <circle cx="22" cy="22" r="17" fill="none" stroke={scoreColor} strokeWidth="3" strokeLinecap="round"
                          strokeDasharray={`${2 * Math.PI * 17}`}
                          strokeDashoffset={`${2 * Math.PI * 17 * (1 - (lifeScore || 0) / 100)}`}
                        />
                      </svg>
                      <div className="relative text-center leading-none">
                        <p className="text-[11px] font-bold text-slate-800">{lifeScore ?? "--"}</p>
                        <p className="text-[8px] text-slate-400">%</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Directions button — shown when an amenity with coords is selected */}
                {canDirections && (
                  <div className="px-3 py-2 border-b border-slate-100 flex-shrink-0">
                    <button
                      onClick={openDirections}
                      className="w-full flex items-center justify-center gap-1.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors"
                    >
                      <Navigation className="w-3.5 h-3.5" />
                      Directions to {selectedLabel?.split(" · ")[0]}
                    </button>
                  </div>
                )}

                {/* Scrollable amenities + description */}
                <div className="flex-1 overflow-y-auto">
                  <div className="px-3 py-3 space-y-4">

                    {scoreBreakdown && Object.keys(AMENITY_META).some(k => scoreBreakdown[k]) && (
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Nearby — tap to view on map</p>
                        <div className="space-y-0.5">
                          {Object.entries(AMENITY_META).map(([key, { label, Icon, color, bg }]) => {
                            const bd         = scoreBreakdown[key];
                            if (!bd) return null;
                            const isSelected = selectedKey === key;
                            const isLoading  = loadingKey === key;
                            const noData     = bd.minutes === null;
                            const isBus      = key === "bus";
                            return (
                              <button
                                key={key}
                                onClick={() => !noData && handleAmenityClick(key, bd)}
                                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all ${
                                  isSelected ? "bg-indigo-50 ring-1 ring-indigo-200"
                                  : noData    ? "opacity-40 cursor-default"
                                  :             "hover:bg-slate-50 cursor-pointer"
                                }`}
                              >
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
                                  <Icon className="w-3.5 h-3.5" style={{ color }} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-semibold text-slate-700 truncate">{label}</p>
                                  {bd.name && <p className="text-[10px] text-slate-400 truncate">{bd.name}</p>}
                                  {isBus && isSelected && <p className="text-[10px] text-amber-500">~200m radius — no precise pin</p>}
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  {bd.minutes != null && (
                                    <span className={`text-xs font-bold tabular-nums ${bd.status === "full" ? "text-green-600" : bd.status === "partial" ? "text-amber-500" : "text-slate-400"}`}>
                                      {bd.minutes}m
                                    </span>
                                  )}
                                  {noData    ? <MinusCircle className="w-3.5 h-3.5 text-slate-300" />
                                  : isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                                  : isSelected ? <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500" />
                                  : bd.status === "none" ? <XCircle className="w-3.5 h-3.5 text-red-400" />
                                  :              <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {profile?.custom_amenities?.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Custom Amenities</p>
                        <div className="space-y-0.5">
                          {profile.custom_amenities.map((custom, i) => {
                            const bd = scoreBreakdown?.[`custom_${custom.query}`];
                            const key = `custom_${custom.query}`;
                            const isSelected = selectedKey === key;
                            const hasCoords = !!(bd?.lat && bd?.lng);
                            return (
                              <button
                                key={i}
                                onClick={() => {
                                  if (!hasCoords) return;
                                  if (isSelected) { setSelectedKey(null); setSelectedLoc(null); return; }
                                  setSelectedKey(key);
                                  setView("detail");
                                  setSelectedLoc({ 
                                    lat: bd.lat, 
                                    lng: bd.lng, 
                                    label: custom.label, 
                                    address: `${bd.name}, Singapore` 
                                  });
                                }}
                                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all ${
                                  isSelected ? "bg-indigo-50 ring-1 ring-indigo-200"
                                  : hasCoords ? "hover:bg-slate-50 cursor-pointer"
                                  : "opacity-40 cursor-default"
                                }`}
                              >
                                <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
                                  <MapPin className="w-3.5 h-3.5 text-purple-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-semibold text-slate-700 truncate">{custom.label}</p>
                                  {bd?.name && <p className="text-[10px] text-slate-400 truncate">{bd.name}</p>}
                                  {!bd && <p className="text-[10px] text-slate-300">not scored yet</p>}
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  {bd?.minutes != null && (
                                    <span className={`text-xs font-bold tabular-nums ${
                                      bd.status === "full" ? "text-green-600" 
                                      : bd.status === "partial" ? "text-amber-500" 
                                      : "text-slate-400"
                                    }`}>
                                      {bd.minutes}m
                                    </span>
                                  )}
                                  {!bd ? <MinusCircle className="w-3.5 h-3.5 text-slate-300" />
                                    : isSelected ? <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500" />
                                    : bd.status === "full" ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                                    : bd.status === "partial" ? <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                                    : <XCircle className="w-3.5 h-3.5 text-red-400" />}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}


                    {profile?.important_places?.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Important Places</p>
                        <div className="space-y-0.5">
                          {profile.important_places.map((place, i) => {
                            const bd         = scoreBreakdown?.[`place_${place.label}`];
                            const key        = `place_${i}`;
                            const isSelected = selectedKey === key;
                            const hasPlace   = !!(place.lat && place.lng && hasCoords);
                            return (
                              <button key={i} onClick={() => hasPlace && handlePlaceClick(place, i)} disabled={!hasPlace}
                                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all ${
                                  isSelected ? "bg-indigo-50 ring-1 ring-indigo-200"
                                  : hasPlace  ? "hover:bg-slate-50 cursor-pointer"
                                  :             "opacity-40 cursor-default"
                                }`}
                              >
                                <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                                  <MapPin className="w-3.5 h-3.5 text-indigo-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-semibold text-slate-700 truncate">{place.label}</p>
                                  <p className="text-[10px] text-slate-400">target {place.minutes}min</p>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  {bd?.minutes != null && (
                                    <span className={`text-xs font-bold tabular-nums ${bd.status === "full" ? "text-green-600" : bd.status === "partial" ? "text-amber-500" : "text-slate-400"}`}>
                                      {bd.minutes}m
                                    </span>
                                  )}
                                  {isSelected ? <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500" />
                                    : hasPlace ? <Navigation className="w-3 h-3 text-slate-300" /> : null}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {listing.description && (
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">About</p>
                        <p className="text-xs text-slate-500 leading-relaxed">{listing.description}</p>
                      </div>
                    )}
                    <div className="h-2" />
                  </div>
                </div>
              </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── RIGHT: persistent map (never unmounts — no blank-on-remount) ── */}
          <div className="flex-1 relative min-w-0">
            {hasCoords ? (
              <MapContainer
                center={[listing.lat, listing.lng]}
                zoom={15}
                scrollWheelZoom
                zoomControl
                style={{ position: "absolute", inset: 0 }}
              >
                <TileLayer
                  url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                  attribution="© OpenStreetMap"
                />

                <MapController
                  target={mapTarget}
                  bounds={mapBounds}
                  zoom={selectedLoc?.lat ? 16 : 15}
                />

                {/* Home marker — always visible */}
                <Marker position={[listing.lat, listing.lng]} icon={homeIcon}>
                  <Popup><p className="text-sm font-semibold m-0">{listing.title}</p></Popup>
                </Marker>

                {/* Selected amenity / place marker */}
                {selectedLoc?.lat && (
                  <>
                    <Marker position={[selectedLoc.lat, selectedLoc.lng]} icon={placeIcon}>
                      <Popup><p className="text-sm font-semibold m-0">{selectedLoc.label}</p></Popup>
                    </Marker>

                    {/* In detail view: actual walk path (OSRM), fallback dashed line */}
                    {view === "detail" && detailRoute?.coords && (
                      <Polyline positions={detailRoute.coords} color="#6366f1" weight={3} opacity={0.75} />
                    )}
                    {view === "detail" && !detailRoute?.coords && (
                      <Polyline
                        positions={[[listing.lat, listing.lng], [selectedLoc.lat, selectedLoc.lng]]}
                        color="#6366f1" weight={2} dashArray="7 5" opacity={0.4}
                      />
                    )}
                    {view === "directions" && route?.coords && (
                      <Polyline positions={route.coords} color={routeColor} weight={4} opacity={0.85} />
                    )}
                    {view === "directions" && !route?.coords && (
                      <Polyline
                        positions={[[dirFrom.lat, dirFrom.lng], [dirTo.lat, dirTo.lng]]}
                        color={routeColor} weight={3} dashArray="8 5" opacity={0.5}
                      />
                    )}
                  </>
                )}

                {/* Important place markers (detail view) */}
                {view === "detail" && profile?.important_places?.map((p, i) =>
                  p.lat && p.lng ? (
                    <Marker key={i} position={[p.lat, p.lng]} icon={placeIcon}>
                      <Popup>
                        <p className="text-sm font-semibold m-0">{p.label}</p>
                        <p className="text-xs text-slate-400 m-0">{p.address}</p>
                      </Popup>
                    </Marker>
                  ) : null
                )}
              </MapContainer>
            ) : (
              <div className="absolute inset-0 bg-slate-100 flex items-center justify-center">
                <div className="text-center text-slate-400">
                  <MapPin className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Map unavailable</p>
                </div>
              </div>
            )}
          </div>

        </div>
      </motion.div>
    </AnimatePresence>
  );
}
