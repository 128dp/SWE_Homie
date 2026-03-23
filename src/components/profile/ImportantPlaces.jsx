import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Plus, X, MapPin, Loader2 } from "lucide-react";

const SUGGESTIONS = ["Child's school", "Parents' house", "Workplace", "Partner's workplace", "Place of worship"];

const MODES = [
  { value: "walk", label: "🚶 Walk" },
  { value: "commute", label: "🚌 Commute" },
  { value: "drive", label: "🚗 Drive" },
];

function detectMode(text) {
  const t = text.toLowerCase();
  if (/\bwalk\b/.test(t)) return "walk";
  if (/\bdrive\b|\bcar\b|\bdriving\b/.test(t)) return "drive";
  if (/\bcommute\b|\btransit\b|\bmrt\b|\bbus\b/.test(t)) return "commute";
  return null;
}

function AddressSearch({ onSelect }) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => { if (!wrapperRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const search = (q) => {
    clearTimeout(debounceRef.current);
    if (q.length < 3) { setSuggestions([]); setOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${encodeURIComponent(q)}&returnGeom=Y&getAddrDetails=Y&pageNum=1`
        );
        const data = await res.json();
        setSuggestions(data.results?.slice(0, 6) || []);
        setOpen(true);
      } catch {}
      setLoading(false);
    }, 300);
  };

  const handleSelect = (result) => {
    onSelect({
      address: result.ADDRESS,
      lat: parseFloat(result.LATITUDE),
      lng: parseFloat(result.LONGITUDE),
    });
    setQuery("");
    setSuggestions([]);
    setOpen(false);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-slate-400" />}
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); search(e.target.value); }}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder="Search Singapore address..."
          className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
        />
      </div>
      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-md shadow-lg max-h-52 overflow-y-auto">
          {suggestions.map((r, i) => (
            <li
              key={i}
              onMouseDown={() => handleSelect(r)}
              className="px-3 py-2 text-sm cursor-pointer hover:bg-orange-50 border-b border-slate-50 last:border-0"
            >
              <span className="font-medium text-slate-800">{r.BUILDING !== "NIL" ? r.BUILDING : r.ROAD_NAME}</span>
              <span className="block text-xs text-slate-400 truncate">{r.ADDRESS}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const modeLabel = (m) => MODES.find((x) => x.value === m)?.label || "🚌 Commute";

export default function ImportantPlaces({ places, onChange }) {
  const [label, setLabel] = useState("");
  const [address, setAddress] = useState(null); // { address, lat, lng }
  const [mode, setMode] = useState("commute");
  const [minutes, setMinutes] = useState(20);

  const handleLabelChange = (val) => {
    setLabel(val);
    const detected = detectMode(val);
    if (detected) setMode(detected);
  };

  const add = () => {
    if (!label.trim() || !address) return;
    if (places.length >= 5) return;
    onChange([...places, { label: label.trim(), address: address.address, lat: address.lat, lng: address.lng, mode, minutes }]);
    setLabel("");
    setAddress(null);
    setMode("commute");
    setMinutes(20);
  };

  return (
    <div className="space-y-4">
      {/* Existing places */}
      {places.length > 0 && (
        <div className="space-y-2">
          {places.map((place, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-white">
              <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
                <MapPin className="w-4 h-4 text-orange-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800">{place.label}</p>
                <p className="text-xs text-slate-400 truncate">{place.address || place.postal_code}</p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                  {modeLabel(place.mode || "commute")}
                </span>
                <span className="text-xs text-slate-400">≤{place.minutes || 20}min</span>
              </div>
              <button onClick={() => onChange(places.filter((_, idx) => idx !== i))} className="p-1 text-red-400 hover:text-red-600">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add new */}
      {places.length < 5 && (
        <div className="space-y-3 p-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/50">
          <p className="text-xs font-medium text-slate-500">Add a place ({places.length}/5)</p>

          {/* Label suggestions */}
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTIONS.filter((s) => !places.find((p) => p.label === s)).map((s) => (
              <button
                key={s}
                onClick={() => handleLabelChange(s)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                  label === s
                    ? "border-orange-400 bg-orange-50 text-orange-700"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <input
            placeholder="Label (e.g. Child's school)"
            value={label}
            onChange={(e) => handleLabelChange(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
          />

          {/* Address search */}
          <AddressSearch onSelect={(result) => setAddress(result)} />
          {address && (
            <p className="text-xs text-green-600 flex items-center gap-1">
              <MapPin className="w-3 h-3" /> {address.address}
            </p>
          )}

          {/* Travel time threshold */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Must reach within</span>
            <input
              type="number"
              min={5}
              max={120}
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
              className="w-14 px-2 py-1 border border-slate-200 rounded-md text-sm text-center focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
            />
            <span className="text-xs text-slate-500">min</span>
          </div>

          {/* Mode selector */}
          <div>
            <p className="text-xs text-slate-500 mb-1.5">How will you get there?</p>
            <div className="flex gap-2">
              {MODES.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setMode(m.value)}
                  className={`flex-1 text-xs py-1.5 rounded-lg border transition-all ${
                    mode === m.value
                      ? "border-orange-400 bg-orange-50 text-orange-700 font-medium"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={add}
            disabled={!label.trim() || !address}
            size="sm"
            className="w-full bg-orange-600 hover:bg-orange-500"
          >
            <Plus className="w-4 h-4 mr-1" /> Add Place
          </Button>
        </div>
      )}

      {places.length === 5 && (
        <p className="text-xs text-slate-400 text-center">Maximum of 5 important places reached.</p>
      )}
    </div>
  );
}
