import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import RoleGuard from "@/components/RoleGuard";
import DashboardLayout from "@/components/DashboardLayout";
import { Home, Users, Calendar, Video, Wallet, Loader2, UserCircle, MessageSquare } from "lucide-react";
import TeacherProfileEdit from "./TeacherProfileEdit";
import TeacherHomeTab from "@/components/teacher/TeacherHomeTab";
import TeacherStudentsTab from "@/components/teacher/TeacherStudentsTab";
import TeacherCalendarTab from "@/components/teacher/TeacherCalendarTab";
import IntegratedChat from "@/components/IntegratedChat";
import ClassroomTab from "@/components/classroom/ClassroomTab";
import TeacherWalletTab from "@/components/teacher/TeacherWalletTab";
import { Button } from "@/components/ui/button";

const NAV = [
  { id: "home",      label: "Home",              icon: Home },
  { id: "students",  label: "My Students",        icon: Users },
  { id: "messages",  label: "Messages",           icon: MessageSquare },
  { id: "calendar",  label: "Calendar",           icon: Calendar },
  { id: "classroom", label: "Classroom",          icon: Video },
  { id: "wallet",    label: "Wallet & Analytics", icon: Wallet },
  { id: "profile",   label: "My Profile",         icon: UserCircle },
];

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const [user, setUser]     = useState(null);
  const [loading, setLoading] = useState(true);
  const urlParams = new URLSearchParams(window.location.search);
  const urlTab = urlParams.get("tab");
  const urlBookingId = urlParams.get("bookingId");
  const [activeTab, setActiveTab] = useState(urlTab || "home");

  useEffect(() => {
    base44.auth.me()
      .then(me => { setUser(me); setLoading(false); })
      .catch(() => { setLoading(false); });
  }, []);

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-[#1a1b4b]" />
      </div>
    );
  }

  return (
    <RoleGuard allowedRoles={["teacher", "admin"]}>
      <DashboardLayout
        user={user}
        navItems={NAV}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        sectionLabel="Teacher Studio"
      >

        {/* ── HOME ─────────────────────────────────────────────────── */}
        {activeTab === "home" && <TeacherHomeTab user={user} />}

        {/* ── MY STUDENTS ──────────────────────────────────────────── */}
         {activeTab === "students" && <TeacherStudentsTab user={user} />}

        {/* ── MESSAGES ──────────────────────────────────────────────── */}
         {activeTab === "messages" && (
           <div>
             <div className="mb-6">
               <h1 className="text-2xl font-bold text-[#1a1b4b]">Messages</h1>
               <p className="text-gray-400 text-sm mt-1">Chat with your students</p>
             </div>
             <IntegratedChat user={user} />
           </div>
         )}

        {/* ── CALENDAR ─────────────────────────────────────────────── */}
        {activeTab === "calendar" && <TeacherCalendarTab user={user} />}

        {/* ── CLASSROOM ────────────────────────────────────────────── */}
        {activeTab === "classroom" && (
          <ClassroomTab user={user} bookingId={urlBookingId} />
        )}

        {/* ── WALLET & ANALYTICS ───────────────────────────────────── */}
         {activeTab === "wallet" && <TeacherWalletTab user={user} />}

        {/* ── MY PROFILE ───────────────────────────────────────────── */}
        {activeTab === "profile" && (
          <TeacherProfileEdit />
        )}

      </DashboardLayout>
    </RoleGuard>
  );
}