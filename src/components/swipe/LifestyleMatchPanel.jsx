import React, { useState, useEffect } from "react";
import { CheckCircle2, XCircle, Clock, MapPin, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

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
  const [travelData, setTravelData] = useState(null);
  const [loadingTravel, setLoadingTravel] = useState(false);

  useEffect(() => {
    if (!profile?.important_places?.length || !listing?.address) return;
    setTravelData(null);
    setLoadingTravel(true);

    base44.functions.invoke("estimateTravelTimes", {
      listing_address: listing.address,
      important_places: profile.important_places,
    })
      .then((res) => setTravelData(res.data))
      .catch(() => setTravelData(null))
      .finally(() => setLoadingTravel(false));
  }, [listing?.id, profile?.important_places]);

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

      {/* Important places travel times */}
      {hasImportantPlaces && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Important Places</p>
            {travelData?.average_minutes && (
              <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                avg ~{Math.round(travelData.average_minutes)} min
              </span>
            )}
          </div>

          {loadingTravel ? (
            <div className="flex items-center gap-2 text-xs text-slate-400 py-1">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Estimating travel times...
            </div>
          ) : (
            <div className="space-y-1">
              {(travelData?.places || profile.important_places).map((p, i) => {
                const mins = travelData?.places?.[i]?.minutes;
                return (
                  <div key={i} className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-xs text-slate-600">
                      <MapPin className="w-3 h-3 text-indigo-400 flex-shrink-0" />
                      {p.label || p.postal_code}
                    </span>
                    {mins != null ? (
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        mins <= 15 ? "bg-green-50 text-green-600" :
                        mins <= 30 ? "bg-yellow-50 text-yellow-600" :
                        "bg-red-50 text-red-500"
                      }`}>
                        ~{mins} min
                      </span>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}