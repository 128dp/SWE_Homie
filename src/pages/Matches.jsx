import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "../utils";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageSquare, Loader2, Heart, ChevronDown, ChevronUp, GitCompare } from "lucide-react";
import PropertyNotePanel from "@/components/matches/PropertyNotePanel";
import ComparisonTool from "@/components/matches/ComparisonTool";

export default function Matches() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
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
      setMatches(data);
      setLoading(false);
    };
    load();
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
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-orange-50 flex items-center justify-center text-orange-600 font-bold text-sm flex-shrink-0">
                    {match.compatibility_score || "--"}%
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">
                      {isBuyer ? match.listing_title || "Property" : match.buyer_name || "Buyer"}
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