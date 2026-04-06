import React, { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X, Search } from "lucide-react";

export default function CustomAmenities({ amenities = [], onChange }) {
  const [query, setQuery] = useState("");
  const [minutes, setMinutes] = useState(10);
  const [mode, setMode] = useState("walk");

  const handleAdd = () => {
    if (!query) return;
    onChange([...amenities, { label: query, query, minutes, mode }]);
    setQuery("");
    setMinutes(10);
    setMode("walk");
  };

  const handleRemove = (index) => {
    onChange(amenities.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      {/* Existing custom amenities */}
      {amenities.map((a, i) => (
        <div key={i} className="flex items-center justify-between rounded-xl border border-orange-200 bg-orange-50/40 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-slate-800">{a.label}</p>
            <p className="text-xs text-slate-500">Within {a.minutes} min · {a.mode}</p>
          </div>
          <button onClick={() => handleRemove(i)} className="text-slate-400 hover:text-red-500">
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}

      {/* Search input */}
      <div className="relative">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. yoga studio, pet shop..."
              className="pl-9"
            />
          </div>
          <Input
            type="number"
            min={1}
            max={120}
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
            className="w-16 h-10 text-sm text-center"
          />
          <span className="text-xs text-slate-500 whitespace-nowrap">min</span>
          <Select value={mode} onValueChange={setMode}>
            <SelectTrigger className="w-28 h-10 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="walk">🚶 walk</SelectItem>
              <SelectItem value="commute">🚌 commute</SelectItem>
            </SelectContent>
          </Select>
          <Button
            type="button"
            size="sm"
            onClick={handleAdd}
            disabled={!query}
            className="bg-orange-600 hover:bg-orange-500 h-10"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>

      </div>
    </div>
  );
}