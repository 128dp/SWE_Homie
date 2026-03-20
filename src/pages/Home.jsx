import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "../utils";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Building2, Heart, Brain, MessageSquare } from "lucide-react";
import { motion } from "framer-motion";

export default function Home() {
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const check = async () => {
      const isAuth = await base44.auth.isAuthenticated();
      if (isAuth) {
        const user = await base44.auth.me();
        if (!user.user_type) {
          window.location.href = createPageUrl("SetupRole");
        } else if (user.user_type === "agent") {
          window.location.href = createPageUrl("AgentDashboard");
        } else {
          window.location.href = createPageUrl("BuyerDashboard");
        }
      } else {
        setChecking(false);
      }
    };
    check();
  }, []);

  if (checking) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-950">
        <div className="w-10 h-10 border-3 border-slate-700 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  const features = [
    { icon: Building2, title: "Smart Property Discovery", desc: "Swipe through curated listings matched to your lifestyle preferences." },
    { icon: Heart, title: "LifeScore Matching", desc: "Every property gets a personalized compatibility score based on what matters to you." },
    { icon: Brain, title: "AI Wingman", desc: "Get data-backed advice on any property from our AI assistant." },
    { icon: MessageSquare, title: "Instant Match Chat", desc: "Connect directly with agents when you find your perfect home." },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white overflow-hidden">
      {/* Hero */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-700/20 via-transparent to-amber-600/10" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-700/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-amber-600/10 rounded-full blur-3xl" />

        <header className="relative z-10 flex items-center justify-between px-6 md:px-12 py-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shadow-sm">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 10.5L12 3L21 10.5V21H15V15H9V21H3V10.5Z" fill="#E2714A"/>
                <rect x="10" y="15" width="4" height="6" rx="0.5" fill="white"/>
              </svg>
            </div>
            <span className="font-bold text-xl tracking-tight text-white">Homie</span>
          </div>
          <Button
            onClick={() => base44.auth.redirectToLogin()}
            className="bg-white text-slate-900 hover:bg-slate-100 rounded-full px-6 h-10 text-sm font-semibold"
          >
            Sign In
          </Button>
        </header>

        <div className="relative z-10 px-6 md:px-12 pt-20 pb-32 max-w-5xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm text-orange-300 mb-8">
              Your home search. Your terms. Your Homie.
            </div>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
              Find your home
              <br />
              <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
                by lifestyle
              </span>
            </h1>
            <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
              Homie matches you with properties that fit how you live — not just what you can afford. 
              Swipe, score, and connect with agents instantly.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                onClick={() => base44.auth.redirectToLogin({ next: createPageUrl("SetupRole") })}
                className="bg-orange-600 hover:bg-orange-500 rounded-full px-8 h-12 text-base font-semibold gap-2"
              >
                Get Started as Buyer <ArrowRight className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                className="border-white/10 text-white hover:bg-white/5 rounded-full px-8 h-12 text-base"
                onClick={() => base44.auth.redirectToLogin({ next: createPageUrl("SetupRole") })}
              >
                I'm a Property Agent
              </Button>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Features */}
      <div className="px-6 md:px-12 py-24 max-w-5xl mx-auto">
        <div className="grid md:grid-cols-2 gap-6">
          {features.map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-orange-600/10 flex items-center justify-center mb-4">
                <f.icon className="w-5 h-5 text-orange-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/5 px-6 py-8 text-center text-sm text-slate-500">
        Homie — SC2008 Software Engineering Project · NTU
      </footer>
    </div>
  );
}