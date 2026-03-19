import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Search, Star, Clock, Loader2, Video, Headphones, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import TeacherProfileView from "./TeacherProfileView";

const AVATARS = {
  wizard: "🧙", knight: "⚔️", ninja: "🥷", scholar: "📚",
  explorer: "🧭", artist: "🎨", professor: "👨‍🏫", star: "⭐"
};

export default function StudentBrowseTutorsTab({ user, profile, autoOpenTeacherId, paymentSuccess }) {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedTeacherId, setSelectedTeacherId] = useState(null);

  useEffect(() => {
    base44.entities.TeacherProfile.filter({ is_active: true, verification_status: "verified" })
      .then(profiles => {
        setTeachers(profiles);
        setLoading(false);
        // Auto-open teacher profile if coming back from Stripe payment
        if (autoOpenTeacherId) {
          const match = profiles.find(p => p.id === autoOpenTeacherId);
          if (match) setSelectedTeacherId(autoOpenTeacherId);
        }
      });
  }, []);

  const filtered = teachers.filter(t =>
    !search ||
    t.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    t.specializations?.some(s => s.toLowerCase().includes(search.toLowerCase())) ||
    t.lesson_types?.some(lt => lt.toLowerCase().includes(search.toLowerCase()))
  );

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-6 h-6 animate-spin text-[#1a1b4b]" />
    </div>
  );

  if (selectedTeacherId) {
    return (
      <div>
        {paymentSuccess && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <div>
              <p className="font-semibold text-emerald-800">Payment successful!</p>
              <p className="text-sm text-emerald-700">Your balance has been topped up. You can now book lessons below.</p>
            </div>
          </motion.div>
        )}
        <TeacherProfileView
          teacherId={selectedTeacherId}
          user={user}
          profile={profile}
          onBack={() => setSelectedTeacherId(null)}
          autoOpenBooking={paymentSuccess}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-[#1a1b4b]">Find a Tutor</h2>
        <p className="text-gray-400 text-sm mt-1">All students get 1 free 25-min trial per teacher</p>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or specialization..."
          className="pl-10 rounded-xl h-12" />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">👩‍🏫</div>
          <h3 className="text-xl font-bold text-[#1a1b4b] mb-2">No tutors yet</h3>
          <p className="text-gray-400">Verified tutors will appear here. Check back soon!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((teacher, i) => {
            const price50 = teacher.lesson_price_50 || 35;
            const price25 = teacher.lesson_price_25 || Math.round(price50 * 0.6);
            return (
              <motion.div key={teacher.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all overflow-hidden">
                  <div className="bg-[#1a1b4b] p-6 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center mx-auto mb-3 text-4xl">
                      {AVATARS[teacher.avatar] || "👩‍🏫"}
                    </div>
                    <h3 className="font-bold text-white text-lg">{teacher.full_name}</h3>
                    <p className="text-white/50 text-sm">{teacher.nationality}</p>
                    <div className="flex items-center justify-center gap-1 mt-2">
                      {[1, 2, 3, 4, 5].map(s => (
                        <Star key={s} className={`w-3.5 h-3.5 ${s <= Math.round(teacher.rating || 0) ? 'fill-amber-400 text-amber-400' : 'text-white/20'}`} />
                      ))}
                      <span className="text-white/40 text-xs ml-1">({teacher.total_reviews || 0})</span>
                    </div>
                  </div>
                  <div className="p-5">
                    <p className="text-sm text-gray-500 line-clamp-2 mb-4">{teacher.bio}</p>
                    {teacher.lesson_types?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {teacher.lesson_types.slice(0, 3).map(t => (
                          <Badge key={t} variant="outline" className="text-xs rounded-full capitalize">{t.replace('_', ' ')}</Badge>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-4 mb-4 text-sm text-gray-500">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{teacher.years_experience || 0} yrs exp</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {teacher.offers_video && <Video className="w-3.5 h-3.5 text-blue-500" />}
                        {teacher.offers_audio && <Headphones className="w-3.5 h-3.5 text-emerald-500" />}
                      </div>
                    </div>
                    {/* Pricing */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex gap-3">
                        <div>
                          <p className="text-xs text-gray-400">50 min</p>
                          <p className="text-base font-bold text-[#1a1b4b]">€{price50}</p>
                        </div>
                        <div className="w-px bg-gray-100" />
                        <div>
                          <p className="text-xs text-gray-400">25 min</p>
                          <p className="text-base font-bold text-[#1a1b4b]">€{price25}</p>
                        </div>
                      </div>
                    </div>
                    <Button
                      onClick={() => setSelectedTeacherId(teacher.id)}
                      className="w-full bg-[#f97066] hover:bg-[#e8605a] rounded-full text-sm">
                      View Profile
                    </Button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}