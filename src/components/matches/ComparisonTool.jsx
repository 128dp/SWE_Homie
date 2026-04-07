import React, { useState, useEffect } from "react";
import { api } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Star, CheckSquare, Square, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function ComparisonTool({ matches, user, onClose }) {
  const [notes, setNotes] = useState({});
  const [selected, setSelected] = useState([]);
  const [comparing, setComparing] = useState(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const allNotes = await api.entities.PropertyNote.filter({ user_id: user.id });
      const map = {};
      allNotes.forEach((n) => { map[n.match_id] = n; });
      setNotes(map);
      setLoading(false);
    };
    load();
  }, [user.id]);

  const visitedMatches = matches.filter((m) => notes[m.id]?.visited);

  const toggle = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 5 ? [...prev, id] : prev
    );
  };

  const handleCompare = async () => {
    setComparing(true);
    setResult(null);
    const items = selected.map((id) => {
      const match = matches.find((m) => m.id === id);
      const note = notes[id];
      return {
        title: match.listing_title || "Property",
        rating: note.rating || "N/A",
        notes: note.notes || "No notes provided",
        score: match.compatibility_score || "N/A",
      };
    });

    const prompt = `You are a property advisor helping a buyer in Singapore compare properties they have personally visited.

Here are their notes on each property:

${items.map((p, i) => `**Property ${i + 1}: ${p.title}**
- LifeScore match: ${p.score}%
- Personal rating: ${p.rating}/5
- Visit notes: ${p.notes}`).join("\n\n")}

Please provide a concise, structured comparison across these properties. Highlight each property's strengths and weaknesses based on the buyer's own notes and ratings. End with a clear recommendation on which property best suits the buyer and why.`;

    const response = await api.integrations.Core.InvokeLLM({ prompt });
    setResult(response);
    setComparing(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-slate-900">Compare Visited Properties</h3>
          <p className="text-sm text-slate-500">Select up to 5 properties to compare side by side using your notes.</p>
        </div>
        <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
          <X className="w-4 h-4" />
        </button>
      </div>

      {visitedMatches.length === 0 ? (
        <div className="text-center py-8 text-sm text-slate-500">
          No visited properties yet. Mark a property as visited and add notes to compare.
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {visitedMatches.map((match) => {
              const note = notes[match.id];
              const isSelected = selected.includes(match.id);
              return (
                <button
                  key={match.id}
                  onClick={() => toggle(match.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                    isSelected ? "border-indigo-300 bg-indigo-50" : "border-slate-100 bg-white hover:border-slate-200"
                  }`}
                >
                  {isSelected ? (
                    <CheckSquare className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-300 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{match.listing_title || "Property"}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="flex gap-0.5">
                        {[1,2,3,4,5].map((s) => (
                          <Star key={s} className={`w-3 h-3 ${s <= (note.rating||0) ? "text-amber-400 fill-amber-400" : "text-slate-200"}`} />
                        ))}
                      </div>
                      <span className="text-xs text-slate-400">{note.notes ? note.notes.slice(0, 40) + "..." : "No notes"}</span>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-xs flex-shrink-0">{match.compatibility_score}%</Badge>
                </button>
              );
            })}
          </div>

          <Button
            onClick={handleCompare}
            disabled={selected.length < 2 || comparing}
            className="w-full bg-indigo-600 hover:bg-indigo-500 gap-2"
          >
            {comparing ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Comparing...</>
            ) : (
              <><Sparkles className="w-4 h-4" /> Compare {selected.length > 0 ? `${selected.length} ` : ""}Properties</>
            )}
          </Button>
          {selected.length < 2 && <p className="text-xs text-center text-slate-400">Select at least 2 properties to compare</p>}

          {result && (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-indigo-500" />
                <span className="text-sm font-semibold text-indigo-700">AI Comparison</span>
              </div>
              <ReactMarkdown remarkPlugins={[remarkGfm]} className="text-sm prose prose-sm prose-slate max-w-none [&_table]:w-full [&_table]:border-collapse [&_th]:bg-slate-100 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_td]:px-3 [&_td]:py-2 [&_td]:text-xs [&_tr]:border-b [&_tr]:border-slate-100">
                {result}
              </ReactMarkdown>
            </div>
          )}
        </>
      )}
    </div>
  );
}