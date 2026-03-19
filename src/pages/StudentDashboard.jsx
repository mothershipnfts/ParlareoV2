import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { createPageUrl } from "@/utils";
import DashboardLayout from "@/components/DashboardLayout";
import StudentProfileTab from "@/components/student/StudentProfileTab";
import StudentBrowseTutorsTab from "@/components/student/StudentBrowseTutorsTab";
import IntegratedChat from "@/components/IntegratedChat";
import ClassroomTab from "@/components/classroom/ClassroomTab";
import StudentWalletTab from "@/components/student/StudentWalletTab.jsx";
import {
  BookOpen, Search, Video, User, Wallet,
  Calendar, Clock, GraduationCap, ChevronRight, Loader2, CreditCard, MessageSquare
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format, parseISO, isAfter } from "date-fns";
import { motion } from "framer-motion";

const NAV = [
  { id: "lessons",  label: "My Lessons",    icon: BookOpen },
  { id: "tutors",   label: "Browse Tutors", icon: Search },
  { id: "messages", label: "Messages",      icon: MessageSquare },
  { id: "classroom",label: "Classroom",     icon: Video },
  { id: "profile",  label: "Profile",       icon: User },
  { id: "wallet",   label: "Wallet",        icon: Wallet },
];

export default function StudentDashboard() {
  const navigate    = useNavigate();
  const [user, setUser]         = useState(null);
  const [profile, setProfile]   = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading]   = useState(true);
  const urlParams = new URLSearchParams(window.location.search);
  const urlBookingId = urlParams.get("bookingId");
  const urlTeacherId = urlParams.get("teacher_id");
  const paymentStatus = urlParams.get("payment");
  const [activeTab, setActiveTab] = useState(urlParams.get("tab") || "lessons");
  const [autoOpenTeacherId, setAutoOpenTeacherId] = useState(urlTeacherId || null);


  const { user: authUser } = useAuth();

  const loadData = async () => {
    try {
      if (!authUser?.id) {
        setLoading(false);
        return;
      }
      setUser(authUser);

      const { data: studentProfile } = await supabase
        .from("student_profiles")
        .select("*")
        .eq("profile_id", authUser.id)
        .single();

      if (!studentProfile) {
        navigate(createPageUrl("PlacementTest"), { replace: true });
        return;
      }
      setProfile({ ...studentProfile, full_name: authUser.full_name });

      const { data: allBookings } = await supabase
        .from("bookings")
        .select("*")
        .eq("student_id", authUser.id)
        .order("date", { ascending: false });
      setBookings(allBookings || []);

      const params = new URLSearchParams(window.location.search);
      const paymentId = params.get("payment_id");
      if (params.get("payment") === "success" && paymentId) {
        try {
          await fetch("/api/verifyAndCreditWallet", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ payment_id: paymentId }),
          });
        } catch (e) {
          console.warn("verifyAndCreditWallet failed:", e.message);
        }
      }
    } catch (e) {
      console.error("StudentDashboard loadData error:", e);
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [authUser?.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-[#1a1b4b]" />
      </div>
    );
  }

  const now = new Date();
  const upcomingBookings = bookings
    .filter((b) => {
      if (b.status === "cancelled" || b.status === "completed") return false;
      const lessonEnd = new Date(`${b.date}T${b.end_time}`);
      return lessonEnd > now;
    })
    .sort((a, b) => new Date(a.date + "T" + a.start_time) - new Date(b.date + "T" + b.start_time));

  const lessonInProgress = upcomingBookings.find(b => {
    const start = new Date(`${b.date}T${b.start_time}`);
    const end = new Date(`${b.date}T${b.end_time}`);
    return now >= start && now <= end;
  });
  const featuredLesson = lessonInProgress || upcomingBookings[0] || null;
  const featuredIsLive = !!lessonInProgress;

  const levelColors = {
    beginner:          "bg-emerald-100 text-emerald-700",
    elementary:        "bg-blue-100 text-blue-700",
    pre_intermediate:  "bg-violet-100 text-violet-700",
    intermediate:      "bg-amber-100 text-amber-700",
    upper_intermediate:"bg-orange-100 text-orange-700",
    advanced:          "bg-red-100 text-red-700",
  };

  return (
    <DashboardLayout
      user={user}
      navItems={NAV}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      sectionLabel="Student Hub"
    >

      {/* ── MY LESSONS ───────────────────────────────────────────── */}
      {activeTab === "lessons" && (
        <div>
          {/* Welcome banner */}
          <div className="rounded-2xl bg-[#1a1b4b] text-white px-8 py-7 mb-6">
            <p className="text-sm text-white/50 mb-1">Welcome back 👋</p>
            <h1 className="text-2xl font-bold">
              {profile?.full_name?.split(" ")[0] || "Student"}!
            </h1>
            <p className="text-white/60 mt-1 text-sm">
              Go to <strong className="text-white">Browse Tutors</strong> to book your next lesson.
            </p>
          </div>

          {/* Featured / Next Lesson Hero */}
          {featuredLesson && (
            <div className={`rounded-2xl p-6 mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-5 ${featuredIsLive ? "bg-[#f97066]" : "bg-gradient-to-r from-violet-600 to-violet-500"}`}>
              <div className="w-16 h-16 rounded-2xl bg-white/20 flex flex-col items-center justify-center shrink-0">
                {featuredIsLive ? (
                  <Video className="w-7 h-7 text-white" />
                ) : (
                  <>
                    <span className="text-xs text-white/70 font-medium">{format(parseISO(featuredLesson.date), "MMM")}</span>
                    <span className="text-xl font-bold text-white leading-none">{format(parseISO(featuredLesson.date), "d")}</span>
                  </>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {featuredIsLive ? (
                    <span className="flex items-center gap-1.5 text-xs font-bold text-white bg-white/20 rounded-full px-2.5 py-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      LIVE NOW
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-white/70 uppercase tracking-wider">Next Lesson</span>
                  )}
                </div>
                <h2 className="text-xl font-bold text-white">{format(parseISO(featuredLesson.date), "EEEE, MMMM d")}</h2>
                <p className="text-white/70 text-sm mt-0.5">
                  {featuredLesson.start_time?.slice(0,5)} – {featuredLesson.end_time?.slice(0,5)} · {featuredLesson.session_duration} min
                  {featuredIsLive && " · In progress"}
                </p>
              </div>
              <Button
                onClick={() => { setActiveTab("classroom"); window.history.replaceState(null, "", `?tab=classroom&bookingId=${featuredLesson.id}`); }}
                className={`rounded-xl font-semibold px-6 h-auto py-2.5 shrink-0 ${featuredIsLive ? "bg-white text-[#f97066] hover:bg-white/90" : "bg-white text-violet-600 hover:bg-white/90"}`}
              >
                <Video className="w-4 h-4 mr-2" />
                {featuredIsLive ? "Rejoin Lesson" : "Join Classroom"}
              </Button>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[
              { label: "Level",            value: profile?.english_level?.replace(/_/g, " "), icon: GraduationCap, color: "bg-[#1a1b4b]" },
              { label: "Lessons Left",     value: profile?.lessons_remaining || 0,             icon: BookOpen,      color: "bg-[#f97066]" },
              { label: "Upcoming",         value: upcomingBookings.length,                      icon: Calendar,      color: "bg-violet-500" },
              { label: "Completed",        value: bookings.filter(b => b.status === "completed").length, icon: Clock, color: "bg-emerald-500" },
            ].map((stat, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
                <Card className="border-0 shadow-sm bg-white">
                  <CardContent className="p-5 flex items-start justify-between">
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">{stat.label}</p>
                      <p className="text-2xl font-bold text-[#1a1b4b] mt-1 capitalize">{stat.value}</p>
                    </div>
                    <div className={`w-10 h-10 rounded-xl ${stat.color} flex items-center justify-center`}>
                      <stat.icon className="w-5 h-5 text-white" />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Upcoming lessons list (excludes featured) */}
          {(() => {
            const listBookings = featuredLesson
              ? upcomingBookings.filter(b => b.id !== featuredLesson.id)
              : upcomingBookings;
            if (upcomingBookings.length === 0) return (
              <Card className="border-0 shadow-sm bg-white">
                <CardContent className="p-12 text-center">
                  <Calendar className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                  <p className="text-gray-400 mb-4">No upcoming lessons</p>
                  <Button onClick={() => setActiveTab("tutors")} className="bg-[#1a1b4b] hover:bg-[#2a2b5b] rounded-full">
                    Browse Tutors
                  </Button>
                </CardContent>
              </Card>
            );
            if (listBookings.length === 0) return null;
            return (
              <div className="space-y-3">
                <h2 className="text-base font-bold text-[#1a1b4b] mb-3">All Upcoming Lessons</h2>
                {listBookings.map((b) => (
                  <Card key={b.id} className="border-0 shadow-sm bg-white hover:shadow-md transition-shadow">
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-[#1a1b4b] flex flex-col items-center justify-center text-white shrink-0">
                        <span className="text-[10px] font-medium">{format(parseISO(b.date), "MMM")}</span>
                        <span className="text-lg font-bold leading-none">{format(parseISO(b.date), "d")}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[#1a1b4b]">{b.start_time?.slice(0,5)} – {b.end_time?.slice(0,5)}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{format(parseISO(b.date), "EEEE, MMMM d")}</p>
                        <div className="flex gap-2 mt-1">
                          <Badge variant="outline" className="text-xs rounded-full">{b.session_duration} min</Badge>
                          <Badge className={`text-xs rounded-full capitalize ${levelColors[b.student_level] || "bg-gray-100 text-gray-600"}`}>
                            {b.student_level?.replace(/_/g, " ")}
                          </Badge>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => { setActiveTab("classroom"); window.history.replaceState(null, "", `?tab=classroom&bookingId=${b.id}`); }}
                        className="bg-[#f97066] hover:bg-[#e8605a] rounded-full shrink-0"
                      >
                        <Video className="w-3 h-3 mr-1" /> Join
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* ── BROWSE TUTORS ────────────────────────────────────────── */}
      {activeTab === "tutors" && (
        <StudentBrowseTutorsTab
          user={user}
          profile={profile}
          autoOpenTeacherId={autoOpenTeacherId}
          paymentSuccess={paymentStatus === "success"}
        />
      )}

      {/* ── MESSAGES ──────────────────────────────────────────────── */}
      {activeTab === "messages" && (
        <div>
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-[#1a1b4b]">Messages</h1>
            <p className="text-gray-400 text-sm mt-1">Connect with your tutors</p>
          </div>
          <IntegratedChat user={user} />
        </div>
      )}

      {/* ── CLASSROOM ────────────────────────────────────────────── */}
      {activeTab === "classroom" && (
        <ClassroomTab user={user} bookingId={urlBookingId} />
      )}

      {/* ── PROFILE ──────────────────────────────────────────────── */}
      {activeTab === "profile" && (
        <StudentProfileTab user={user} profile={profile} onProfileUpdated={setProfile} />
      )}

      {/* ── WALLET ───────────────────────────────────────────────── */}
       {activeTab === "wallet" && <StudentWalletTab user={user} />}

    </DashboardLayout>
  );
}