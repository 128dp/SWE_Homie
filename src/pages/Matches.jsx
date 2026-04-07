import React, { useState, useEffect } from "react";
import { api, supabase } from "@/api/apiClient";
import { createPageUrl } from "../utils";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageSquare, Loader2, Heart, ChevronDown, ChevronUp, GitCompare, Bed, Maximize2, MapPin } from "lucide-react";
import PropertyNotePanel from "@/components/matches/PropertyNotePanel";
import ComparisonTool from "@/components/matches/ComparisonTool";
import LifestyleMatchPanel from "@/components/swipe/LifestyleMatchPanel";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";
import { motion, useMotionValue, useTransform } from "framer-motion";
import { X, ChevronRight } from "lucide-react"; // add X to existing lucide import
import PropertyDetailPanel from "@/components/swipe/PropertyDetailPanel";

function SwipeableMatchCard({ match, onArchive, onRestore, isBuyer, children }) {
  const x = useMotionValue(0);
  const background = useTransform(x, [-100, 0], ["rgba(239,68,68,0.15)", "rgba(0,0,0,0)"]);
  const opacity = useTransform(x, [-150, -80], [0, 1]);
  const restoreOpacity = useTransform(x, [80, 150], [0, 1]);

  const handleDragEnd = (_, info) => {
    if (isBuyer && info.offset.x < -100 && match.status !== 'archived') onArchive();
    if (isBuyer && info.offset.x > 100 && match.status === 'archived') onRestore();
  };

  return (
    <div className="relative overflow-hidden rounded-lg">
      {isBuyer && match.status !== 'archived' && (
        <motion.div
          style={{ opacity }}
          className="absolute inset-0 flex items-center justify-end pr-6 bg-red-50 rounded-lg z-0"
        >
          <div className="flex flex-col items-center gap-1 text-red-500">
            <X className="w-6 h-6" />
            <span className="text-xs font-medium">Archive</span>
          </div>
        </motion.div>
      )}
      {isBuyer && match.status === 'archived' && (
        <motion.div
          style={{ opacity: restoreOpacity }}
          className="absolute inset-0 flex items-center justify-start pl-6 bg-green-50 rounded-lg z-0"
        >
          <div className="flex flex-col items-center gap-1 text-green-500">
            <Heart className="w-6 h-6" />
            <span className="text-xs font-medium">Restore</span>
          </div>
        </motion.div>
      )}
      <motion.div
        style={{ x, background }}
        drag={isBuyer ? "x" : false}
        dragConstraints={{ 
          left: match.status === 'archived' ? 0 : -200, 
          right: match.status === 'archived' ? 200 : 0 
        }}
        dragElastic={0.2}
        onDragEnd={handleDragEnd}
        className="relative z-10"
      >
        {children}
      </motion.div>
    </div>
  );
}


export default function Matches() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [expandedNotes, setExpandedNotes] = useState(null);
  const [showComparison, setShowComparison] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [detailMatch, setDetailMatch] = useState(null);

  useEffect(() => {
    const load = async () => {
      const me = await api.auth.me();
      setUser(me);
      const isAgent = me.user_type === "agent";
      let data;
      if (isAgent) {
        data = await api.entities.Match.filter({ agent_id: me.id });
      } else {
        data = await api.entities.Match.filter({ buyer_id: me.id });
      }
      const sorted = (data || []).sort((a, b) => (b.compatibility_score ?? 0) - (a.compatibility_score ?? 0));

      // Load profile + listing details + score breakdowns in parallel
      const listingIds = sorted.map(m => m.listing_id).filter(Boolean);

      const matchIds = sorted.map(m => m.id);

      let lastMessageMap = {};

      if (matchIds.length > 0) {
        const { data: lastMsgs } = await supabase
          .from('chat_messages')
          .select('match_id, user_id, created_at')
          .in('match_id', matchIds)
          .order('created_at', { ascending: false });

        const seen = new Set();

        for (const msg of (lastMsgs || [])) {
          if (!seen.has(msg.match_id)) {
            seen.add(msg.match_id);
            lastMessageMap[msg.match_id] = msg;
          }
        }
      }

      const [profileRes, listingsRes, scoresRes] = await Promise.all([
        api.entities.LifestyleProfile.filter({ user_id: me.id }),
        listingIds.length > 0 ? supabase.from('listings').select('*').in('id', listingIds) : { data: [] },
        listingIds.length > 0 ? supabase.from('lifestyle_scores').select('listing_id, score_breakdown').eq('user_id', me.id).in('listing_id', listingIds) : { data: [] },
      ]);

      if (profileRes.length > 0) setProfile(profileRes[0]);

      const listingMap = {};
      (listingsRes.data || []).forEach(l => { listingMap[l.id] = l; });

      const scoreMap = {};
      (scoresRes.data || []).forEach(s => { scoreMap[s.listing_id] = s.score_breakdown; });

      setMatches(sorted.map(m => {
        const lastMsg = lastMessageMap[m.id];
      
        return {
          ...m,
          listing: listingMap[m.listing_id] || null,
          scoreBreakdown: scoreMap[m.listing_id] || {},
          hasUnread: lastMsg && lastMsg.user_id !== me.id,
        };
      }));
      setLoading(false);
    };
    load();
    window.addEventListener('focus', load);
    return () => window.removeEventListener('focus', load);
  }, []);

  const handleArchiveMatch = async (matchId) => {
    await supabase.from('matches').update({ status: 'archived' }).eq('id', matchId);
    setMatches(prev => prev.map(m => m.id === matchId ? { ...m, status: 'archived' } : m));
  };

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
        <div className="flex items-center gap-2">
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
        
        <Button
          variant="outline"
          size="sm"
          className={showArchived ? "gap-2 bg-slate-100" : "gap-2"}
          onClick={() => setShowArchived(a => !a)}
        >
          <X className="w-4 h-4" />
          {showArchived ? "Hide Archived" : "Show Archived"}
        </Button>
        </div>

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

      {matches.filter(m => showArchived ? m.status === 'archived' : m.status !== 'archived').length === 0 ? (
        <div className="text-center py-16">
          <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <Heart className="w-6 h-6 text-slate-300" />
          </div>
          <h3 className="font-medium text-slate-700">
            {showArchived ? "No archived matches" : "No matches yet"}
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            {isBuyer ? "Start swiping to find your perfect home!" : "Matches will appear when buyers swipe right on your listings."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {matches
            .filter(m => showArchived ? m.status === 'archived' : m.status !== 'archived')
            .map((match) => (
            <SwipeableMatchCard
              key={match.id}
              match={match}
              onArchive={() => handleArchiveMatch(match.id)}
              onRestore={async () => {
                await supabase.from('matches').update({ status: 'active' }).eq('id', match.id);
                setMatches(prev => prev.map(m => m.id === match.id ? { ...m, status: 'active' } : m));
              }}
              isBuyer={isBuyer}
              onDetail={() => setDetailMatch(match)}
            >
              <Card
                className={`border-slate-100 overflow-hidden ${
                  match.hasUnread ? "ring-2 ring-orange-200" : ""
                }`}
              >
                {isBuyer && match.listing && (
                <div className="relative h-32 overflow-hidden">
                  <Swiper
                    modules={[Navigation]}
                    navigation
                    slidesPerView={1}
                    className="w-full h-full"
                  >
                    {(match.listing.photos?.length
                      ? match.listing.photos
                      : ["https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&q=80"]
                    ).map((url, idx) => (
                      <SwiperSlide key={idx}>
                        <img src={url} alt={`photo-${idx}`} className="w-full h-full object-cover" />
                      </SwiperSlide>
                    ))}
                  </Swiper>

                  {/* These need z-index above Swiper's stacking context */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent z-10 pointer-events-none" />
                  <div className="absolute bottom-2 left-3 right-3 z-10 pointer-events-none">
                    <p className="text-white font-semibold text-sm">{match.listing?.title || "Property"}</p>
                    <p className="text-white/70 text-xs flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3" />{match.listing?.address || "Address unavailable"}
                    </p>
                  </div>
                  <div className="absolute top-2 right-2 z-10">
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
                  {match.hasUnread && (
                    <span className="flex items-center gap-1 text-sm text-orange-600 font-medium">
                      NEW
                      <span className="w-2 h-2 rounded-full bg-orange-500" />
                    </span>
                  )}


                  {isBuyer && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-slate-500"
                        onClick={() => setExpandedNotes(expandedNotes === match.id ? null : match.id)}
                      >
                        Notes
                        {expandedNotes === match.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </Button>
                      {match.status !== 'archived' ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 text-red-400 hover:text-red-600 hover:bg-red-50"
                          onClick={() => handleArchiveMatch(match.id)}
                        >
                          <X className="w-3.5 h-3.5" /> Archive
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 text-green-600 hover:bg-green-50"
                          onClick={async () => {
                            await supabase.from('matches').update({ status: 'active' }).eq('id', match.id);
                            setMatches(prev => prev.map(m => m.id === match.id ? { ...m, status: 'active' } : m));
                          }}
                        >
                          <Heart className="w-3.5 h-3.5" /> Restore
                        </Button>
                      )}
                    </>
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

              {isBuyer && match.listing && (
                <button
                  onClick={(e) => { e.stopPropagation(); setDetailMatch(match); }}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="w-full px-4 py-3 flex items-center justify-between border-t border-slate-100 hover:bg-slate-50 transition-colors text-xs font-semibold text-slate-500"
                >
                  View details & map
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                </button>
              )}

              {/* Notes panel */}
              {isBuyer && expandedNotes === match.id && (
                <div className="border-t border-slate-100 p-4 bg-slate-50/50">
                  <PropertyNotePanel match={match} user={user} />
                </div>
              )}
            </Card>
              </SwipeableMatchCard>
            ))}
        </div>
      )}

      {detailMatch && (
        <PropertyDetailPanel
          listing={detailMatch.listing}
          lifeScore={detailMatch.compatibility_score}
          scoreBreakdown={detailMatch.scoreBreakdown}
          profile={profile}
          onClose={() => setDetailMatch(null)}
        />
      )}

    </div>
  );
}