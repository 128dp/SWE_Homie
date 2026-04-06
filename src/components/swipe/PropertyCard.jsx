import React from "react";
import { Badge } from "@/components/ui/badge";
import { MapPin, Bed, Maximize2, ChevronRight } from "lucide-react";
import LifestyleMatchPanel from "./LifestyleMatchPanel";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";

export default function PropertyCard({ listing, lifeScore, scoreBreakdown, profile, onExpand }) {
  const typeLabels = {
    hdb: "HDB",
    condo: "Condo",
    landed: "Landed",
    executive_condo: "EC",
  };

  

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-lg border border-slate-100 max-w-md w-full mx-auto">
      {/* Image */}
      
      <div className="relative h-52 overflow-hidden">
        <Swiper
          modules={[Navigation]}
          navigation
          slidesPerView={1}
          className="w-full h-full"
        >
          {(listing.photos && listing.photos.length > 0
            ? listing.photos
            : ["https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&q=80"]
          ).map((url, idx) => (
            <SwiperSlide key={idx}>
              <img
                src={url}
                alt={`${listing.title}-${idx}`}
                className="w-full h-full object-cover"
              />
            </SwiperSlide>
          ))}
        </Swiper>

        {/* Badge (top-left) */}
        <div className="absolute top-3 left-3 z-10">
          <Badge className="bg-white/90 text-slate-800 backdrop-blur-sm font-medium">
            {typeLabels[listing.property_type] || listing.property_type}
          </Badge>
        </div>

        {/* Score (top-right) */}
        <div className="absolute top-3 right-3 z-10">
          <div className="relative w-14 h-14 flex items-center justify-center">
            <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 56 56">
              <circle cx="28" cy="28" r="23" fill="rgba(0,0,0,0.45)" stroke="rgba(255,255,255,0.15)" strokeWidth="4" />
              <circle
                cx="28" cy="28" r="23"
                fill="none"
                stroke={lifeScore >= 70 ? "#22c55e" : lifeScore >= 40 ? "#f97316" : "#ef4444"}
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 23}`}
                strokeDashoffset={`${2 * Math.PI * 23 * (1 - (lifeScore || 0) / 100)}`}
              />
            </svg>
            <span className="relative text-white font-bold text-xs">
              {lifeScore != null ? lifeScore : "--"}%
            </span>
          </div>
        </div>

        {/* Overlay (BOTTOM) */}
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-4 z-10">
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

        <LifestyleMatchPanel listing={listing} profile={profile} scoreBreakdown={scoreBreakdown} />

        <button
          onClick={e => { e.stopPropagation(); onExpand?.(); }}
          className="mt-3 -mx-4 -mb-4 px-4 py-3 flex items-center justify-between border-t border-slate-100 hover:bg-slate-50 transition-colors rounded-b-2xl w-[calc(100%+2rem)]"
        >
          <span className="text-xs font-semibold text-slate-500">View details & map</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        </button>
      </div>
    </div>
  );
}