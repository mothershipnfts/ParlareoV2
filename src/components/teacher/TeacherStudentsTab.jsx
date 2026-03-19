import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Users, Search, Loader2, BookOpen, Clock, Eye, MessageSquare } from "lucide-react";
import StudentProfileModal from "./StudentProfileModal";

export default function TeacherStudentsTab({ user }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null);

  const loadData = useCallback(async () => {
    if (!user?.id) return;

    const { data: teacherProfile } = await supabase
      .from("teacher_profiles")
      .select("id")
      .eq("profile_id", user.id)
      .single();

    if (!teacherProfile) {
      setStudents([]);
      setLoading(false);
      return;
    }

    const { data: bookings } = await supabase
      .from("bookings")
      .select("id, student_id, student_name, date, status, session_duration")
      .eq("teacher_id", user.id)
      .order("date", { ascending: false })
      .limit(500);

    const studentMap = {};
    const studentIds = [...new Set((bookings || []).map((b) => b.student_id).filter(Boolean))];
    let profileMap = {};
    if (studentIds.length > 0) {
      const { data: profiles } = await supabase.from("profiles").select("id, email, full_name").in("id", studentIds);
      (profiles || []).forEach((p) => { profileMap[p.id] = p; });
    }

    (bookings || []).forEach((b) => {
      const sid = b.student_id;
      if (!sid) return;
      const profile = profileMap[sid] || {};
      if (!studentMap[sid]) {
        studentMap[sid] = {
          id: sid,
          email: profile.email || "",
          name: profile.full_name || b.student_name || profile.email || "Unknown",
          profile: null,
          bookings: [],
        };
      }
      studentMap[sid].bookings.push(b);
    });

    const idsForProfiles = Object.keys(studentMap);
    if (idsForProfiles.length > 0) {
      const { data: studentProfiles } = await supabase
        .from("student_profiles")
        .select("profile_id, english_level, job")
        .in("profile_id", idsForProfiles);

      const spMap = {};
      (studentProfiles || []).forEach((sp) => {
        spMap[sp.profile_id] = sp;
      });
      idsForProfiles.forEach((sid) => {
        if (studentMap[sid]) studentMap[sid].profile = spMap[sid] || null;
      });
    }

    setStudents(Object.values(studentMap));
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-[#1a1b4b]" /></div>;

  const allStudents = students.map((s) => ({
    ...s,
    totalLessons: s.bookings.length,
    completedLessons: s.bookings.filter((b) => b.status === "completed").length,
    upcomingLessons: s.bookings.filter((b) => b.status === "scheduled").length,
    totalMinutes: s.bookings.filter((b) => b.status === "completed").reduce((sum, b) => sum + (b.session_duration || 0), 0),
    lastSeen: s.bookings.sort((a, b) => new Date(b.date) - new Date(a.date))[0]?.date,
  }));

  const filtered = allStudents.filter(
    (s) =>
      s.name?.toLowerCase().includes(search.toLowerCase()) ||
      s.email?.toLowerCase().includes(search.toLowerCase())
  );

  const levelColors = {
    beginner: "bg-blue-100 text-blue-700",
    elementary: "bg-sky-100 text-sky-700",
    pre_intermediate: "bg-teal-100 text-teal-700",
    intermediate: "bg-emerald-100 text-emerald-700",
    upper_intermediate: "bg-violet-100 text-violet-700",
    advanced: "bg-[#1a1b4b]/10 text-[#1a1b4b]",
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1b4b]">My Students</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {allStudents.length} student{allStudents.length !== 1 ? "s" : ""} who booked with you
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search students..."
            className="pl-9 rounded-xl"
          />
        </div>
      </div>

      {selectedStudent && (
        <StudentProfileModal
          student={selectedStudent}
          onClose={() => setSelectedStudent(null)}
          teacherId={user?.id}
        />
      )}

      {filtered.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-16 text-center">
            <Users className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 font-medium">No students found.</p>
            <p className="text-gray-300 text-sm mt-1">Students appear here once they book a lesson with you.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((s) => (
            <Card key={s.id} className="border-0 shadow-sm bg-white hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-full bg-[#1a1b4b]/10 flex items-center justify-center font-bold text-[#1a1b4b] text-base shrink-0 overflow-hidden">
                    {s.profile?.avatar && String(s.profile.avatar).startsWith("http")
                      ? <img src={s.profile.avatar} alt={s.name} className="w-full h-full object-cover" />
                      : s.name?.[0]?.toUpperCase() || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-[#1a1b4b] truncate">{s.name}</p>
                      {s.profile?.english_level && (
                        <Badge className={`rounded-full text-xs capitalize ${levelColors[s.profile.english_level] || "bg-gray-100 text-gray-600"}`}>
                          {s.profile.english_level.replace(/_/g, " ")}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">
                      {s.email}
                      {s.profile?.job ? ` · ${s.profile.job}` : ""}
                    </p>
                  </div>
                  <div className="hidden sm:flex items-center gap-4 shrink-0">
                    <div className="text-center">
                      <div className="flex items-center gap-1 text-xs text-gray-400 mb-0.5">
                        <BookOpen className="w-3 h-3" /> Lessons
                      </div>
                      <p className="text-sm font-bold text-[#1a1b4b]">{s.completedLessons}</p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center gap-1 text-xs text-gray-400 mb-0.5">
                        <Clock className="w-3 h-3" /> Hours
                      </div>
                      <p className="text-sm font-bold text-[#1a1b4b]">{(s.totalMinutes / 60).toFixed(1)}h</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-400 mb-0.5">Upcoming</p>
                      <Badge variant="outline" className="rounded-full text-xs">
                        {s.upcomingLessons} booked
                      </Badge>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <Button onClick={() => setSelectedStudent(s)} size="sm" variant="outline" className="h-8 px-2.5 text-xs">
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                      <Button onClick={() => setSelectedStudent(s)} size="sm" className="h-8 px-2.5 text-xs bg-[#1a1b4b] hover:bg-[#2a2b5b]">
                        <MessageSquare className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="sm:hidden mt-3 pt-3 border-t border-gray-50 space-y-3">
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-gray-500"><span className="font-bold text-[#1a1b4b]">{s.completedLessons}</span> completed</span>
                    <span className="text-xs text-gray-500"><span className="font-bold text-[#1a1b4b]">{(s.totalMinutes / 60).toFixed(1)}h</span> taught</span>
                    <span className="text-xs text-gray-500"><span className="font-bold text-[#1a1b4b]">{s.upcomingLessons}</span> upcoming</span>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => setSelectedStudent(s)} size="sm" variant="outline" className="flex-1 h-8 text-xs">
                      <Eye className="w-3 h-3 mr-1" /> View Profile
                    </Button>
                    <Button onClick={() => setSelectedStudent(s)} size="sm" className="flex-1 h-8 text-xs bg-[#1a1b4b] hover:bg-[#2a2b5b]">
                      <MessageSquare className="w-3 h-3 mr-1" /> Message
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
