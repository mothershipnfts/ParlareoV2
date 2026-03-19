import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { Search, Star, Clock, Loader2, Video, Headphones } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import AuthGuard from "@/components/AuthGuard";

const AVATARS = {
  wizard: "🧙", knight: "⚔️", ninja: "🥷", scholar: "📚",
  explorer: "🧭", artist: "🎨", professor: "👨‍🏫", star: "⭐"
};

export default function BrowseTeachers() {
  const navigate = useNavigate();
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    // Only show teachers who are verified (approved) and active
    const profiles = await base44.entities.TeacherProfile.filter({ is_active: true, verification_status: "verified" });
    setTeachers(profiles);
    setLoading(false);
  };

  const filtered = teachers.filter(t =>
    !search ||
    t.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    t.specializations?.some(s => s.toLowerCase().includes(search.toLowerCase())) ||
    t.lesson_types?.some(lt => lt.toLowerCase().includes(search.toLowerCase()))
  );

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-6 h-6 animate-spin text-[#1a1b4b]" />
    </div>
  );

  return (
    <AuthGuard>
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#1a1b4b]">Find a Tutor</h1>
        <p className="text-gray-400 mt-1">All students get 1 free 25-min trial per teacher</p>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or specialization..." className="pl-10 rounded-xl h-12" />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">👩‍🏫</div>
          <h3 className="text-xl font-bold text-[#1a1b4b] mb-2">No tutors yet</h3>
          <p className="text-gray-400">Verified tutors will appear here. Check back soon!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((teacher, i) => (
            <motion.div key={teacher.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all overflow-hidden cursor-pointer"
                onClick={() => navigate(createPageUrl(`TeacherProfile?id=${teacher.id}`))}>
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
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-400">From</p>
                      <p className="text-lg font-bold text-[#1a1b4b]">${teacher.lesson_price_25 || 20}<span className="text-xs text-gray-400 font-normal">/25min</span></p>
                    </div>
                    <Button className="bg-[#f97066] hover:bg-[#e8605a] rounded-full text-sm">View Profile</Button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
    </AuthGuard>
  );
}