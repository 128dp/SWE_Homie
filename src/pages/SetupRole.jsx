import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "../utils";
import { Button } from "@/components/ui/button";
import { Home, Building2, Key, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

export default function SetupRole() {
  const [user, setUser] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const me = await base44.auth.me();
      setUser(me);
      // If user already has a type, redirect
      if (me.user_type) {
        window.location.href = createPageUrl(me.user_type === "agent" ? "AgentDashboard" : "BuyerDashboard");
      }
    };
    load();
  }, []);

  const selectRole = async (role) => {
    setSaving(true);
    await base44.auth.updateMe({ user_type: role });
    window.location.href = createPageUrl(role === "agent" ? "AgentDashboard" : "BuyerDashboard");
  };

  const roles = [
    { key: "buyer", label: "Buyer", desc: "I'm looking to purchase a property", icon: Home, color: "from-orange-500 to-amber-500" },
    { key: "renter", label: "Renter", desc: "I'm looking to rent a place", icon: Key, color: "from-emerald-500 to-teal-500" },
    { key: "agent", label: "Property Agent", desc: "I list properties for sale or rent", icon: Building2, color: "from-amber-500 to-orange-500" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center mx-auto mb-6">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Welcome to LifeScore SG</h1>
        <p className="text-slate-500 mb-8">How would you like to use the platform?</p>

        <div className="space-y-3">
          {roles.map((role, i) => (
            <motion.button
              key={role.key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              onClick={() => selectRole(role.key)}
              disabled={saving}
              className="w-full p-4 rounded-xl bg-white border border-slate-100 hover:border-indigo-200 hover:shadow-md transition-all flex items-center gap-4 text-left"
            >
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${role.color} flex items-center justify-center`}>
                <role.icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-semibold text-slate-900">{role.label}</p>
                <p className="text-sm text-slate-500">{role.desc}</p>
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}