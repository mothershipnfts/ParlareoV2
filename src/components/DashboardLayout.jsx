import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { GraduationCap, LogOut, Menu, X } from "lucide-react";

/**
 * Shared master layout for Teacher, Student, and Admin dashboards.
 * Props:
 *  - user: { full_name, email, role }
 *  - navItems: [{ id, label, icon }]
 *  - activeTab: string
 *  - onTabChange: (id) => void
 *  - sectionLabel: string  (e.g. "Teacher Studio", "Student Hub", "Overseer Mode")
 *  - badge: { tabId, count } (optional, e.g. for pending alerts)
 *  - children: main content area
 */
export default function DashboardLayout({
  user,
  navItems,
  activeTab,
  onTabChange,
  sectionLabel,
  badge,
  children,
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const initials = user?.full_name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?";

  return (
    <div className="flex min-h-screen bg-[#faf9f7]">
      {/* ── Mobile overlay ─────────────────────────────────────────── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Sidebar ────────────────────────────────────────────────── */}
      <aside
        className={`
          fixed lg:sticky top-0 left-0 h-screen w-64 bg-[#1a1b4b] text-white z-50
          flex flex-col transition-transform duration-300
          ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        {/* Logo */}
        <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#f97066] flex items-center justify-center shrink-0">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-base font-bold tracking-tight leading-none">Parlareo</p>
            </div>
          </div>
          <button
            className="lg:hidden text-white/50 hover:text-white"
            onClick={() => setMobileOpen(false)}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest px-3 mb-3">
            {sectionLabel}
          </p>
          <div className="space-y-0.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              const badgeCount = badge?.tabId === item.id ? badge.count : 0;
              return (
                <button
                  key={item.id}
                  onClick={() => { onTabChange(item.id); setMobileOpen(false); }}
                  className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${
                    isActive
                      ? "bg-white/15 text-white shadow-sm"
                      : "text-white/55 hover:text-white hover:bg-white/8"
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {badgeCount > 0 && (
                    <span className="bg-amber-500 text-white text-[10px] rounded-full px-1.5 py-0.5 font-semibold">
                      {badgeCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        {/* User footer */}
        <div className="px-3 py-4 border-t border-white/10">
          <div className="flex items-center gap-3 px-3 mb-1">
            <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center text-xs font-bold shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.full_name || "User"}</p>
              <p className="text-[10px] text-white/35 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={() => base44.auth.logout(createPageUrl("Home"))}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm text-white/40 hover:text-white hover:bg-white/8 transition-all mt-1"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main column ────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        {/* Top bar (mobile only) */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100 sticky top-0 z-30">
          <button onClick={() => setMobileOpen(true)} className="p-1 -ml-1">
            <Menu className="w-5 h-5 text-[#1a1b4b]" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#f97066] flex items-center justify-center">
              <GraduationCap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-[#1a1b4b] text-sm">Parlareo</span>
          </div>
          <div className="w-8 h-8 rounded-full bg-[#1a1b4b]/10 flex items-center justify-center text-xs font-bold text-[#1a1b4b]">
            {initials}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6 md:p-8 max-w-6xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}