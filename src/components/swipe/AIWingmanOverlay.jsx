import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Send, Loader2, Brain } from "lucide-react";
import ReactMarkdown from "react-markdown";

export default function AIWingmanOverlay({ listing, profile, onClose }) {
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAsk = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setResponse("");

    const prompt = `You are LifeScore SG's AI Wingman — a property advisor for Singapore.

Property Details:
- Title: ${listing.title}
- Address: ${listing.address}
- Price: $${listing.price?.toLocaleString()}
- Type: ${listing.property_type}
- Bedrooms: ${listing.num_bedrooms}
- Area: ${listing.location_area || "N/A"}
- Description: ${listing.description || "N/A"}
- Lifestyle Tags: ${listing.lifestyle_tags?.join(", ") || "None"}

User Preferences:
- Budget: $${profile?.budget_min?.toLocaleString() || "?"} – $${profile?.budget_max?.toLocaleString() || "?"}
- Preferred Location: ${profile?.preferred_location || "Any"}
- Transport importance: ${profile?.connectivity_weight || 50}/100
- Environment importance: ${profile?.environment_weight || 50}/100
- Schools importance: ${profile?.school_proximity_weight || 50}/100
- Amenities importance: ${profile?.amenity_weight || 50}/100
- Safety importance: ${profile?.safety_weight || 50}/100
- Healthcare importance: ${profile?.healthcare_weight || 50}/100

User Question: ${query}

Provide a concise, helpful analysis. Reference specific aspects of the property relative to the user's lifestyle weights. Be honest about pros and cons.`;

    const res = await base44.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: true,
    });

    setResponse(res);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-indigo-600" />
            <h3 className="font-semibold">AI Wingman</h3>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <p className="text-sm text-slate-500 mb-4">
            Ask anything about <strong>{listing.title}</strong> — schools nearby, transport, safety, or whether it fits your lifestyle.
          </p>

          {response && (
            <div className="bg-slate-50 rounded-xl p-4 prose prose-sm prose-slate max-w-none">
              <ReactMarkdown>{response}</ReactMarkdown>
            </div>
          )}

          {loading && (
            <div className="flex items-center gap-2 text-sm text-slate-400 mt-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              Analyzing property...
            </div>
          )}
        </div>

        <div className="p-4 border-t">
          <div className="flex gap-2">
            <Input
              placeholder="e.g. Are there good schools nearby?"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAsk()}
            />
            <Button
              onClick={handleAsk}
              disabled={loading || !query.trim()}
              className="bg-indigo-600 hover:bg-indigo-500 px-4"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {["Is this good value?", "Schools nearby?", "How's the transport?"].map((q) => (
              <button
                key={q}
                onClick={() => { setQuery(q); }}
                className="text-xs px-3 py-1 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 transition"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}