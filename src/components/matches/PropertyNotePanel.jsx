import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Save, Check, Loader2, Star } from "lucide-react";
import { toast } from "sonner";

export default function PropertyNotePanel({ match, user }) {
  const [note, setNote] = useState(null);
  const [visited, setVisited] = useState(false);
  const [notes, setNotes] = useState("");
  const [rating, setRating] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const load = async () => {
      const existing = await base44.entities.PropertyNote.filter({ match_id: match.id, user_id: user.id });
      if (existing.length > 0) {
        const n = existing[0];
        setNote(n);
        setVisited(n.visited || false);
        setNotes(n.notes || "");
        setRating(n.rating || 0);
      }
    };
    load();
  }, [match.id, user.id]);

  const handleSave = async () => {
    setSaving(true);
    const data = { match_id: match.id, user_id: user.id, listing_title: match.listing_title, visited, notes, rating };
    if (note) {
      await base44.entities.PropertyNote.update(note.id, data);
    } else {
      const created = await base44.entities.PropertyNote.create(data);
      setNote(created);
    }
    setSaving(false);
    setSaved(true);
    toast.success("Notes saved!");
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium text-slate-700">I have visited this property</Label>
        <Switch checked={visited} onCheckedChange={setVisited} />
      </div>

      {visited && (
        <>
          {/* Star rating */}
          <div>
            <Label className="text-sm text-slate-600 mb-2 block">Your rating</Label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <button key={s} onClick={() => setRating(s)}>
                  <Star
                    className={`w-6 h-6 transition-colors ${s <= rating ? "text-amber-400 fill-amber-400" : "text-slate-200"}`}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label className="text-sm text-slate-600 mb-1.5 block">Your notes</Label>
            <Textarea
              placeholder="What did you like or dislike? How was the neighbourhood, noise level, condition of the unit, nearby amenities..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-28 text-sm"
            />
          </div>
        </>
      )}

      <Button
        onClick={handleSave}
        disabled={saving}
        size="sm"
        className="w-full bg-indigo-600 hover:bg-indigo-500"
      >
        {saving ? (
          <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Saving...</>
        ) : saved ? (
          <><Check className="w-3.5 h-3.5 mr-1.5" /> Saved!</>
        ) : (
          <><Save className="w-3.5 h-3.5 mr-1.5" /> Save Notes</>
        )}
      </Button>
    </div>
  );
}