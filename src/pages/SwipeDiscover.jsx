import React, { useState, useEffect } from "react";
import { api, supabase } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { X, Heart, Loader2, SlidersHorizontal, MapPin, DollarSign, Brain } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import PropertyCard from "../components/swipe/PropertyCard";
import AIWingmanChat from "../components/swipe/AIWingmanChat";
import { Link } from "react-router-dom";
import { createPageUrl } from "../utils";
import { toast } from "sonner";

const SEPARATOR = { isSeparator: true, id: "__separator__" };

export default function SwipeDiscover() {
  const [listings, setListings] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [profile, setProfile] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [swipeDir, setSwipeDir] = useState(null);
  const [hardCount, setHardCount] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      const me = await api.auth.me();
      setUser(me);
      const profiles = await api.entities.LifestyleProfile.filter({ user_id: me.id });
      const userProfile = profiles[0] || null;
      if (userProfile) setProfile(userProfile);

      const swipes = await api.entities.Swipe.filter({ user_id: me.id });
      const swipedSet = new Set(swipes.map((s) => s.listing_id));

      const allListings = await api.entities.PropertyListing.filter({ status: "active" });
      const unswiped = allListings.filter((l) => !swipedSet.has(l.id));

      // Hard criteria
      const budgetMin = userProfile?.budget_min ?? 0;
      const budgetMax = userProfile?.budget_max ?? Infinity;
      const preferredTowns = userProfile?.preferred_towns || [];

      const meetsHard = (l) => {
        const withinBudget = !l.price || (l.price >= budgetMin && l.price <= budgetMax);
        const inTown = preferredTowns.length === 0 || preferredTowns.includes(l.town);
        return withinBudget && inTown;
      };

      // Load scores
      let scoreMap = {};
      try {
        const { data: scores } = await supabase
          .from('lifestyle_scores')
          .select('listing_id, score, score_breakdown')
          .eq('user_id', me.id);
        (scores || []).forEach(s => {
          scoreMap[s.listing_id] = { score: Number(s.score), breakdown: s.score_breakdown };
        });
      } catch {}

      const enrich = (l) => ({
        ...l,
        lifeScore: scoreMap[l.id]?.score ?? 50,
        scoreBreakdown: scoreMap[l.id]?.breakdown ?? {},
      });

      const byScore = (a, b) => b.lifeScore - a.lifeScore;

      const hardGroup = unswiped.filter(meetsHard).map(enrich).sort(byScore);
      const softGroup = unswiped.filter(l => !meetsHard(l)).map(enrich).sort(byScore);

      setHardCount(hardGroup.length);

      // Insert separator between groups if both have listings
      const combined =
        hardGroup.length > 0 && softGroup.length > 0
          ? [...hardGroup, SEPARATOR, ...softGroup]
          : [...hardGroup, ...softGroup];

      setListings(combined);
      setLoading(false);
    };
    load();
  }, []);

  const handleSwipe = async (direction) => {
    const listing = listings[currentIndex];
    if (!listing || listing.isSeparator || !user) return;

    setSwipeDir(direction);

    try {
      await api.entities.Swipe.create({
        user_id: user.id,
        listing_id: listing.id,
        direction,
      });

      if (direction === "right") {
        const existing = await api.entities.Match.filter({
          buyer_id: user.id,
          listing_id: listing.id,
        });

        if (!existing || existing.length === 0) {
          await api.entities.Match.create({
            buyer_id: user.id,
            listing_id: listing.id,
            agent_id: listing.agent_id || null,
            compatibility_score: listing.lifeScore || 50,
            listing_title: listing.title,
            buyer_name: user.full_name || user.email,
            status: "active",
          });

          toast.success("Match created! Check your Matches tab.");
        }
      }

      setTimeout(() => {
        setSwipeDir(null);
        setCurrentIndex((i) => i + 1);
      }, 300);
    } catch (err) {
      console.error("Swipe failed:", err);
      setSwipeDir(null);
      toast.error("Could not save your swipe. Please try again.");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  const currentListing = listings[currentIndex];
  const isEndOfStack = !currentListing;
  const isSeparator = currentListing?.isSeparator;

  // Count remaining (excluding separator)
  const remaining = listings.slice(currentIndex).filter(l => !l.isSeparator).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Discover</h1>
          <p className="text-xs text-slate-500">Swipe right to like, left to pass</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline" size="sm"
            className="gap-2 border-orange-200 text-orange-600 hover:bg-orange-50"
            onClick={() => setChatOpen(o => !o)}
          >
            <Brain className="w-4 h-4" />
            Ask AI Wingman
          </Button>
          <Link to={createPageUrl("LifestyleProfile")}>
            <Button variant="outline" size="sm" className="gap-2">
              <SlidersHorizontal className="w-4 h-4" /> Edit Preferences
            </Button>
          </Link>
        </div>
      </div>

      <AnimatePresence>
        {chatOpen && !isEndOfStack && !isSeparator && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="mb-3 bg-white border border-slate-200 rounded-2xl shadow-lg p-4 max-w-lg mx-auto"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-orange-500" />
                <span className="text-sm font-semibold text-slate-700">AI Wingman</span>
              </div>
              <button onClick={() => setChatOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <AIWingmanChat listing={currentListing} profile={profile} />
          </motion.div>
        )}
      </AnimatePresence>

      {isEndOfStack ? (
        <div className="flex justify-center">
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <Heart className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-lg font-semibold text-slate-700">No more properties</h3>
            <p className="text-sm text-slate-500 mt-1 mb-4">Try adjusting your lifestyle profile for more results.</p>
            <Link to={createPageUrl("LifestyleProfile")}>
              <Button className="bg-orange-600 hover:bg-orange-500">Update Preferences</Button>
            </Link>
          </motion.div>
        </div>
      ) : isSeparator ? (
        <div className="flex justify-center">
          <motion.div key="separator" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-12 max-w-sm">
            <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
              <Heart className="w-8 h-8 text-amber-500" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800">
              That's all {hardCount} listings within your criteria!
            </h3>
            <p className="text-sm text-slate-500 mt-2 mb-2">
              The following listings are outside your budget or preferred location, but may still be a good lifestyle match.
            </p>
            <div className="flex items-center justify-center gap-4 text-xs text-slate-400 mb-6">
              <span className="flex items-center gap-1"><DollarSign className="w-3.5 h-3.5" /> Budget</span>
              <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> Location</span>
              <span>may not match</span>
            </div>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={() => setCurrentIndex(i => i + 1)}>
                Show anyway
              </Button>
              <Link to={createPageUrl("LifestyleProfile")}>
                <Button className="bg-orange-600 hover:bg-orange-500">Adjust Criteria</Button>
              </Link>
            </div>
          </motion.div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 max-w-lg mx-auto">
          {currentIndex < hardCount && (
            <div className="text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-3 py-1 rounded-full">
              Within your budget & location
            </div>
          )}
          {currentIndex > hardCount && (
            <div className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
              Outside your hard criteria
            </div>
          )}

          <AnimatePresence mode="popLayout">
            <motion.div
              key={currentListing.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{
                opacity: 1, scale: 1,
                x: swipeDir === "left" ? -400 : swipeDir === "right" ? 400 : 0,
                rotate: swipeDir === "left" ? -15 : swipeDir === "right" ? 15 : 0,
              }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.6}
              onDragEnd={(_, info) => {
                if (info.offset.x > 100) handleSwipe("right");
                else if (info.offset.x < -100) handleSwipe("left");
              }}
              style={{ cursor: "grab", width: "100%" }}
              whileDrag={{ cursor: "grabbing" }}
            >
              <PropertyCard
                listing={currentListing}
                lifeScore={currentListing.lifeScore}
                scoreBreakdown={currentListing.scoreBreakdown}
                profile={profile}
              />
            </motion.div>
          </AnimatePresence>

          <div className="flex items-center gap-5 mt-1">
            <Button variant="outline" size="lg" className="w-14 h-14 rounded-full border-2 border-red-200 hover:bg-red-50 p-0" onClick={() => handleSwipe("left")}>
              <X className="w-6 h-6 text-red-500" />
            </Button>
            <Button size="lg" className="w-14 h-14 rounded-full bg-green-500 hover:bg-green-400 p-0 shadow-lg shadow-green-500/30" onClick={() => handleSwipe("right")}>
              <Heart className="w-6 h-6 text-white" />
            </Button>
          </div>

          <p className="text-xs text-slate-400">{remaining} properties remaining</p>
        </div>
      )}

    </div>
  );
}
