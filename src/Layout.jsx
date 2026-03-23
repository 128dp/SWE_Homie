import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "./utils";
import { api } from "@/api/apiClient";
import {
  Home, Compass, User, MessageSquare, Settings, Building2,
  LogOut, Menu, X
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Layout({ children, currentPageName }) {
  const [user, setUser] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      const isAuth = await api.auth.isAuthenticated();
      if (isAuth) {
        const me = await api.auth.me();
        setUser(me);
      }
      setLoading(false);
    };
    loadUser();
  }, []);

  // Public pages - no layout
  if (currentPageName === "Home") {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-slate-200 border-t-orange-600 rounded-full animate-spin" />
          <p className="text-sm text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  const isAgent = user?.user_type === "agent";

  const buyerNav = [
    { name: "Dashboard", page: "BuyerDashboard", icon: Home },
    { name: "Discover", page: "SwipeDiscover", icon: Compass },
    { name: "Profile", page: "LifestyleProfile", icon: Settings },
    { name: "Matches", page: "Matches", icon: MessageSquare },
  ];

  const agentNav = [
    { name: "Dashboard", page: "AgentDashboard", icon: Home },
    { name: "Listings", page: "ManageListings", icon: Building2 },
    { name: "Matches", page: "Matches", icon: MessageSquare },
  ];

  const navItems = isAgent ? agentNav : buyerNav;

  return (
    <div className="min-h-screen bg-slate-50">
      <style>{`
        :root {
          --color-primary: #c1602a;
          --color-primary-light: #e2714a;
          --color-accent: #d4845a;
        }
      `}</style>

      {/* Top bar */}
      <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-white border-b border-slate-100 flex items-center px-4 md:px-6">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="md:hidden p-2 rounded-lg hover:bg-slate-100 mr-2"
        >
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
        <Link to={createPageUrl("Home")} className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center shadow-sm">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 10.5L12 3L21 10.5V21H15V15H9V21H3V10.5Z" fill="#E2714A"/>
              <rect x="10" y="15" width="4" height="6" rx="0.5" fill="white"/>
            </svg>
          </div>
          <span className="font-bold text-lg tracking-tight text-slate-900">Homie</span>
        </Link>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm text-slate-500 hidden sm:block">{user?.full_name || user?.email}</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 font-medium capitalize">
            {user?.user_type || "buyer"}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-400"
            onClick={() => api.auth.logout()}
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/20 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-16 left-0 bottom-0 z-40 w-60 bg-white border-r border-slate-100
        transform transition-transform duration-200 ease-out
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        md:translate-x-0
      `}>
        <nav className="p-3 space-y-1 mt-2">
          {navItems.map((item) => {
            const isActive = currentPageName === item.page;
            return (
              <Link
                key={item.page}
                to={createPageUrl(item.page)}
                onClick={() => setSidebarOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                  ${isActive
                    ? "bg-orange-50 text-orange-700"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"}
                `}
              >
                <item.icon className={`w-4.5 h-4.5 ${isActive ? "text-orange-600" : ""}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main content */}
      <main className="pt-16 md:pl-60 min-h-screen">
        <div className="p-4 md:p-8 max-w-6xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}