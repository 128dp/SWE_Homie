import React, { useState, useEffect, useRef } from "react";
import { base44, supabase } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { X, Heart, Loader2, SlidersHorizontal } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import PropertyCard from "../components/swipe/PropertyCard";
import AIWingmanChat from "../components/swipe/AIWingmanChat";
import { Link } from "react-router-dom";
import { createPageUrl } from "../utils";
import { toast } from "sonner";

export default function SwipeDiscover() {
  const [listings, setListings] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [profile, setProfile] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [swipedIds, setSwipedIds] = useState(new Set());
  const [swipeDir, setSwipeDir] = useState(null);

  useEffect(() => {
    const load = async () => {
      const me = await base44.auth.me();
      setUser(me);
      const profiles = await base44.entities.LifestyleProfile.filter({ user_id: me.id });
      if (profiles.length > 0) setProfile(profiles[0]);
      const swipes = await base44.entities.Swipe.filter({ user_id: me.id });
      const swipedSet = new Set(swipes.map((s) => s.listing_id));
      setSwipedIds(swipedSet);

      // Load listings
      const allListings = await base44.entities.PropertyListing.filter({ status: "active" });
      const unswiped = allListings.filter((l) => !swipedSet.has(l.id));

      // Load pre-computed scores and sort highest first
      try {
        const { data: scores } = await supabase
          .from('lifestyle_scores')
          .select('listing_id, score, score_breakdown')
          .eq('user_id', me.id);

        if (scores && scores.length > 0) {
          const scoreMap = {};
          scores.forEach(s => {
            scoreMap[s.listing_id] = { score: s.score, breakdown: s.score_breakdown };
          });
          const sorted = [...unswiped]
            .map(l => ({
              ...l,
              lifeScore: scoreMap[l.id]?.score ?? 50,
              scoreBreakdown: scoreMap[l.id]?.breakdown ?? {}
            }))
            .sort((a, b) => b.lifeScore - a.lifeScore);
          setListings(sorted);
        } else {
          setListings(unswiped);
        }
      } catch {
        setListings(unswiped);
      }

      setLoading(false);
    };
    load();
  }, []);

  const handleSwipe = async (direction) => {
    const listing = listings[currentIndex];
    if (!listing) return;
    setSwipeDir(direction);

    await base44.entities.Swipe.create({
      user_id: user.id,
      listing_id: listing.id,
      direction,
    });

    if (direction === "right") {
      const score = listing.lifeScore || 50;
      await base44.entities.Match.create({
        buyer_id: user.id,
        listing_id: listing.id,
        agent_id: listing.agent_id || "",
        compatibility_score: score,
        listing_title: listing.title,
        buyer_name: user.full_name || user.email,
        status: "active",
      });
      toast.success("Match created! Check your Matches tab to chat.");
    }

    setTimeout(() => {
      setSwipeDir(null);
      setCurrentIndex((i) => i + 1);
    }, 300);
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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Discover</h1>
          <p className="text-sm text-slate-500">Swipe right to like, left to pass</p>
        </div>
        <Link to={createPageUrl("LifestyleProfile")}>
          <Button variant="outline" size="sm" className="gap-2">
            <SlidersHorizontal className="w-4 h-4" /> Filters
          </Button>
        </Link>
      </div>

      {isEndOfStack ? (
        <div className="flex justify-center">
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
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
      ) : (
        <div className="flex flex-col lg:flex-row items-start gap-6">
          {/* Property card + swipe controls */}
          <div className="flex flex-col items-center w-full lg:w-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentListing.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  x: swipeDir === "left" ? -300 : swipeDir === "right" ? 300 : 0,
                  rotate: swipeDir === "left" ? -15 : swipeDir === "right" ? 15 : 0,
                }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <PropertyCard
                  listing={currentListing}
                  lifeScore={currentListing.lifeScore}
                  scoreBreakdown={currentListing.scoreBreakdown}
                  profile={profile}
                />
              </motion.div>
            </AnimatePresence>

            {/* AI Wingman — above swipe buttons on mobile only */}
            <div className="w-full mt-4 lg:hidden">
              <AIWingmanChat listing={currentListing} profile={profile} />
            </div>

            <div className="flex items-center gap-6 mt-6">
              <Button
                variant="outline"
                size="lg"
                className="w-16 h-16 rounded-full border-2 border-red-200 hover:bg-red-50 p-0"
                onClick={() => handleSwipe("left")}
              >
                <X className="w-7 h-7 text-red-500" />
              </Button>
              <Button
                size="lg"
                className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-400 p-0 shadow-lg shadow-green-500/30"
                onClick={() => handleSwipe("right")}
              >
                <Heart className="w-7 h-7 text-white" />
              </Button>
            </div>

            <p className="text-xs text-slate-400 mt-3">
              {currentIndex + 1} of {listings.length} properties
            </p>
          </div>

          {/* AI Wingman — beside card on desktop only */}
          <div className="hidden lg:block w-96 flex-shrink-0">
            <AIWingmanChat listing={currentListing} profile={profile} />
          </div>
        </div>
      )}
    </div>
  );
}
