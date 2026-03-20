import React from "react";
import { Badge } from "@/components/ui/badge";
import { MapPin, Bed, Maximize2 } from "lucide-react";
import LifestyleMatchPanel from "./LifestyleMatchPanel";

export default function PropertyCard({ listing, lifeScore, profile }) {
  const typeLabels = {
    hdb: "HDB",
    condo: "Condo",
    landed: "Landed",
    executive_condo: "EC",
  };

  const mainPhoto = listing.photos?.[0] || "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&q=80";

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-lg border border-slate-100 max-w-md w-full mx-auto">
      {/* Image */}
      <div className="relative h-64 overflow-hidden">
        <img src={mainPhoto} alt={listing.title} className="w-full h-full object-cover" />
        <div className="absolute top-3 left-3">
          <Badge className="bg-white/90 text-slate-800 backdrop-blur-sm font-medium">
            {typeLabels[listing.property_type] || listing.property_type}
          </Badge>
        </div>
        <div className="absolute top-3 right-3">
          <div className="bg-orange-700/90 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-sm font-bold">
            {lifeScore || "--"}% Match
          </div>
        </div>
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-4">
          <h2 className="text-white font-bold text-lg">{listing.title}</h2>
          <div className="flex items-center gap-1 text-white/80 text-sm mt-0.5">
            <MapPin className="w-3.5 h-3.5" />
            {listing.address}
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-2xl font-bold text-slate-900">
            ${listing.price?.toLocaleString()}
          </span>
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <span className="flex items-center gap-1"><Bed className="w-4 h-4" />{listing.num_bedrooms} BR</span>
            {listing.floor_area_sqm && (
              <span className="flex items-center gap-1"><Maximize2 className="w-4 h-4" />{listing.floor_area_sqm} sqm</span>
            )}
          </div>
        </div>

        {listing.description && (
          <p className="text-sm text-slate-500 line-clamp-2 mb-3">{listing.description}</p>
        )}

        {listing.lifestyle_tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {listing.lifestyle_tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs bg-slate-50">
                {tag.replace(/_/g, " ")}
              </Badge>
            ))}
          </div>
        )}

        <LifestyleMatchPanel listing={listing} profile={profile} />
      </div>
    </div>
  );
}