import React, { useEffect, useState } from "react";
import { api } from "@/api/apiClient";
import { createPageUrl } from "../utils";
import { Button } from "@/components/ui/button";
import { ArrowRight, Building2, Heart, Brain, MessageSquare } from "lucide-react";
import { motion } from "framer-motion";

export default function Home() {
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const check = async () => {
      const isAuth = await api.auth.isAuthenticated();
      if (isAuth) {
        const user = await api.auth.me();
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
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-orange-500 rounded-full animate-spin" />
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
    <div className="min-h-screen bg-slate-50 text-slate-900 overflow-hidden">
      {/* Hero */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-100/60 via-transparent to-amber-100/40" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-200/30 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-amber-200/30 rounded-full blur-3xl" />

        <header className="relative z-10 flex items-center justify-between px-6 md:px-12 py-5 border-b border-slate-200/60 bg-white/70 backdrop-blur-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange-600 flex items-center justify-center shadow-sm">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 10.5L12 3L21 10.5V21H15V15H9V21H3V10.5Z" fill="white"/>
              </svg>
            </div>
            <span className="font-bold text-xl tracking-tight text-slate-900">Homie</span>
          </div>
          <Button
            onClick={() => api.auth.redirectToLogin()}
            className="bg-orange-600 hover:bg-orange-500 text-white rounded-full px-6 h-10 text-sm font-semibold"
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
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-50 border border-orange-200 text-sm text-orange-700 mb-8">
              Your home search. Your terms. Your Homie.
            </div>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.1] mb-6 text-slate-900">
              Find your home
              <br />
              <span className="bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">
                by lifestyle
              </span>
            </h1>
            <p className="text-lg md:text-xl text-slate-500 max-w-2xl mx-auto mb-10 leading-relaxed">
              Homie matches you with properties that fit how you live — not just what you can afford.
              Swipe, score, and connect with agents instantly.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                onClick={() => api.auth.redirectToLogin({ next: createPageUrl("SetupRole") + "?role=buyer" })}
                className="bg-orange-600 hover:bg-orange-500 text-white rounded-full px-8 h-12 text-base font-semibold gap-2"
              >
                Get Started as Buyer <ArrowRight className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                className="border-slate-300 text-slate-700 hover:bg-slate-100 rounded-full px-8 h-12 text-base font-medium"
                onClick={() => api.auth.redirectToLogin({ next: createPageUrl("SetupRole") + "?role=agent" })}
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
              className="p-6 rounded-2xl bg-white border border-slate-200 hover:border-orange-200 hover:shadow-sm transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center mb-4">
                <f.icon className="w-5 h-5 text-orange-500" />
              </div>
              <h3 className="text-lg font-semibold mb-2 text-slate-900">{f.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-200 px-6 py-8 text-center text-sm text-slate-400">
        Homie — SC2008 Software Engineering Project · NTU
      </footer>
    </div>
  );
}
