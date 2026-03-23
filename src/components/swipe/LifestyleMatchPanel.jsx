import React from "react";
import { CheckCircle2, XCircle, MapPin, MinusCircle } from "lucide-react";

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

  const budgetBreakdown = scoreBreakdown?.budget;
  const locationBreakdown = scoreBreakdown?.location;
  const hasPriorityBreakdown = budgetBreakdown || locationBreakdown;

  return (
    <div className="mt-3 border border-slate-100 rounded-xl p-3 bg-slate-50 space-y-3">
      {/* Budget + Location (priority criteria) */}
      {hasPriorityBreakdown && (
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Hard Criteria</p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
            {budgetBreakdown && (
              <div className="flex items-center gap-1.5">
                {budgetBreakdown.status === 'full' ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                ) : budgetBreakdown.status === 'partial' ? (
                  <CheckCircle2 className="w-4 h-4 text-amber-400 flex-shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                )}
                <span className={`text-xs ${budgetBreakdown.status !== 'none' ? "text-slate-700" : "text-slate-400"}`}>
                  Budget {budgetBreakdown.status === 'partial' ? "(close)" : ""}
                </span>
              </div>
            )}
            {locationBreakdown && (
              <div className="flex items-center gap-1.5">
                {locationBreakdown.status === 'full' ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                )}
                <span className={`text-xs ${locationBreakdown.status !== 'none' ? "text-slate-700" : "text-slate-400"}`}>
                  Location
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Amenity matches */}
      {enabledPrefs.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Your Preferences</p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
            {enabledPrefs.map((key) => {
              const breakdown = scoreBreakdown?.[key];
              const noData = breakdown && breakdown.minutes === null;
              const matched = breakdown ? breakdown.status !== "none" : propertyMatchesAmenity(listing, key);
              const minutes = breakdown?.minutes;
              return (
                <div key={key} className="flex items-center gap-1.5">
                  {noData ? (
                    <MinusCircle className="w-4 h-4 text-slate-300 flex-shrink-0" />
                  ) : matched ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  )}
                  <span className={`text-xs ${noData ? "text-slate-300" : matched ? "text-slate-700" : "text-slate-400"}`}>
                    {AMENITY_LABELS[key]}{minutes != null ? ` (${minutes}min)` : noData ? " (no data)" : ""}
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
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
            {profile.important_places.map((p, i) => {
              const bd = scoreBreakdown?.[`place_${p.label}`];
              const modeIcon = { walk: "🚶", commute: "🚌", drive: "🚗" }[p.mode || "commute"];
              return (
                <div key={i} className="flex items-center gap-1.5">
                  {bd ? (
                    bd.status === "full" ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                    ) : bd.status === "partial" ? (
                      <CheckCircle2 className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                    )
                  ) : (
                    <MapPin className="w-4 h-4 text-slate-300 flex-shrink-0" />
                  )}
                  <span className={`text-xs ${!bd ? "text-slate-400" : bd.status !== "none" ? "text-slate-700" : "text-slate-400"}`}>
                    {p.label}
                    {bd?.minutes != null ? ` ${modeIcon}${bd.minutes}min` : ""}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}