import React, { useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  X, MapPin, CheckCircle2, XCircle, MinusCircle,
  Bed, Maximize2, Loader2,
  Train, Bus, UtensilsCrossed, ShoppingCart, Trees, Hospital, Stethoscope,
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

// ─── Pin icons ────────────────────────────────────────────────────────────────
function makeHomeIcon() {
  return new L.DivIcon({
    html: `<div style="display:flex;flex-direction:column;align-items:center;gap:2px">
      <div style="width:16px;height:16px;border-radius:50%;background:#ea580c;border:3px solid white;box-shadow:0 2px 8px rgba(234,88,12,0.5)"></div>
    </div>`,
    className: "",
    iconAnchor: [8, 8],
    iconSize: [16, 16],
  });
}

function makePinIcon(color, shortLabel, active = false) {
  const d = active ? 14 : 10;
  const border = active ? `3px solid white` : `2px solid white`;
  const glow = active
    ? `box-shadow:0 0 0 3px ${color}40,0 2px 10px rgba(0,0,0,0.4)`
    : `box-shadow:0 1px 5px rgba(0,0,0,0.3)`;
  // Label only shown when active — prevents overlap when many pins are close
  const label = active
    ? `<div style="background:${color};color:white;font-size:9px;font-weight:700;padding:2px 7px;border-radius:99px;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,0.2);line-height:1.6;max-width:100px;overflow:hidden;text-overflow:ellipsis;margin-top:3px">${shortLabel}</div>`
    : "";
  return new L.DivIcon({
    html: `<div style="display:flex;flex-direction:column;align-items:center;pointer-events:none">
      <div style="width:${d}px;height:${d}px;border-radius:50%;background:${color};border:${border};${glow}"></div>
      ${label}
    </div>`,
    className: "",
    iconAnchor: [Math.ceil(d / 2), Math.ceil(d / 2)],
  });
}

const homeIcon = makeHomeIcon();

// ─── Map controller ───────────────────────────────────────────────────────────
function MapController({ target, home, zoom = 16 }) {
  const map = useMap();
  const prev = useRef(null);
  useEffect(() => {
    const dest = target ?? home;
    if (dest && dest !== prev.current) {
      prev.current = dest;
      map.flyTo(dest, target ? zoom : 15, { duration: 0.5 });
    }
  }, [target]);
  return null;
}

// Opens the Leaflet popup on the marker when active
function AutoPopup({ markerRef, active }) {
  useEffect(() => {
    if (!markerRef.current) return;
    if (active) markerRef.current.openPopup();
    else markerRef.current.closePopup();
  }, [active]);
  return null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000, r = d => d * Math.PI / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function clip(str, n) { return str?.length > n ? str.slice(0, n - 1) + "…" : str; }

const AMENITY_TABLE_MAP = {
  mrt: "amenity_mrt", hawker: "amenity_hawker",
  supermarket: "amenity_supermarket", parks: "amenity_park",
  hospital: "amenity_hospital", polyclinic: "amenity_polyclinic",
};

// Pin color, list icon color, list bg
const AMENITY_META = {
  mrt:         { label: "MRT",         Icon: Train,           color: "#2563eb", pin: "#3b82f6", bg: "#eff6ff" },
  bus:         { label: "Bus Stop",    Icon: Bus,             color: "#0891b2", pin: "#06b6d4", bg: "#ecfeff" },
  hawker:      { label: "Hawker",      Icon: UtensilsCrossed, color: "#ea580c", pin: "#f97316", bg: "#fff7ed" },
  supermarket: { label: "Supermarket", Icon: ShoppingCart,    color: "#16a34a", pin: "#22c55e", bg: "#f0fdf4" },
  parks:       { label: "Parks",       Icon: Trees,           color: "#15803d", pin: "#4ade80", bg: "#f0fdf4" },
  hospital:    { label: "Hospital",    Icon: Hospital,        color: "#dc2626", pin: "#f87171", bg: "#fef2f2" },
  polyclinic:  { label: "Polyclinic",  Icon: Stethoscope,     color: "#9333ea", pin: "#a855f7", bg: "#faf5ff" },
};

const TYPE_LABELS = { hdb: "HDB", condo: "Condo", landed: "Landed", executive_condo: "EC" };

// ─── Main panel ───────────────────────────────────────────────────────────────
export default function PropertyDetailPanel({ listing, profile, scoreBreakdown, lifeScore, onClose }) {
  const [focusedKey,  setFocusedKey]  = useState(null);
  const [amenityLocs, setAmenityLocs] = useState({});   // key → { lat, lng, label }
  const [loadingLocs, setLoadingLocs] = useState(true);
  const markerRefs = useRef({});  // key → leaflet marker ref

  const hasCoords  = !!(listing.lat && listing.lng);
  const scoreColor = lifeScore >= 70 ? "#22c55e" : lifeScore >= 40 ? "#f97316" : "#ef4444";

  const focusedLoc = focusedKey ? amenityLocs[focusedKey] : null;
  // When a pin is focused, fly to it. When cleared via Back button, fly home.
  const mapTarget  = focusedLoc ? [focusedLoc.lat, focusedLoc.lng] : null;

  // ── Fetch all amenity pin coords on mount ──────────────────────────────────
  useEffect(() => {
    if (!hasCoords || !scoreBreakdown) { setLoadingLocs(false); return; }

    const locs = {};
    const tasks = [];

    for (const [key] of Object.entries(AMENITY_META)) {
      const bd = scoreBreakdown[key];
      if (!bd) continue;

      // Bus: use precomputed coords if available, else fall back to Overpass
      if (key === "bus") {
        if (bd.lat != null && bd.lng != null) {
          locs.bus = { lat: bd.lat, lng: bd.lng, label: bd.name || "Bus Stop" };
        } else {
          // Fallback: query Overpass directly (POST with timeout)
          tasks.push((async () => {
            try {
              const query = `[out:json][timeout:10];node(around:400,${listing.lat},${listing.lng})[highway=bus_stop];out 1;`;
              const controller = new AbortController();
              const timer = setTimeout(() => controller.abort(), 12000);
              const res = await fetch("https://overpass-api.de/api/interpreter", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: `data=${encodeURIComponent(query)}`,
                signal: controller.signal,
              });
              clearTimeout(timer);
              const data = await res.json();
              const node = data.elements?.[0];
              if (node) locs.bus = { lat: node.lat, lng: node.lon, label: node.tags?.name || node.tags?.ref || "Bus Stop" };
            } catch {}
          })());
        }
        continue;
      }

      if (!bd.name) continue;
      const table = AMENITY_TABLE_MAP[key];
      if (!table) continue;

      tasks.push(
        supabase.from(table).select("lat,lng").eq("name", bd.name).then(({ data }) => {
          if (!data?.length) return;
          const nearest = data.reduce((best, row) => {
            const d = haversine(listing.lat, listing.lng, row.lat, row.lng);
            return d < best.d ? { row, d } : best;
          }, { row: data[0], d: Infinity }).row;
          locs[key] = { lat: nearest.lat, lng: nearest.lng, label: bd.name };
        })
      );
    }

    // Custom amenities — coords already in breakdown
    for (const custom of (profile?.custom_amenities || [])) {
      const bd = scoreBreakdown[`custom_${custom.query}`];
      if (bd?.lat != null && bd?.lng != null) {
        locs[`custom_${custom.query}`] = { lat: bd.lat, lng: bd.lng, label: custom.label };
      }
    }

    // Important places — coords on place object
    for (let i = 0; i < (profile?.important_places || []).length; i++) {
      const p = profile.important_places[i];
      if (p.lat && p.lng) locs[`place_${i}`] = { lat: p.lat, lng: p.lng, label: p.label };
    }

    Promise.all(tasks).then(() => {
      setAmenityLocs({ ...locs });
      setLoadingLocs(false);
    });
  }, [listing.id]);

  const toggleFocus = (key) => setFocusedKey(prev => prev === key ? null : key);

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
          {/* Close */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-[9999] p-1.5 bg-white rounded-full shadow-md border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>

          {/* ── LEFT PANEL ── */}
          <div className="w-64 flex-shrink-0 flex flex-col border-r border-slate-100 overflow-hidden">

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

            {/* Scrollable amenity list */}
            <div className="flex-1 overflow-y-auto">
              <div className="px-3 py-3 space-y-4">

                {scoreBreakdown && Object.keys(AMENITY_META).some(k => scoreBreakdown[k]) && (
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Nearby — tap to highlight
                    </p>
                    <div className="space-y-0.5">
                      {Object.entries(AMENITY_META).map(([key, { label, Icon, color, bg }]) => {
                        const bd       = scoreBreakdown[key];
                        if (!bd) return null;
                        const active   = focusedKey === key;
                        const hasLoc   = !!amenityLocs[key];
                        const noData   = bd.minutes === null;
                        return (
                          <button
                            key={key}
                            onClick={() => hasLoc && toggleFocus(key)}
                            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all ${
                              active  ? "ring-1 ring-inset"
                              : noData  ? "opacity-40 cursor-default"
                              : hasLoc  ? "hover:bg-slate-50 cursor-pointer"
                              :           "cursor-default"
                            }`}
                            style={active ? { backgroundColor: color + "10", outline: `1px solid ${color}` } : {}}
                          >
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: active ? color + "20" : bg }}>
                              <Icon className="w-3.5 h-3.5" style={{ color }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-slate-700 truncate">{label}</p>
                              {bd.name && <p className="text-[10px] text-slate-400 truncate">{bd.name}</p>}
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {bd.minutes != null && (
                                <span className={`text-xs font-bold tabular-nums ${
                                  bd.status === "full" ? "text-green-600"
                                  : bd.status === "partial" ? "text-amber-500"
                                  : "text-slate-400"
                                }`}>
                                  {bd.minutes} min
                                </span>
                              )}
                              {noData    ? <MinusCircle className="w-3.5 h-3.5 text-slate-300" />
                              : loadingLocs && !hasLoc ? <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-300" />
                              : active    ? <CheckCircle2 className="w-3.5 h-3.5" style={{ color }} />
                              : bd.status === "none" ? <XCircle className="w-3.5 h-3.5 text-red-400" />
                              : <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
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
                        const key    = `custom_${custom.query}`;
                        const bd     = scoreBreakdown?.[key];
                        const active = focusedKey === key;
                        const hasLoc = !!amenityLocs[key];
                        return (
                          <button key={i}
                            onClick={() => hasLoc && toggleFocus(key)}
                            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all ${
                              active  ? "bg-indigo-50 ring-1 ring-indigo-200"
                              : hasLoc  ? "hover:bg-slate-50 cursor-pointer"
                              :           "opacity-40 cursor-default"
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
                                }`}>{bd.minutes} min</span>
                              )}
                              {!bd ? <MinusCircle className="w-3.5 h-3.5 text-slate-300" />
                                : active ? <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500" />
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
                        const key    = `place_${i}`;
                        const bd     = scoreBreakdown?.[`place_${place.label}`];
                        const active = focusedKey === key;
                        const hasLoc = !!amenityLocs[key];
                        return (
                          <button key={i}
                            onClick={() => hasLoc && toggleFocus(key)}
                            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all ${
                              active  ? "bg-indigo-50 ring-1 ring-indigo-200"
                              : hasLoc  ? "hover:bg-slate-50 cursor-pointer"
                              :           "opacity-40 cursor-default"
                            }`}
                          >
                            <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                              <MapPin className="w-3.5 h-3.5 text-indigo-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-slate-700 truncate">{place.label}</p>
                              <p className="text-[10px] text-slate-400">
                                { { walk: "🚶", commute: "🚌", drive: "🚗" }[place.mode || "commute"] }
                                {" "}{place.mode || "commute"} · target {place.minutes}min
                              </p>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {bd?.minutes != null && (
                                <span className={`text-xs font-bold tabular-nums ${
                                  bd.status === "full" ? "text-green-600"
                                  : bd.status === "partial" ? "text-amber-500"
                                  : "text-slate-400"
                                }`}>{bd.minutes} min</span>
                              )}
                              {active ? <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500" /> : null}
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
          </div>

          {/* ── RIGHT: persistent map ── */}
          <div className="flex-1 relative min-w-0">
            {/* Floating "back to listing" button — shown when a pin is focused */}
            {focusedKey && hasCoords && (
              <button
                onClick={() => {
                  setFocusedKey(null);
                  // MapController watches target — setting to null triggers home fly via target ?? home
                }}
                className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-full shadow-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <MapPin className="w-3.5 h-3.5 text-orange-500" /> Back to listing
              </button>
            )}
            {hasCoords ? (
              <MapContainer
                center={[listing.lat, listing.lng]}
                zoom={15}
                scrollWheelZoom
                zoomControl
                style={{ position: "absolute", inset: 0 }}
              >
                <TileLayer
                  url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                  attribution="© OpenStreetMap contributors © CARTO"
                />

                <MapController target={mapTarget} home={hasCoords ? [listing.lat, listing.lng] : null} zoom={16} />

                {/* Home marker */}
                <Marker position={[listing.lat, listing.lng]} icon={homeIcon}>
                  <Popup><p className="text-xs font-semibold m-0">{listing.title}</p></Popup>
                </Marker>

                {/* All amenity pins — color-coded, shown at once */}
                {Object.entries(amenityLocs).map(([key, loc]) => {
                  const meta   = AMENITY_META[key];
                  const bd     = scoreBreakdown?.[key] ?? scoreBreakdown?.[`custom_${key.replace("custom_", "")}`];
                  const active = focusedKey === key;
                  const pinColor = meta?.pin ?? "#6366f1";
                  const shortLabel = clip(loc.label, 16);
                  if (!markerRefs.current[key]) markerRefs.current[key] = React.createRef();
                  const markerRef = markerRefs.current[key];
                  return (
                    <Marker
                      key={key}
                      ref={markerRef}
                      position={[loc.lat, loc.lng]}
                      icon={makePinIcon(pinColor, shortLabel, active)}
                      eventHandlers={{ click: () => toggleFocus(key) }}
                    >
                      <AutoPopup markerRef={markerRef} active={active} />
                      <Popup>
                        <div style={{ minWidth: 120 }}>
                          <p className="text-xs font-semibold m-0" style={{ color: pinColor }}>{meta?.label ?? loc.label}</p>
                          <p className="text-[11px] text-slate-600 m-0 mt-0.5 font-medium">{loc.label}</p>
                          {bd?.minutes != null && (
                            <p className="text-[11px] text-slate-400 m-0 mt-0.5">{bd.minutes} min away</p>
                          )}
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
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
