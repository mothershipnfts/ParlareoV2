import React, { useState, useEffect } from "react";
import TeacherCreditsPanel from "./TeacherCreditsPanel";
import { base44 } from "@/api/base44Client";
import { Star, Clock, Video, Headphones, CheckCircle, Loader2, ArrowLeft, Lock, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import BookLessonsView from "./BookLessonsView";
import TeacherMessagePanel from "./TeacherMessagePanel";

const AVATARS = {
  wizard: "🧙", knight: "⚔️", ninja: "🥷", scholar: "📚",
  explorer: "🧭", artist: "🎨", professor: "👨‍🏫", star: "⭐"
};

export default function TeacherProfileView({ teacherId, user, profile, onBack, autoOpenBooking }) {
  const [teacher, setTeacher] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [trialUsed, setTrialUsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedDuration, setSelectedDuration] = useState(50);
  const [bookingView, setBookingView] = useState(null);

  useEffect(() => { loadData(); }, [teacherId]);

  const loadData = async () => {
    if (!teacherId) return;
    const profiles = await base44.entities.TeacherProfile.filter({ id: teacherId });
    if (profiles.length > 0) {
      setTeacher(profiles[0]);
      base44.entities.TeacherProfile.update(profiles[0].id, { profile_views: (profiles[0].profile_views || 0) + 1 });
      const [rev, avail] = await Promise.all([
        base44.entities.TeacherReview.filter({ teacher_email: profiles[0].user_email }),
        base44.entities.Availability.filter({ created_by: profiles[0].user_email })
      ]);
      setReviews(rev);
      setAvailability(avail.filter(a => !a.is_booked).slice(0, 12));
    }
    if (user && profiles.length > 0) {
      const trials = await base44.entities.TrialUsage.filter({ student_email: user.email, teacher_email: profiles[0].user_email });
      setTrialUsed(trials.length > 0);
    }
    setLoading(false);
    // After payment, auto-open book lesson view
    if (autoOpenBooking) {
      setBookingView({ isTrial: false, duration: 50 });
    }
  };

  const bookTrial = () => {
    if (!user) { base44.auth.redirectToLogin(window.location.href); return; }
    setBookingView({ isTrial: true });
  };

  const bookLesson = (duration) => {
    if (!user) { base44.auth.redirectToLogin(window.location.href); return; }
    setBookingView({ isTrial: false, duration });
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-6 h-6 animate-spin text-[#1a1b4b]" />
    </div>
  );

  if (!teacher) return null;

  if (bookingView) {
    return (
      <BookLessonsView
        teacherId={teacher.id}
        isTrial={bookingView.isTrial}
        presetDuration={bookingView.duration}
        profile={profile}
        onBack={() => setBookingView(null)}
      />
    );
  }

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-[#1a1b4b] mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Tutors
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-0 shadow-sm overflow-hidden">
            <div className="bg-[#1a1b4b] p-8">
              <div className="flex items-start gap-6">
                <div className="w-20 h-20 rounded-2xl bg-white/10 flex items-center justify-center text-5xl flex-shrink-0">
                  {AVATARS[teacher.avatar] || "👩‍🏫"}
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">{teacher.full_name}</h1>
                  <p className="text-white/50 text-sm mt-1">{teacher.nationality} · {teacher.years_experience || 0} years experience</p>
                  <div className="flex items-center gap-1 mt-2">
                    {[1, 2, 3, 4, 5].map(s => (
                      <Star key={s} className={`w-4 h-4 ${s <= Math.round(teacher.rating || 0) ? 'fill-amber-400 text-amber-400' : 'text-white/20'}`} />
                    ))}
                    <span className="text-white/50 text-sm ml-2">{(teacher.rating || 0).toFixed(1)} ({teacher.total_reviews || 0} reviews)</span>
                  </div>
                  <div className="flex items-center gap-3 mt-3">
                    {teacher.offers_video && <div className="flex items-center gap-1.5 text-white/60 text-sm"><Video className="w-4 h-4 text-blue-400" /> Video</div>}
                    {teacher.offers_audio && <div className="flex items-center gap-1.5 text-white/60 text-sm"><Headphones className="w-4 h-4 text-emerald-400" /> Audio</div>}
                  </div>
                </div>
              </div>
            </div>
            <CardContent className="p-6">
              <p className="text-gray-600 leading-relaxed">{teacher.bio}</p>
            </CardContent>
          </Card>

          {teacher.specializations?.length > 0 && (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-6">
                <h2 className="font-bold text-[#1a1b4b] mb-4">Specializations</h2>
                <div className="flex flex-wrap gap-2">
                  {teacher.specializations.map(s => (
                    <Badge key={s} className="bg-[#1a1b4b]/5 text-[#1a1b4b] border-0 rounded-full px-4 py-1">{s}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {teacher.lesson_types?.length > 0 && (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-6">
                <h2 className="font-bold text-[#1a1b4b] mb-4">Lesson Types</h2>
                <div className="grid grid-cols-2 gap-3">
                  {teacher.lesson_types.map(t => (
                    <div key={t} className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                      <span className="text-sm text-gray-600 capitalize">{t.replace('_', ' ')}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {availability.length > 0 && (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-6">
                <h2 className="font-bold text-[#1a1b4b] mb-4">Next Available Slots</h2>
                <div className="grid grid-cols-2 gap-2">
                  {availability.slice(0, 6).map(slot => (
                    <div key={slot.id} className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-center">
                      <p className="text-xs text-emerald-600 font-medium">{slot.date}</p>
                      <p className="text-sm font-bold text-[#1a1b4b]">{slot.start_time}</p>
                      <p className="text-xs text-gray-400">{slot.session_duration} min</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {reviews.length > 0 && (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-6">
                <h2 className="font-bold text-[#1a1b4b] mb-4">Student Reviews</h2>
                <div className="space-y-4">
                  {reviews.slice(0, 5).map(review => (
                    <div key={review.id} className="pb-4 border-b border-gray-100 last:border-0 last:pb-0">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-full bg-[#1a1b4b]/10 flex items-center justify-center text-sm font-bold text-[#1a1b4b]">
                          {review.student_name?.[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-[#1a1b4b]">{review.student_name}</p>
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map(s => (
                              <Star key={s} className={`w-3 h-3 ${s <= review.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`} />
                            ))}
                          </div>
                        </div>
                      </div>
                      <p className="text-sm text-gray-500">{review.comment}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card className={`border-0 shadow-md ${trialUsed ? 'opacity-60' : 'ring-2 ring-[#f97066]'}`}>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl">🎁</span>
                <div>
                  <h3 className="font-bold text-[#1a1b4b]">Book a 25-Min Trial</h3>
                  <p className="text-xs text-gray-400">Free · One per teacher</p>
                </div>
              </div>
              {trialUsed ? (
                <Badge className="bg-gray-100 text-gray-500 rounded-full w-full text-center justify-center py-2">✓ Trial already used</Badge>
              ) : !user ? (
                <Button onClick={() => base44.auth.redirectToLogin(window.location.href)} className="w-full bg-[#f97066] hover:bg-[#e8605a] rounded-xl h-11 font-semibold">
                  <Lock className="w-4 h-4 mr-2" /> Sign In to Book Trial
                </Button>
              ) : (
                <Button onClick={bookTrial} className="w-full bg-[#f97066] hover:bg-[#e8605a] rounded-xl h-11 font-semibold">
                  Book a 25-Min Trial
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <h3 className="font-bold text-[#1a1b4b] mb-1">Book a Lesson</h3>
              <p className="text-xs text-gray-400 mb-3">
                25 min · €{teacher.lesson_price_25 || 20} &nbsp;|&nbsp; 50 min · €{teacher.lesson_price_50 || 35}
              </p>
              <div className="space-y-2">
                <Button
                  onClick={() => bookLesson(25)}
                  disabled={!user}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 rounded-xl h-10"
                >
                  <Clock className="w-4 h-4 mr-2" /> Book 25 min
                </Button>
                <Button
                  onClick={() => bookLesson(50)}
                  disabled={!user}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 rounded-xl h-10"
                >
                  <Clock className="w-4 h-4 mr-2" /> Book 50 min
                </Button>
              </div>
              {!user && (
                <p className="text-xs text-gray-400 mt-3 text-center">Sign in to book a lesson</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-[#1a1b4b]">{teacher.total_lessons_taught || 0}</p>
                  <p className="text-xs text-gray-400">Lessons Taught</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#1a1b4b]">{teacher.profile_views || 0}</p>
                  <p className="text-xs text-gray-400">Profile Views</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {user && (
             <>
               <Card className="border-0 shadow-sm">
                 <CardContent className="p-4">
                   <TeacherCreditsPanel teacher={teacher} user={user} />
                 </CardContent>
               </Card>

               <Card className="border-0 shadow-sm">
                 <CardContent className="p-4">
                   <TeacherMessagePanel teacher={teacher} user={user} />
                 </CardContent>
               </Card>
             </>
           )}
        </div>
      </div>
    </div>
  );
}