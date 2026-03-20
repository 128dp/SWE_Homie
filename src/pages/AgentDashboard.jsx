import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "../utils";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, MessageSquare, Plus, ArrowRight, TrendingUp } from "lucide-react";

export default function AgentDashboard() {
  const [user, setUser] = useState(null);
  const [listingCount, setListingCount] = useState(0);
  const [matchCount, setMatchCount] = useState(0);

  useEffect(() => {
    const load = async () => {
      const me = await base44.auth.me();
      setUser(me);
      const listings = await base44.entities.PropertyListing.filter({ agent_id: me.id });
      setListingCount(listings.length);
      const matches = await base44.entities.Match.filter({ agent_id: me.id });
      setMatchCount(matches.length);
    };
    load();
  }, []);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">
          Agent Dashboard{user?.full_name ? ` — ${user.full_name}` : ""}
        </h1>
        <p className="text-slate-500 mt-1">Manage listings and respond to buyer matches.</p>
      </div>

      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        <Card className="p-5 border-slate-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
              <Building2 className="w-4.5 h-4.5 text-blue-600" />
            </div>
            <span className="text-2xl font-bold">{listingCount}</span>
          </div>
          <p className="text-sm text-slate-500">Active Listings</p>
        </Card>
        <Card className="p-5 border-slate-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center">
              <MessageSquare className="w-4.5 h-4.5 text-green-600" />
            </div>
            <span className="text-2xl font-bold">{matchCount}</span>
          </div>
          <p className="text-sm text-slate-500">Buyer Matches</p>
        </Card>
        <Card className="p-5 border-slate-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center">
              <TrendingUp className="w-4.5 h-4.5 text-amber-600" />
            </div>
            <span className="text-2xl font-bold">--</span>
          </div>
          <p className="text-sm text-slate-500">Views (coming soon)</p>
        </Card>
      </div>

      <div className="flex gap-3">
        <Link to={createPageUrl("ManageListings")}>
          <Button className="bg-orange-600 hover:bg-orange-500 gap-2">
            <Plus className="w-4 h-4" /> Add New Listing
          </Button>
        </Link>
        <Link to={createPageUrl("Matches")}>
          <Button variant="outline" className="gap-2">
            <MessageSquare className="w-4 h-4" /> View Matches
          </Button>
        </Link>
      </div>
    </div>
  );
}