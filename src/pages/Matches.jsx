import React, { useState, useEffect } from "react";
import { base44, supabase } from "@/api/base44Client";
import { createPageUrl } from "../utils";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageSquare, Loader2, Heart, ChevronDown, ChevronUp, GitCompare, Bed, Maximize2, MapPin } from "lucide-react";
import PropertyNotePanel from "@/components/matches/PropertyNotePanel";
import ComparisonTool from "@/components/matches/ComparisonTool";
import LifestyleMatchPanel from "@/components/swipe/LifestyleMatchPanel";

export default function Matches() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [expandedNotes, setExpandedNotes] = useState(null);
  const [showComparison, setShowComparison] = useState(false);

  useEffect(() => {
    const load = async () => {
      const me = await base44.auth.me();
      setUser(me);
      const isAgent = me.user_type === "agent";
      let data;
      if (isAgent) {
        data = await base44.entities.Match.filter({ agent_id: me.id });
      } else {
        data = await base44.entities.Match.filter({ buyer_id: me.id });
      }
      const sorted = (data || []).sort((a, b) => (b.compatibility_score ?? 0) - (a.compatibility_score ?? 0));

      // Load profile + listing details + score breakdowns in parallel
      const listingIds = sorted.map(m => m.listing_id).filter(Boolean);
      const [profileRes, listingsRes, scoresRes] = await Promise.all([
        base44.entities.LifestyleProfile.filter({ user_id: me.id }),
        listingIds.length > 0 ? supabase.from('listings').select('*').in('id', listingIds) : { data: [] },
        listingIds.length > 0 ? supabase.from('lifestyle_scores').select('listing_id, score_breakdown').eq('user_id', me.id).in('listing_id', listingIds) : { data: [] },
      ]);

      if (profileRes.length > 0) setProfile(profileRes[0]);

      const listingMap = {};
      (listingsRes.data || []).forEach(l => { listingMap[l.id] = l; });

      const scoreMap = {};
      (scoresRes.data || []).forEach(s => { scoreMap[s.listing_id] = s.score_breakdown; });

      setMatches(sorted.map(m => ({
        ...m,
        listing: listingMap[m.listing_id] || null,
        scoreBreakdown: scoreMap[m.listing_id] || {},
      })));
      setLoading(false);
    };
    load();
    window.addEventListener('focus', load);
    return () => window.removeEventListener('focus', load);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    );
  }

  const isBuyer = user?.user_type !== "agent";

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Matches</h1>
          <p className="text-slate-500 mt-1">
            {isBuyer ? "Properties you liked" : "Buyers interested in your listings"}
          </p>
        </div>
        {isBuyer && matches.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setShowComparison(!showComparison)}
          >
            <GitCompare className="w-4 h-4" />
            Compare
          </Button>
        )}
      </div>

      {/* Comparison tool */}
      {showComparison && isBuyer && (
        <Card className="p-5 mb-6 border-orange-100 bg-orange-50/20">
          <ComparisonTool
            matches={matches}
            user={user}
            onClose={() => setShowComparison(false)}
          />
        </Card>
      )}

      {matches.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <Heart className="w-6 h-6 text-slate-300" />
          </div>
          <h3 className="font-medium text-slate-700">No matches yet</h3>
          <p className="text-sm text-slate-500 mt-1">
            {isBuyer ? "Start swiping to find your perfect home!" : "Matches will appear when buyers swipe right on your listings."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {matches.map((match) => (
            <Card key={match.id} className="border-slate-100 overflow-hidden">
              {isBuyer && match.listing && (
                <div className="relative h-32 overflow-hidden">
                  <img
                    src={match.listing.photos?.[0] || "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&q=80"}
                    alt={match.listing_title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-2 left-3 right-3">
                    <p className="text-white font-semibold text-sm">{match.listing_title}</p>
                    <p className="text-white/70 text-xs flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3" />{match.listing.address}
                    </p>
                  </div>
                  <div className="absolute top-2 right-2">
                    <div className="relative w-14 h-14 flex items-center justify-center">
                      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 56 56">
                        <circle cx="28" cy="28" r="23" fill="rgba(0,0,0,0.45)" stroke="rgba(255,255,255,0.15)" strokeWidth="4" />
                        <circle
                          cx="28" cy="28" r="23"
                          fill="none"
                          stroke={match.compatibility_score >= 70 ? "#22c55e" : match.compatibility_score >= 40 ? "#f97316" : "#ef4444"}
                          strokeWidth="4"
                          strokeLinecap="round"
                          strokeDasharray={`${2 * Math.PI * 23}`}
                          strokeDashoffset={`${2 * Math.PI * 23 * (1 - (match.compatibility_score || 0) / 100)}`}
                        />
                      </svg>
                      <span className="relative text-white font-bold text-xs leading-none text-center">
                        {match.compatibility_score ?? "--"}<span className="font-normal opacity-80">%</span>
                      </span>
                    </div>
                  </div>
                </div>
              )}
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {(!isBuyer || !match.listing) && (
                    <div className="relative w-14 h-14 flex items-center justify-center flex-shrink-0">
                      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 56 56">
                        <circle cx="28" cy="28" r="23" fill="#fff7ed" stroke="#fed7aa" strokeWidth="4" />
                        <circle
                          cx="28" cy="28" r="23"
                          fill="none"
                          stroke={match.compatibility_score >= 70 ? "#22c55e" : match.compatibility_score >= 40 ? "#f97316" : "#ef4444"}
                          strokeWidth="4"
                          strokeLinecap="round"
                          strokeDasharray={`${2 * Math.PI * 23}`}
                          strokeDashoffset={`${2 * Math.PI * 23 * (1 - (match.compatibility_score || 0) / 100)}`}
                        />
                      </svg>
                      <span className="relative text-slate-800 font-bold text-xs leading-none text-center">
                        {match.compatibility_score ?? "--"}<span className="font-normal opacity-70">%</span>
                      </span>
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-slate-900">
                      {isBuyer ? (
                        match.listing ? (
                          <span className="flex items-center gap-3 text-sm text-slate-600">
                            <span className="font-bold text-slate-900">${match.listing.price?.toLocaleString()}</span>
                            <span className="flex items-center gap-1"><Bed className="w-3.5 h-3.5" />{match.listing.num_bedrooms} BR</span>
                            {match.listing.floor_area_sqm && <span className="flex items-center gap-1"><Maximize2 className="w-3.5 h-3.5" />{match.listing.floor_area_sqm} sqm</span>}
                          </span>
                        ) : match.listing_title || "Property"
                      ) : (
                        <span className="flex flex-col gap-0.5">
                          <span>{match.buyer_name || "Buyer"}</span>
                          {match.listing_title && (
                            <span className="text-xs text-slate-400 font-normal flex items-center gap-1">
                              <MapPin className="w-3 h-3" />{match.listing_title}
                            </span>
                          )}
                        </span>
                      )}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="secondary" className="text-xs capitalize">{match.status}</Badge>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isBuyer && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-slate-500"
                      onClick={() => setExpandedNotes(expandedNotes === match.id ? null : match.id)}
                    >
                      Notes
                      {expandedNotes === match.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </Button>
                  )}
                  <Link to={createPageUrl(`ChatRoom?matchId=${match.id}`)}>
                    <Button size="sm" className="gap-2 bg-orange-600 hover:bg-orange-500">
                      <MessageSquare className="w-3.5 h-3.5" /> Chat
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Lifestyle match panel */}
              {isBuyer && match.listing && profile && (
                <div className="px-4 pb-3">
                  <LifestyleMatchPanel listing={match.listing} profile={profile} scoreBreakdown={match.scoreBreakdown} />
                </div>
              )}

              {/* Notes panel */}
              {isBuyer && expandedNotes === match.id && (
                <div className="border-t border-slate-100 p-4 bg-slate-50/50">
                  <PropertyNotePanel match={match} user={user} />
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}