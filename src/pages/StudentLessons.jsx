import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { Loader2, Users, Video, Sparkles, BookOpen, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { format, parseISO } from "date-fns";

export default function StudentLessons() {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const [s, b] = await Promise.all([
      base44.entities.StudentProfile.list('-created_date'),
      base44.entities.Booking.list('-date')
    ]);
    setStudents(s);
    setBookings(b);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-[#1a1b4b]" />
      </div>
    );
  }

  const filtered = students.filter(s => 
    s.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.user_email?.toLowerCase().includes(search.toLowerCase())
  );

  const levelColors = {
    beginner: "bg-emerald-100 text-emerald-700",
    elementary: "bg-blue-100 text-blue-700",
    pre_intermediate: "bg-violet-100 text-violet-700",
    intermediate: "bg-amber-100 text-amber-700",
    upper_intermediate: "bg-orange-100 text-orange-700",
    advanced: "bg-red-100 text-red-700"
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-[#1a1b4b]">Student Lessons</h1>
          <p className="text-gray-400 mt-1">{students.length} students enrolled</p>
        </div>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Search students..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 rounded-xl h-12"
        />
      </div>

      <div className="space-y-4">
        {filtered.map((student) => {
          const studentBookings = bookings.filter(b => b.student_email === student.user_email && b.status !== 'cancelled');
          const upcoming = studentBookings.filter(b => new Date(b.date) >= new Date()).slice(0, 3);

          return (
            <Card key={student.id} className="border-0 shadow-sm">
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-[#1a1b4b]/10 flex items-center justify-center flex-shrink-0">
                    <span className="font-bold text-[#1a1b4b] text-lg">
                      {student.full_name?.[0]?.toUpperCase() || '?'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-[#1a1b4b]">{student.full_name}</h3>
                      <Badge className={`text-xs rounded-full capitalize ${levelColors[student.english_level] || 'bg-gray-100'}`}>
                        {student.english_level?.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-400 mt-0.5">{student.job || 'No profession set'}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {student.interests?.slice(0, 4).map(i => (
                        <Badge key={i} variant="outline" className="text-xs rounded-full">{i}</Badge>
                      ))}
                    </div>
                    {student.learning_goals && (
                      <p className="text-sm text-gray-500 mt-2 bg-gray-50 px-3 py-2 rounded-lg">
                        <span className="font-medium text-[#1a1b4b]">Goals:</span> {student.learning_goals}
                      </p>
                    )}

                    {/* Upcoming lessons */}
                    {upcoming.length > 0 && (
                      <div className="mt-3 space-y-2">
                        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Upcoming Lessons</p>
                        {upcoming.map(b => (
                          <div key={b.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                            <span className="text-sm font-medium text-[#1a1b4b]">
                              {format(parseISO(b.date), 'MMM d')}
                            </span>
                            <span className="text-sm text-gray-500">{b.start_time}</span>
                            <Badge variant="outline" className="text-xs rounded-full">{b.session_duration} min</Badge>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => navigate(createPageUrl(`LessonRoom?bookingId=${b.id}`))}
                              className="ml-auto text-xs"
                            >
                              <Video className="w-3 h-3 mr-1" /> Open
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <Badge variant="outline" className="rounded-full text-xs">
                      <BookOpen className="w-3 h-3 mr-1" /> {student.lessons_remaining || 0} remaining
                    </Badge>
                    <Badge variant="outline" className="rounded-full text-xs">
                      {studentBookings.length} total bookings
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}