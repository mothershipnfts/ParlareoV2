import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { useNavigate } from "react-router-dom";
import { Search, Lock, Unlock, Check, Loader2, BookOpen, Sparkles, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";

const CATEGORIES = [
  "All", "Business", "Travel", "Daily Life", "Academic", "Technology",
  "Healthcare", "Law & Finance", "Culture & Arts", "Sports & Fitness", "News & Media"
];

const LEVELS = ["All Levels", "beginner", "elementary", "pre_intermediate", "intermediate", "upper_intermediate", "advanced"];

const LEVEL_COLORS = {
  beginner: "bg-emerald-100 text-emerald-700",
  elementary: "bg-blue-100 text-blue-700",
  pre_intermediate: "bg-violet-100 text-violet-700",
  intermediate: "bg-amber-100 text-amber-700",
  upper_intermediate: "bg-orange-100 text-orange-700",
  advanced: "bg-red-100 text-red-700"
};

const CATEGORY_EMOJIS = {
  "Business": "💼", "Travel": "✈️", "Daily Life": "🏠", "Academic": "🎓",
  "Technology": "💻", "Healthcare": "🏥", "Law & Finance": "⚖️",
  "Culture & Arts": "🎨", "Sports & Fitness": "⚽", "News & Media": "📰"
};

export default function LessonStore() {
  const navigate = useNavigate();
  const [lessons, setLessons] = useState([]);
  const [unlockedIds, setUnlockedIds] = useState(new Set());
  const [profile, setProfile] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedLevel, setSelectedLevel] = useState("All Levels");
  const [search, setSearch] = useState("");

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const me = await base44.auth.me();
      setUser(me);
      const [allLessons, profiles, unlocked] = await Promise.all([
        base44.entities.LessonCatalog.filter({ is_published: true }, 'order'),
        base44.entities.StudentProfile.filter({ user_email: me.email }),
        base44.entities.StudentUnlockedLesson.filter({ student_email: me.email })
      ]);
      setLessons(allLessons);
      if (profiles.length > 0) setProfile(profiles[0]);
      setUnlockedIds(new Set(unlocked.map(u => u.lesson_id)));
    } catch(e) {
      // Not logged in - still show lessons locked
      const allLessons = await base44.entities.LessonCatalog.filter({ is_published: true }, 'order');
      setLessons(allLessons);
    }
    setLoading(false);
  };

  const handleUnlock = async (lesson) => {
    if (!user) { base44.auth.redirectToLogin(window.location.href); return; }
    if (unlockedIds.has(lesson.id)) return;
    setPurchasing(lesson.id);
    await base44.entities.StudentUnlockedLesson.create({
      student_email: user.email,
      lesson_id: lesson.id,
      unlocked_via: lesson.is_free ? "free" : "purchase",
      status: "unlocked"
    });
    setUnlockedIds(prev => new Set([...prev, lesson.id]));
    setPurchasing(null);
  };

  const filtered = lessons.filter(l => {
    const catMatch = selectedCategory === "All" || l.category === selectedCategory;
    const levelMatch = selectedLevel === "All Levels" || l.level === selectedLevel;
    const searchMatch = !search ||
      l.title?.toLowerCase().includes(search.toLowerCase()) ||
      l.description?.toLowerCase().includes(search.toLowerCase()) ||
      l.tags?.some(t => t.toLowerCase().includes(search.toLowerCase()));
    return catMatch && levelMatch && searchMatch;
  });

  const grouped = CATEGORIES.slice(1).reduce((acc, cat) => {
    const catLessons = filtered.filter(l => l.category === cat);
    if (catLessons.length > 0) acc[cat] = catLessons;
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-[#1a1b4b]" />
      </div>
    );
  }

  const showGrouped = selectedCategory === "All" && !search;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-[#1a1b4b]">Lesson Store</h1>
          <p className="text-gray-400 mt-1">
            {user ? `${unlockedIds.size} unlocked` : 'Sign in to unlock lessons'}
            {lessons.length > 0 && <> · {lessons.length} available</>}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 mb-8">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search lessons..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 rounded-xl h-12"
          />
        </div>

        {/* Category pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all border ${
                selectedCategory === cat
                  ? 'bg-[#1a1b4b] text-white border-[#1a1b4b]'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-[#1a1b4b]/30 hover:text-[#1a1b4b]'
              }`}
            >
              {cat !== "All" && <span className="mr-1">{CATEGORY_EMOJIS[cat]}</span>}
              {cat}
            </button>
          ))}
        </div>

        {/* Level pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {LEVELS.map(level => (
            <button
              key={level}
              onClick={() => setSelectedLevel(level)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-medium transition-all border capitalize ${
                selectedLevel === level
                  ? 'bg-[#1a1b4b] text-white border-[#1a1b4b]'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-[#1a1b4b]/30'
              }`}
            >
              {level.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-16 text-center">
            <BookOpen className="w-12 h-12 text-gray-200 mx-auto mb-4" />
            <h3 className="font-semibold text-[#1a1b4b] mb-1">No lessons yet</h3>
            <p className="text-gray-400 text-sm">Katia is building new lessons — check back soon!</p>
          </CardContent>
        </Card>
      )}

      {/* Grouped by Category */}
      {showGrouped && Object.entries(grouped).map(([category, catLessons]) => (
        <div key={category} className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">{CATEGORY_EMOJIS[category]}</span>
            <h2 className="text-xl font-bold text-[#1a1b4b]">{category}</h2>
            <Badge variant="outline" className="rounded-full ml-1">{catLessons.length}</Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {catLessons.map((lesson, i) => (
              <LessonCard
                key={lesson.id}
                lesson={lesson}
                isUnlocked={unlockedIds.has(lesson.id)}
                isPurchasing={purchasing === lesson.id}
                onUnlock={() => handleUnlock(lesson)}
                index={i}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Flat list when filtered */}
      {!showGrouped && filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((lesson, i) => (
            <LessonCard
              key={lesson.id}
              lesson={lesson}
              isUnlocked={unlockedIds.has(lesson.id)}
              isPurchasing={purchasing === lesson.id}
              onUnlock={() => handleUnlock(lesson)}
              index={i}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LessonCard({ lesson, isUnlocked, isPurchasing, onUnlock, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card className={`border-0 shadow-sm h-full flex flex-col overflow-hidden transition-all hover:shadow-md ${isUnlocked ? 'ring-1 ring-emerald-200' : ''}`}>
        {/* Top color band */}
        <div className={`h-2 ${isUnlocked ? 'bg-emerald-400' : 'bg-gradient-to-r from-[#1a1b4b] to-[#f97066]'}`} />
        <CardContent className="p-5 flex flex-col flex-1">
          <div className="flex items-start justify-between gap-2 mb-3">
            <span className="text-3xl">{lesson.thumbnail_emoji || '📘'}</span>
            <Badge className={`text-xs rounded-full capitalize flex-shrink-0 ${LEVEL_COLORS[lesson.level] || 'bg-gray-100 text-gray-600'}`}>
              {lesson.level?.replace(/_/g, ' ')}
            </Badge>
          </div>

          <h3 className="font-bold text-[#1a1b4b] mb-1 leading-tight">{lesson.title}</h3>
          <p className="text-sm text-gray-400 mb-3 flex-1 line-clamp-2">{lesson.description}</p>

          {lesson.objectives?.length > 0 && (
            <ul className="mb-3 space-y-1">
              {lesson.objectives.slice(0, 2).map((obj, i) => (
                <li key={i} className="text-xs text-gray-500 flex items-start gap-1.5">
                  <span className="text-[#f97066] mt-0.5">•</span> {obj}
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-center gap-2 mb-4">
            <Badge variant="outline" className="text-xs rounded-full">{lesson.duration || 50} min</Badge>
            <Badge variant="outline" className="text-xs rounded-full">{lesson.category}</Badge>
            {lesson.is_free && <Badge className="bg-emerald-100 text-emerald-700 text-xs rounded-full">Free</Badge>}
          </div>

          <Button
            onClick={onUnlock}
            disabled={isPurchasing || isUnlocked}
            className={`w-full rounded-xl h-10 text-sm ${
              isUnlocked
                ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-50 cursor-default'
                : 'bg-[#1a1b4b] hover:bg-[#2a2b5b] text-white'
            }`}
          >
            {isPurchasing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isUnlocked ? (
              <><Check className="w-4 h-4 mr-2" /> Unlocked</>
            ) : lesson.is_free ? (
              <><Unlock className="w-4 h-4 mr-2" /> Get Free</>
            ) : (
              <><Lock className="w-4 h-4 mr-2" /> Unlock — ${lesson.price || 2}</>
            )}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}