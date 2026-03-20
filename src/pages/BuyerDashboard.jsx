import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "../utils";
import { Link } from "react-router-dom";
import { Compass, Settings, MessageSquare, ArrowRight, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function BuyerDashboard() {
  const [user, setUser] = useState(null);
  const [matchCount, setMatchCount] = useState(0);
  const [hasProfile, setHasProfile] = useState(false);

  useEffect(() => {
    const load = async () => {
      const me = await base44.auth.me();
      setUser(me);

      // Check if user has set up their type
      if (!me.user_type || me.user_type === "agent") {
        // Ensure buyer type is set
      }

      const profiles = await base44.entities.LifestyleProfile.filter({ user_id: me.id });
      setHasProfile(profiles.length > 0);

      const matches = await base44.entities.Match.filter({ buyer_id: me.id });
      setMatchCount(matches.length);
    };
    load();
  }, []);

  const quickActions = [
    {
      title: "Discover Properties",
      desc: "Swipe through matched listings",
      icon: Compass,
      page: "SwipeDiscover",
      color: "from-orange-500 to-amber-500",
      bgColor: "bg-orange-50",
    },
    {
      title: "Lifestyle Profile",
      desc: hasProfile ? "Update your preferences" : "Set up your preferences",
      icon: Settings,
      page: "LifestyleProfile",
      color: "from-emerald-500 to-teal-500",
      bgColor: "bg-emerald-50",
    },
    {
      title: "Your Matches",
      desc: `${matchCount} active match${matchCount !== 1 ? "es" : ""}`,
      icon: MessageSquare,
      page: "Matches",
      color: "from-amber-500 to-orange-500",
      bgColor: "bg-amber-50",
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">
          Welcome back{user?.full_name ? `, ${user.full_name.split(" ")[0]}` : ""}
        </h1>
        <p className="text-slate-500 mt-1">Find your perfect home by lifestyle.</p>
      </div>

      {!hasProfile && (
        <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-100">
          <div className="flex items-start gap-3">
            <TrendingUp className="w-5 h-5 text-amber-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-900">Set up your Lifestyle Profile</p>
              <p className="text-sm text-amber-700 mt-0.5">Configure your budget, location, and lifestyle preferences to start discovering matched properties.</p>
              <Link to={createPageUrl("LifestyleProfile")}>
                <Button size="sm" className="mt-3 bg-amber-600 hover:bg-amber-700 text-white h-8 text-xs">
                  Set Up Now <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-3 gap-4">
        {quickActions.map((action) => (
          <Link key={action.page} to={createPageUrl(action.page)}>
            <Card className="p-5 hover:shadow-md transition-all cursor-pointer group border-slate-100 h-full">
              <div className={`w-10 h-10 rounded-xl ${action.bgColor} flex items-center justify-center mb-4`}>
                <action.icon className="w-5 h-5 text-slate-700" />
              </div>
              <h3 className="font-semibold text-slate-900 group-hover:text-orange-600 transition-colors">
                {action.title}
              </h3>
              <p className="text-sm text-slate-500 mt-1">{action.desc}</p>
              <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-orange-500 mt-3 transition-colors" />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}