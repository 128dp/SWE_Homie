import React, { useState } from "react";
import { X, ChevronUp, ChevronDown, Search, Star, GripVertical } from "lucide-react";
import { Input } from "@/components/ui/input";

const REGIONS = {
  Central: { color: "bg-red-500", text: "text-red-600", bg: "bg-red-50", towns: ["Bishan", "Bukit Merah", "Bukit Timah", "Downtown Core", "Geylang", "Kallang", "Marine Parade", "Novena", "Outram", "Queenstown", "River Valley", "Rochor", "Singapore River", "Southern Islands", "Straits View", "Tanglin", "Toa Payoh"] },
  East: { color: "bg-orange-400", text: "text-orange-600", bg: "bg-orange-50", towns: ["Bedok", "Changi", "Changi Bay", "Pasir Ris", "Paya Lebar", "Tampines"] },
  West: { color: "bg-green-500", text: "text-green-600", bg: "bg-green-50", towns: ["Boon Lay", "Bukit Batok", "Bukit Panjang", "Choa Chu Kang", "Clementi", "Jurong East", "Jurong West", "Pioneer", "Tengah", "Tuas", "Western Islands", "Western Water Catchment"] },
  North: { color: "bg-blue-500", text: "text-blue-600", bg: "bg-blue-50", towns: ["Central Water Catchment", "Lim Chu Kang", "Mandai", "Sembawang", "Simpang", "Sungei Kadut", "Woodlands", "Yishun"] },
  "North-East": { color: "bg-purple-500", text: "text-purple-600", bg: "bg-purple-50", towns: ["Ang Mo Kio", "Hougang", "North-Eastern Islands", "Punggol", "Sengkang", "Serangoon", "Seletar"] },
};

const ALL_TOWNS = Object.entries(REGIONS).flatMap(([region, data]) =>
  data.towns.map((town) => ({ town, region }))
);

function getRegion(townName) {
  for (const [region, data] of Object.entries(REGIONS)) {
    if (data.towns.includes(townName)) return region;
  }
  return null;
}

function RegionBadge({ region, small }) {
  if (!region) return null;
  const r = REGIONS[region];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${r.bg} ${r.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${r.color}`} />
      {region}
    </span>
  );
}

export default function TownRanker({ towns, onChange }) {
  const [activeRegion, setActiveRegion] = useState("All");
  const [search, setSearch] = useState("");

  const addTown = (townName) => {
    if (towns.length >= 5 || towns.includes(townName)) return;
    onChange([...towns, townName]);
  };

  const removeTown = (townName) => onChange(towns.filter((t) => t !== townName));

  const moveUp = (i) => {
    if (i === 0) return;
    const next = [...towns];
    [next[i - 1], next[i]] = [next[i], next[i - 1]];
    onChange(next);
  };

  const moveDown = (i) => {
    if (i === towns.length - 1) return;
    const next = [...towns];
    [next[i], next[i + 1]] = [next[i + 1], next[i]];
    onChange(next);
  };

  const rankLabel = (i) => {
    if (i === 0) return { label: "Top Choice", className: "text-amber-500 font-semibold" };
    if (i === 1) return { label: "2nd Choice", className: "text-slate-500" };
    if (i === 2) return { label: "3rd Choice", className: "text-orange-500 font-semibold" };
    return { label: `${i + 1}th Choice`, className: "text-slate-400" };
  };

  const filtered = ALL_TOWNS.filter(({ town, region }) => {
    const regionMatch = activeRegion === "All" || region === activeRegion;
    const searchMatch = town.toLowerCase().includes(search.toLowerCase());
    return regionMatch && searchMatch && !towns.includes(town);
  });

  return (
    <div className="space-y-4">
      {/* Region filter tabs */}
      <div className="flex flex-wrap gap-2">
        {["All", ...Object.keys(REGIONS)].map((r) => {
          const isActive = activeRegion === r;
          const rData = REGIONS[r];
          return (
            <button
              key={r}
              onClick={() => setActiveRegion(r)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                isActive
                  ? "border-orange-500 bg-orange-50 text-orange-700"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              {rData && <span className={`w-2 h-2 rounded-full ${rData.color}`} />}
              {r}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Add another town..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 border-orange-300 focus:border-orange-500"
        />
      </div>

      {/* Town suggestions */}
      {(search || activeRegion !== "All") && filtered.length > 0 && (
        <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
          {filtered.map(({ town, region }) => (
            <button
              key={town}
              onClick={() => { addTown(town); setSearch(""); }}
              disabled={towns.length >= 5}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:border-orange-300 hover:bg-orange-50 text-sm text-slate-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${REGIONS[region]?.color}`} />
              {town}
            </button>
          ))}
        </div>
      )}

      {/* Priority list */}
      {towns.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Your Priority List</p>
            <p className="text-xs text-slate-400 flex items-center gap-1"><GripVertical className="w-3 h-3" /> Use arrows to reorder</p>
          </div>
          <div className="space-y-2">
            {towns.map((town, i) => {
              const region = getRegion(town);
              const rank = rankLabel(i);
              return (
                <div key={town} className={`flex items-center gap-3 p-3 rounded-xl border ${i === 0 ? "border-amber-200 bg-amber-50/40" : "border-slate-100 bg-white"}`}>
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0 ${i === 0 ? "bg-amber-100 text-amber-600" : "bg-slate-100 text-slate-500"}`}>
                    {i === 0 ? <Star className="w-4 h-4" /> : i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 text-sm">{town}</p>
                    <RegionBadge region={region} />
                  </div>
                  <span className={`text-xs ${rank.className} hidden sm:block`}>{rank.label}</span>
                  <div className="flex flex-col gap-0.5">
                    <button onClick={() => moveUp(i)} disabled={i === 0} className="p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-20">
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => moveDown(i)} disabled={i === towns.length - 1} className="p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-20">
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <button onClick={() => removeTown(town)} className="p-1 text-red-400 hover:text-red-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {towns.length === 0 && !search && activeRegion === "All" && (
        <p className="text-sm text-slate-400 text-center py-4">Select a region or search to add towns to your priority list.</p>
      )}

      <p className="text-xs text-slate-400">{towns.length}/5 towns selected</p>
    </div>
  );
}