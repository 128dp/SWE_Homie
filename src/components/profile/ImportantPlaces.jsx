import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, X, MapPin } from "lucide-react";

const SUGGESTIONS = ["Child's school", "Parents' house", "Workplace", "Partner's workplace", "Place of worship"];

const MODES = [
  { value: "walk", label: "🚶 Walk" },
  { value: "commute", label: "🚌 Commute" },
  { value: "drive", label: "🚗 Drive" },
];

export default function ImportantPlaces({ places, onChange }) {
  const [label, setLabel] = useState("");
  const [postal, setPostal] = useState("");
  const [mode, setMode] = useState("commute");

  const add = () => {
    if (!label.trim() || !postal.trim()) return;
    if (places.length >= 5) return;
    onChange([...places, { label: label.trim(), postal_code: postal.trim(), mode }]);
    setLabel("");
    setPostal("");
    setMode("commute");
  };

  const remove = (i) => onChange(places.filter((_, idx) => idx !== i));

  const isValidPostal = (p) => /^\d{6}$/.test(p);

  const modeLabel = (m) => MODES.find((x) => x.value === m)?.label || "🚌 Commute";

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
                <p className="text-xs text-slate-400">Postal code: {place.postal_code}</p>
              </div>
              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full flex-shrink-0">
                {modeLabel(place.mode || "commute")}
              </span>
              <button onClick={() => remove(i)} className="p-1 text-red-400 hover:text-red-600">
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
                onClick={() => setLabel(s)}
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

          <Input
            placeholder="Label (e.g. Child's school)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="bg-white"
          />

          <div className="flex gap-2">
            <Input
              placeholder="6-digit postal code"
              value={postal}
              maxLength={6}
              onChange={(e) => setPostal(e.target.value.replace(/\D/g, ""))}
              className={`bg-white ${postal && !isValidPostal(postal) ? "border-red-300" : ""}`}
            />
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

          {postal && !isValidPostal(postal) && (
            <p className="text-xs text-red-500">Please enter a valid 6-digit Singapore postal code.</p>
          )}

          <Button
            onClick={add}
            disabled={!label.trim() || !isValidPostal(postal)}
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