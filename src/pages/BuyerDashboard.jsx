import React, { useState, useEffect } from "react";
import { api, supabase } from "@/api/apiClient";
import { createPageUrl } from "../utils";
import { Link } from "react-router-dom";
import { Compass, Settings, MessageSquare, ArrowRight, AlertCircle, Bed, Maximize2, MapPin, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import LifestyleMatchPanel from "@/components/swipe/LifestyleMatchPanel";
import PropertyDetailPanel from "@/components/swipe/PropertyDetailPanel";

export default function BuyerDashboard() {
  const [user, setUser] = useState(null);
  const [matchCount, setMatchCount] = useState(0);
  const [swipeCount, setSwipeCount] = useState(0);
  const [hasProfile, setHasProfile] = useState(false);
  const [profileGaps, setProfileGaps] = useState([]);
  const [profile, setProfile] = useState(null);
  const [topMatch, setTopMatch] = useState(null);
  const [topMatchBreakdown, setTopMatchBreakdown] = useState({});
  const [unreadMatches, setUnreadMatches] = useState(0);
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    const load = async () => {
      const me = await api.auth.me();
      setUser(me);

      const [profiles, matches, swipes] = await Promise.all([
        api.entities.LifestyleProfile.filter({ user_id: me.id }),
        api.entities.Match.filter({ buyer_id: me.id }),
        api.entities.Swipe.filter({ user_id: me.id }),
      ]);

      const matchIds = matches.map(m => m.id);

      if (matchIds.length > 0) {
        const { data: lastMsgs } = await supabase
          .from('chat_messages')
          .select('match_id, user_id, created_at')
          .in('match_id', matchIds)
          .order('created_at', { ascending: false });

        const seen = new Set();
        let unread = 0;

        for (const msg of (lastMsgs || [])) {
          if (!seen.has(msg.match_id)) {
            seen.add(msg.match_id);

            if (msg.user_id !== me.id) unread++;
          }
        }

        setUnreadMatches(unread);
      }

      setMatchCount(matches.length);
      setSwipeCount(swipes.length);

      const profile = profiles[0] || null;
      setHasProfile(!!profile);
      setProfile(profile);

      // Profile completion gaps
      if (profile) {
        const gaps = [];
        if (!profile.budget_max) gaps.push("budget");
        if (!profile.preferred_towns?.length) gaps.push("preferred location");
        if (!profile.num_bedrooms) gaps.push("bedroom preference");
        setProfileGaps(gaps);
      }

      // Top match with listing details
      if (matches.length > 0) {
        const sorted = [...matches].sort((a, b) => (b.compatibility_score ?? 0) - (a.compatibility_score ?? 0));
        const best = sorted[0];
        if (best.listing_id) {
          const { data: listing } = await supabase.from('listings').select('*').eq('id', best.listing_id).single();
          if (listing) {
            setTopMatch({ ...best, listing });
            const { data: scoreRow } = await supabase
              .from('lifestyle_scores')
              .select('score_breakdown')
              .eq('user_id', me.id)
              .eq('listing_id', best.listing_id)
              .single();
            setTopMatchBreakdown(scoreRow?.score_breakdown || {});
          }
        }
      }
    };
    load();
  }, []);

  const score = topMatch?.compatibility_score ?? 0;
  const scoreColor = score >= 70 ? "#22c55e" : score >= 40 ? "#f97316" : "#ef4444";
  const circumference = 2 * Math.PI * 23;

  const quickActions = [
    {
      title: "Discover Properties",
      desc: swipeCount > 0 ? `${swipeCount} properties viewed` : "Swipe through matched listings",
      icon: Compass,
      page: "SwipeDiscover",
      bgColor: "bg-orange-50",
      iconColor: "text-orange-600",
    },
    {
      title: "Lifestyle Profile",
      desc: profileGaps.length > 0 ? `Missing: ${profileGaps.join(", ")}` : hasProfile ? "Update your preferences" : "Set up your preferences",
      icon: Settings,
      page: "LifestyleProfile",
      bgColor: profileGaps.length > 0 ? "bg-amber-50" : "bg-emerald-50",
      iconColor: profileGaps.length > 0 ? "text-amber-600" : "text-emerald-600",
      alert: profileGaps.length > 0,
    },
    {
      title: "Your Matches",
      desc: unreadMatches > 0
    ? `${unreadMatches} new message${unreadMatches !== 1 ? "s" : ""}`
    : `${matchCount} active match${matchCount !== 1 ? "es" : ""}`,
      icon: MessageSquare,
      page: "Matches",
      bgColor: "bg-indigo-50",
      iconColor: "text-indigo-600",
    },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">
          Welcome back{user?.full_name ? `, ${user.full_name.split(" ")[0]}` : ""}
        </h1>
        <p className="text-slate-500 mt-1">Find your perfect home by lifestyle.</p>
      </div>

      {/* Profile not set up at all */}
      {!hasProfile && (
        <div className="mb-5 p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-900">Set up your Lifestyle Profile</p>
            <p className="text-xs text-amber-700 mt-0.5">Add your budget, preferred location and amenities to start getting matched.</p>
          </div>
          <Link to={createPageUrl("LifestyleProfile")}>
            <Button size="sm" className="bg-amber-600 hover:bg-amber-500 text-white h-8 text-xs shrink-0">
              Set up <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </Link>
        </div>
      )}

      {/* Top match preview */}
      {topMatch?.listing && (
        <div className="mb-5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Your Top Match</p>
          <Card className="border-slate-100 overflow-hidden">
            <div className="flex gap-3 p-3 items-center">
              <div className="relative w-20 h-20 flex-shrink-0 rounded-xl overflow-hidden">
                <img
                  src={topMatch.listing.photos?.[0] || "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=400&q=80"}
                  alt={topMatch.listing_title}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 text-sm truncate">{topMatch.listing_title}</p>
                <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5 truncate">
                  <MapPin className="w-3 h-3 flex-shrink-0" />{topMatch.listing.address}
                </p>
                <p className="font-bold text-slate-900 mt-1">${topMatch.listing.price?.toLocaleString()}</p>
                <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                  <span className="flex items-center gap-1"><Bed className="w-3 h-3" />{topMatch.listing.num_bedrooms} BR</span>
                  {topMatch.listing.floor_area_sqm && <span className="flex items-center gap-1"><Maximize2 className="w-3 h-3" />{topMatch.listing.floor_area_sqm} sqm</span>}
                </div>
              </div>
              <div className="flex flex-col items-center gap-2 flex-shrink-0">
                <div className="relative w-14 h-14 flex items-center justify-center">
                  <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 56 56">
                    <circle cx="28" cy="28" r="23" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="4" />
                    <circle
                      cx="28" cy="28" r="23"
                      fill="none"
                      stroke={scoreColor}
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={circumference * (1 - score / 100)}
                    />
                  </svg>
                  <span className="relative text-slate-800 font-bold text-xs leading-none">
                    {score}<span className="font-normal text-slate-400">%</span>
                  </span>
                </div>
                <Link to={createPageUrl(`ChatRoom?matchId=${topMatch.id}`)}>
                  <Button size="sm" className="bg-orange-600 hover:bg-orange-500 h-7 text-xs px-3">Chat</Button>
                </Link>
              </div>
            </div>
            <div className="px-3 pb-3">
              <LifestyleMatchPanel
                listing={topMatch.listing}
                profile={profile}
                scoreBreakdown={topMatchBreakdown}
              />
            </div>
            <button
              onClick={() => setShowDetail(true)}
              className="w-full px-4 py-3 flex items-center justify-between border-t border-slate-100 hover:bg-slate-50 transition-colors text-xs font-semibold text-slate-500"
            >
              View details & map
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </Card>
        </div>
      )}

      {/* Unread messages alert */}
      {unreadMatches > 0 && (
        <div className="mb-5 flex items-center justify-between bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-orange-600" />
            <p className="text-sm font-medium text-orange-800">
              {unreadMatches} {unreadMatches === 1 ? "conversation" : "conversations"} waiting for your reply
            </p>
          </div>
          <Link to={createPageUrl("Matches")}>
            <Button size="sm" className="bg-orange-600 hover:bg-orange-500 h-7 text-xs">
              Reply
            </Button>
          </Link>
        </div>
      )}

      {/* Quick actions */}
      <div className="grid sm:grid-cols-3 gap-4">
        {quickActions.map((action) => (
          <Link key={action.page} to={createPageUrl(action.page)}>
            <Card className={`p-5 hover:shadow-md transition-all cursor-pointer group border-slate-100 h-full ${action.alert ? "border-amber-200 bg-amber-50/30" : ""}`}>
              <div className={`w-10 h-10 rounded-xl ${action.bgColor} flex items-center justify-center mb-4 relative`}>
                <action.icon className={`w-5 h-5 ${action.iconColor}`} />

                {/* Notification badge */}
                {action.page === "Matches" && unreadMatches > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-orange-500 text-white text-[10px] flex items-center justify-center">
                    {unreadMatches}
                  </span>
                )}

                {/* Existing alert dot (for profile gaps) */}
                {action.alert && action.page !== "Matches" && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-amber-500 border-2 border-white" />
                )}
              </div>
              <h3 className="font-semibold text-slate-900 group-hover:text-orange-600 transition-colors">{action.title}</h3>
              <p className={`text-sm mt-1 ${action.alert ? "text-amber-700" : "text-slate-500"}`}>{action.desc}</p>
              <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-orange-500 mt-3 transition-colors" />
            </Card>
          </Link>
        ))}
      </div>

      {showDetail && topMatch?.listing && (
        <PropertyDetailPanel
          listing={topMatch.listing}
          profile={profile}
          scoreBreakdown={topMatchBreakdown}
          lifeScore={topMatch.compatibility_score}
          onClose={() => setShowDetail(false)}
        />
      )}

    </div>
  );
}
