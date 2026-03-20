import React, { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Loader2, Brain } from "lucide-react";
import ReactMarkdown from "react-markdown";

const SUGGESTIONS = ["Is this good value?", "Schools nearby?", "How's the transport?"];

export default function AIWingmanChat({ listing, profile }) {
  const [messages, setMessages] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  // Reset chat when listing changes
  useEffect(() => {
    setMessages([]);
    setQuery("");
  }, [listing?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleAsk = async (text) => {
    const q = (text || query).trim();
    if (!q) return;
    setQuery("");
    setMessages((prev) => [...prev, { role: "user", content: q }]);
    setLoading(true);

    const prompt = `You are LifeScore SG's AI Wingman — a friendly, concise property advisor for Singapore.

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
- Preferred Towns: ${profile?.preferred_towns?.join(", ") || "Any"}

User Question: ${q}

Answer concisely in 2–4 sentences. Be honest about pros and cons.`;

    const res = await base44.integrations.Core.InvokeLLM({ prompt, add_context_from_internet: true });
    setMessages((prev) => [...prev, { role: "ai", content: res }]);
    setLoading(false);
  };

  return (
    <div className="mt-4 w-full max-w-sm mx-auto">
      {/* Header prompt */}
      <div className="flex items-center gap-2 mb-2">
        <Brain className="w-4 h-4 text-orange-500" />
        <p className="text-sm font-medium text-slate-600">Any thoughts about this property before you swipe?</p>
      </div>

      {/* Chat history */}
      {messages.length > 0 && (
        <div className="bg-white border border-slate-100 rounded-xl p-3 mb-2 max-h-52 overflow-y-auto space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                m.role === "user"
                  ? "bg-orange-600 text-white"
                  : "bg-slate-100 text-slate-700 prose prose-sm prose-slate"
              }`}>
                {m.role === "ai" ? <ReactMarkdown>{m.content}</ReactMarkdown> : m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Loader2 className="w-3 h-3 animate-spin" /> Thinking...
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Suggestions (only before first message) */}
      {messages.length === 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => handleAsk(s)}
              className="text-xs px-3 py-1 rounded-full bg-orange-50 text-orange-600 hover:bg-orange-100 transition"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2">
        <Input
          placeholder="Ask anything about this property…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAsk()}
          className="text-sm"
        />
        <Button
          onClick={() => handleAsk()}
          disabled={loading || !query.trim()}
          className="bg-orange-600 hover:bg-orange-500 px-3"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}