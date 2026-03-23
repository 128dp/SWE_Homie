import React from "react";
import { CheckCircle2, XCircle, MapPin } from "lucide-react";

const TAG_MAP = {
  mrt: "mrt", near_mrt: "mrt",
  bus: "bus", near_bus: "bus",
  parks: "parks", greenery: "parks",
  hawker: "hawker", food: "hawker",
  supermarket: "supermarket",
  hospital: "hospital",
  polyclinic: "polyclinic",
};

const AMENITY_LABELS = {
  mrt: "MRT nearby",
  bus: "Bus stop nearby",
  parks: "Parks / Greenery",
  hawker: "Hawker centres",
  supermarket: "Supermarket",
  hospital: "Hospital",
  polyclinic: "Polyclinic",
};

function getEnabledPreferences(profile) {
  const keys = ["mrt", "bus", "parks", "hawker", "supermarket", "hospital", "polyclinic"];
  return keys.filter((k) => profile?.[`${k}_enabled`]);
}

function propertyMatchesAmenity(listing, amenityKey) {
  const tags = listing.lifestyle_tags || [];
  return tags.some((tag) => TAG_MAP[tag.toLowerCase()] === amenityKey);
}

export default function LifestyleMatchPanel({ listing, profile, scoreBreakdown }) {
  if (!profile) return null;

  const enabledPrefs = getEnabledPreferences(profile);
  const hasImportantPlaces = profile.important_places?.length > 0;
  if (enabledPrefs.length === 0 && !hasImportantPlaces) return null;

  return (
    <div className="mt-3 border border-slate-100 rounded-xl p-3 bg-slate-50 space-y-3">
      {/* Amenity matches */}
      {enabledPrefs.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Your Preferences</p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
            {enabledPrefs.map((key) => {
              const breakdown = scoreBreakdown?.[key];
              const matched = breakdown ? breakdown.status !== "none" : propertyMatchesAmenity(listing, key);
              const minutes = breakdown?.minutes;
              return (
                <div key={key} className="flex items-center gap-1.5">
                  {matched ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  )}
                  <span className={`text-xs ${matched ? "text-slate-700" : "text-slate-400"}`}>
                    {AMENITY_LABELS[key]}{minutes != null ? ` (${minutes}min)` : ""}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Important places */}
      {hasImportantPlaces && (
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Important Places</p>
          <div className="space-y-1">
            {profile.important_places.map((p, i) => (
              <div key={i} className="flex items-center gap-1 text-xs text-slate-600">
                <MapPin className="w-3 h-3 text-indigo-400 flex-shrink-0" />
                {p.label || p.postal_code}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}