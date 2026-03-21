import React, { useState, useEffect, useRef } from "react";
import { base44, supabase } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, ArrowLeft, Loader2, Bed, Maximize2, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "../utils";

export default function ChatRoom() {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [user, setUser] = useState(null);
  const [match, setMatch] = useState(null);
  const [listing, setListing] = useState(null);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef(null);

  const urlParams = new URLSearchParams(window.location.search);
  const matchId = urlParams.get("matchId");

  useEffect(() => {
    const load = async () => {
      const me = await base44.auth.me();
      setUser(me);
      if (matchId) {
        const matchData = await base44.entities.Match.filter({ id: matchId });
        if (matchData.length > 0) {
          setMatch(matchData[0]);
          if (matchData[0].listing_id) {
            const { data: l } = await supabase.from('listings').select('*').eq('id', matchData[0].listing_id).single();
            if (l) setListing(l);
          }
        }
        const msgs = await base44.entities.ChatMessage.filter({ match_id: matchId });
        setMessages(msgs.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)));
      }
      setLoading(false);
    };
    load();
  }, [matchId]);

  // Poll for new messages
  useEffect(() => {
    if (!matchId) return;
    const interval = setInterval(async () => {
      const msgs = await base44.entities.ChatMessage.filter({ match_id: matchId });
      setMessages(msgs.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)));
    }, 5000);
    return () => clearInterval(interval);
  }, [matchId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim()) return;
    setSending(true);
    await base44.entities.ChatMessage.create({
      match_id: matchId,
      user_id: user.id,
      sender_name: user.full_name || user.email,
      content: newMessage.trim(),
    });
    setNewMessage("");
    const msgs = await base44.entities.ChatMessage.filter({ match_id: matchId });
    setMessages(msgs.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)));
    setSending(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="pb-4 border-b mb-4">
        <div className="flex items-center gap-3 mb-3">
          <Link to={createPageUrl("Matches")}>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h2 className="font-semibold text-slate-900">{match?.listing_title || "Chat"}</h2>
            <p className="text-xs text-slate-500">
              {match?.compatibility_score}% match · {user?.user_type === "agent" ? match?.buyer_name : "Property Agent"}
            </p>
          </div>
        </div>
        {listing && (
          <div className="flex gap-3 bg-slate-50 rounded-xl p-3 border border-slate-100">
            <img
              src={listing.photos?.[0] || "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&q=80"}
              alt={listing.title}
              className="w-20 h-16 object-cover rounded-lg flex-shrink-0"
            />
            <div className="min-w-0">
              <p className="font-bold text-slate-900">${listing.price?.toLocaleString()}</p>
              <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3" />{listing.address}
              </p>
              <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                <span className="flex items-center gap-1"><Bed className="w-3 h-3" />{listing.num_bedrooms} BR</span>
                {listing.floor_area_sqm && <span className="flex items-center gap-1"><Maximize2 className="w-3 h-3" />{listing.floor_area_sqm} sqm</span>}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-2">
        {messages.length === 0 && (
          <div className="text-center text-sm text-slate-400 py-10">
            Start the conversation! Say hello.
          </div>
        )}
        {messages.map((msg) => {
          const isMe = msg.user_id === user?.id;
          return (
            <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${
                isMe
                  ? "bg-indigo-600 text-white rounded-br-md"
                  : "bg-slate-100 text-slate-800 rounded-bl-md"
              }`}>
                {!isMe && <p className="text-xs font-medium text-slate-500 mb-1">{msg.sender_name}</p>}
                <p>{msg.content}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2 pt-4 border-t mt-4">
        <Input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          className="flex-1"
        />
        <Button
          onClick={handleSend}
          disabled={sending || !newMessage.trim()}
          className="bg-indigo-600 hover:bg-indigo-500 px-4"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}