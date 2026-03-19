import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { Search, Lock, Download, BookOpen, Loader2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";

const LEVEL_COLORS = {
  beginner: "bg-emerald-100 text-emerald-700",
  elementary: "bg-blue-100 text-blue-700",
  pre_intermediate: "bg-violet-100 text-violet-700",
  intermediate: "bg-amber-100 text-amber-700",
  upper_intermediate: "bg-orange-100 text-orange-700",
  advanced: "bg-red-100 text-red-700"
};

const LEVELS = ["All", "beginner", "elementary", "pre_intermediate", "intermediate", "upper_intermediate", "advanced"];

export default function PDFLessonStore() {
  const navigate = useNavigate();
  const [lessons, setLessons] = useState([]);
  const [accessIds, setAccessIds] = useState(new Set());
  const [user, setUser] = useState(null);
  const [isAuth, setIsAuth] = useState(false);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(null);
  const [search, setSearch] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("All");

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const auth = await base44.auth.isAuthenticated();
    setIsAuth(auth);
    const allLessons = await base44.entities.PDFLesson.filter({ is_published: true }, 'order');
    setLessons(allLessons);
    if (auth) {
      const me = await base44.auth.me();
      setUser(me);
      const access = await base44.entities.StudentPDFAccess.filter({ student_email: me.email });
      setAccessIds(new Set(access.map(a => a.pdf_lesson_id)));
    }
    setLoading(false);
  };

  const handlePurchase = async (lesson) => {
    if (!isAuth) { base44.auth.redirectToLogin(window.location.href); return; }
    if (accessIds.has(lesson.id)) { navigate(createPageUrl(`PDFViewer?lessonId=${lesson.id}`)); return; }
    setPurchasing(lesson.id);
    await base44.entities.StudentPDFAccess.create({
      student_email: user.email,
      pdf_lesson_id: lesson.id,
      amount_paid: lesson.is_free ? 0 : (lesson.price || 2),
      purchased_at: new Date().toISOString().split('T')[0]
    });
    setAccessIds(prev => new Set([...prev, lesson.id]));
    setPurchasing(null);
    navigate(createPageUrl(`PDFViewer?lessonId=${lesson.id}`));
  };

  const filtered = lessons.filter(l => {
    const lvl = selectedLevel === "All" || l.level === selectedLevel;
    const s = !search || l.title?.toLowerCase().includes(search.toLowerCase()) || l.description?.toLowerCase().includes(search.toLowerCase());
    return lvl && s;
  });

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-6 h-6 animate-spin text-[#1a1b4b]" />
    </div>
  );

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#1a1b4b]">PDF Lesson Store</h1>
        <p className="text-gray-400 mt-1">
          Hand-crafted lessons · Download & annotate · {isAuth ? `${accessIds.size} owned` : 'Sign in to purchase'}
        </p>
      </div>

      <div className="flex flex-col gap-4 mb-8">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search lessons..." className="pl-10 rounded-xl h-12" />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {LEVELS.map(l => (
            <button key={l} onClick={() => setSelectedLevel(l)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-medium border transition-all capitalize ${selectedLevel === l ? 'bg-[#1a1b4b] text-white border-[#1a1b4b]' : 'border-gray-200 text-gray-500 hover:border-[#1a1b4b]/30'}`}>
              {l.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-16 text-center">
            <BookOpen className="w-12 h-12 text-gray-200 mx-auto mb-4" />
            <h3 className="font-semibold text-[#1a1b4b] mb-1">No PDF lessons yet</h3>
            <p className="text-gray-400 text-sm">The admin is uploading new lessons. Check back soon!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((lesson, i) => {
            const owned = accessIds.has(lesson.id);
            return (
              <motion.div key={lesson.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Card className={`border-0 shadow-sm h-full flex flex-col overflow-hidden hover:shadow-md transition-all ${owned ? 'ring-1 ring-emerald-200' : ''}`}>
                  <div className={`h-2 ${owned ? 'bg-emerald-400' : 'bg-gradient-to-r from-[#1a1b4b] to-[#f97066]'}`} />
                  <CardContent className="p-5 flex flex-col flex-1">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <span className="text-3xl">{lesson.thumbnail_emoji || '📄'}</span>
                      <Badge className={`text-xs rounded-full capitalize ${LEVEL_COLORS[lesson.level] || 'bg-gray-100 text-gray-600'}`}>
                        {lesson.level?.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                    <h3 className="font-bold text-[#1a1b4b] mb-1">{lesson.title}</h3>
                    <p className="text-sm text-gray-400 mb-3 flex-1 line-clamp-2">{lesson.description}</p>
                    {lesson.objectives?.length > 0 && (
                      <ul className="mb-3 space-y-1">
                        {lesson.objectives.slice(0, 2).map((obj, j) => (
                          <li key={j} className="text-xs text-gray-500 flex items-start gap-1.5">
                            <span className="text-[#f97066] mt-0.5">•</span> {obj}
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="flex items-center gap-2 mb-4">
                      {lesson.duration && <Badge variant="outline" className="text-xs rounded-full">{lesson.duration} min</Badge>}
                      {lesson.is_free
                        ? <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs rounded-full">Free</Badge>
                        : <Badge className="bg-[#1a1b4b]/5 text-[#1a1b4b] border-0 text-xs rounded-full">${lesson.price || 2}</Badge>
                      }
                    </div>
                    {owned ? (
                      <div className="flex gap-2">
                        <Button onClick={() => navigate(createPageUrl(`PDFViewer?lessonId=${lesson.id}`))} className="flex-1 bg-emerald-500 hover:bg-emerald-600 rounded-xl h-10 text-sm">
                          <Eye className="w-4 h-4 mr-2" /> Open
                        </Button>
                        <Button variant="outline" className="rounded-xl h-10 px-3" onClick={() => window.open(lesson.pdf_url, '_blank')}>
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button onClick={() => handlePurchase(lesson)} disabled={purchasing === lesson.id}
                        className={`w-full rounded-xl h-10 text-sm ${!isAuth ? 'bg-gray-400 cursor-pointer' : 'bg-[#1a1b4b] hover:bg-[#2a2b5b] text-white'}`}>
                        {purchasing === lesson.id ? <Loader2 className="w-4 h-4 animate-spin" /> :
                          !isAuth ? <><Lock className="w-4 h-4 mr-2" /> Sign In to Purchase</> :
                          lesson.is_free ? 'Get Free' :
                          <><Lock className="w-4 h-4 mr-2" /> Unlock — ${lesson.price || 2}</>}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}