import React, { useState, useEffect } from "react";
import { base44, supabase } from "@/api/base44Client";
import { createPageUrl } from "../utils";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, MessageSquare, Plus, TrendingUp, Eye, Heart, Bell } from "lucide-react";

export default function AgentDashboard() {
  const [user, setUser] = useState(null);
  const [listingCount, setListingCount] = useState(0);
  const [matchCount, setMatchCount] = useState(0);
  const [totalViews, setTotalViews] = useState(0);
  const [newMatches, setNewMatches] = useState(0);
  const [unreadMatches, setUnreadMatches] = useState(0);

  useEffect(() => {
    const load = async () => {
      const me = await base44.auth.me();
      setUser(me);

      const [listings, matches] = await Promise.all([
        base44.entities.PropertyListing.filter({ agent_id: me.id }),
        base44.entities.Match.filter({ agent_id: me.id }),
      ]);
      setListingCount(listings.length);
      setMatchCount(matches.length);

      if (listings.length > 0) {
        const listingIds = listings.map(l => l.id);

        // Total views = all swipes on agent's listings
        const { data: swipes } = await supabase
          .from('swipes')
          .select('id')
          .in('listing_id', listingIds);
        setTotalViews(swipes?.length || 0);

        // New matches = matches with no chat messages yet
        if (matches.length > 0) {
          const matchIds = matches.map(m => m.id);
          const { data: msgs } = await supabase
            .from('chat_messages')
            .select('match_id')
            .in('match_id', matchIds);
          const chattedMatchIds = new Set((msgs || []).map(m => m.match_id));
          setNewMatches(matches.filter(m => !chattedMatchIds.has(m.id)).length);

          // Unread = last message in chat is NOT from agent
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
      }
    };
    load();
  }, []);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">
          Welcome back{user?.full_name ? `, ${user.full_name.split(" ")[0]}` : ""}
        </h1>
        <p className="text-slate-500 mt-1">Here's how your listings are performing.</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Card className="p-4 border-slate-100">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center mb-2">
            <Building2 className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{listingCount}</p>
          <p className="text-xs text-slate-500 mt-0.5">Active Listings</p>
        </Card>

        <Card className="p-4 border-slate-100">
          <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center mb-2">
            <Eye className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{totalViews}</p>
          <p className="text-xs text-slate-500 mt-0.5">Total Views</p>
        </Card>

        <Card className="p-4 border-slate-100">
          <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center mb-2">
            <Heart className="w-4 h-4 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{matchCount}</p>
          <p className="text-xs text-slate-500 mt-0.5">Buyer Matches</p>
        </Card>

        <Card className="p-4 border-slate-100 relative">
          {unreadMatches > 0 && (
            <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-orange-500" />
          )}
          <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center mb-2">
            <Bell className="w-4 h-4 text-orange-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{unreadMatches}</p>
          <p className="text-xs text-slate-500 mt-0.5">Awaiting Reply</p>
        </Card>
      </div>

      {/* Alert banners */}
      <div className="space-y-2 mb-6">
        {newMatches > 0 && (
          <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2">
              <Heart className="w-4 h-4 text-green-600" />
              <p className="text-sm font-medium text-green-800">
                {newMatches} new {newMatches === 1 ? "match" : "matches"} haven't been contacted yet
              </p>
            </div>
            <Link to={createPageUrl("Matches")}>
              <Button size="sm" className="bg-green-600 hover:bg-green-500 h-7 text-xs">Reach out</Button>
            </Link>
          </div>
        )}
        {unreadMatches > 0 && (
          <div className="flex items-center justify-between bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-orange-600" />
              <p className="text-sm font-medium text-orange-800">
                {unreadMatches} {unreadMatches === 1 ? "conversation" : "conversations"} waiting for your reply
              </p>
            </div>
            <Link to={createPageUrl("Matches")}>
              <Button size="sm" className="bg-orange-600 hover:bg-orange-500 h-7 text-xs">Reply</Button>
            </Link>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Link to={createPageUrl("ManageListings")}>
          <Button className="bg-orange-600 hover:bg-orange-500 gap-2">
            <Plus className="w-4 h-4" /> Add New Listing
          </Button>
        </Link>
        <Link to={createPageUrl("Matches")}>
          <Button variant="outline" className="gap-2 relative">
            <MessageSquare className="w-4 h-4" /> View Matches
            {unreadMatches > 0 && (
              <Badge className="bg-orange-500 text-white text-xs px-1.5 py-0 h-4 min-w-4">
                {unreadMatches}
              </Badge>
            )}
          </Button>
        </Link>
      </div>
    </div>
  );
}
