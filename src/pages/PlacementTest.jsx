import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import RoleGuard from "@/components/RoleGuard";
import { GraduationCap, ChevronRight, ChevronLeft, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";

const QUESTIONS = [
  { q: "She ___ to school every day.", options: ["go", "goes", "going", "gone"], answer: 1, level: 0 },
  { q: "I ___ watching TV when you called.", options: ["was", "were", "am", "is"], answer: 0, level: 0 },
  { q: "They have ___ lived in London.", options: ["ever", "never", "always", "yet"], answer: 2, level: 1 },
  { q: "If I ___ rich, I would travel the world.", options: ["am", "was", "were", "be"], answer: 2, level: 1 },
  { q: "She asked me where I ___.", options: ["live", "lived", "living", "lives"], answer: 1, level: 2 },
  { q: "The report ___ by the time you arrive.", options: ["will be finished", "will finish", "finishes", "finished"], answer: 0, level: 2 },
  { q: "He ___ have left already; his car is gone.", options: ["must", "should", "would", "could"], answer: 0, level: 3 },
  { q: "Not until the meeting ended ___ the truth.", options: ["did I learn", "I learned", "I did learn", "learned I"], answer: 0, level: 3 },
  { q: "The project, ___ had taken months to plan, was cancelled.", options: ["that", "which", "who", "what"], answer: 1, level: 4 },
  { q: "Had I known about the delay, I ___ my plans.", options: ["would change", "would have changed", "will change", "changed"], answer: 1, level: 4 },
];

const INTEREST_OPTIONS = [
  "Business", "Technology", "Travel", "Movies & TV", "Sports",
  "Music", "Science", "Cooking", "Fashion", "Politics",
  "Art", "Reading", "Gaming", "Health & Fitness", "Nature"
];

export default function PlacementTest() {
  const navigate = useNavigate();
  const [step, setStep] = useState("intro"); // intro, profile, quiz, result
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [profileData, setProfileData] = useState({ full_name: "", job: "", interests: [], learning_goals: "" });
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    checkExistingProfile();
  }, []);

  const checkExistingProfile = async () => {
    const isAuth = await base44.auth.isAuthenticated();
    if (!isAuth) {
      base44.auth.redirectToLogin(createPageUrl("PlacementTest"));
      return;
    }
    const me = await base44.auth.me();
    const profiles = await base44.entities.StudentProfile.filter({ user_email: me.email });
    if (profiles.length > 0) {
      navigate(createPageUrl("StudentDashboard"));
    } else {
      setProfileData(prev => ({ ...prev, full_name: me.full_name || "" }));
    }
  };

  const handleAnswer = (answerIdx) => {
    const newAnswers = [...answers, answerIdx];
    setAnswers(newAnswers);
    if (currentQ < QUESTIONS.length - 1) {
      setCurrentQ(currentQ + 1);
    } else {
      calculateResult(newAnswers);
    }
  };

  const calculateResult = (finalAnswers) => {
    let score = 0;
    finalAnswers.forEach((ans, i) => {
      if (ans === QUESTIONS[i].answer) score++;
    });

    const levels = ["beginner", "elementary", "pre_intermediate", "intermediate", "upper_intermediate", "advanced"];
    const levelIndex = Math.min(Math.floor((score / QUESTIONS.length) * 6), 5);
    setResult({ score, total: QUESTIONS.length, level: levels[levelIndex], levelLabel: levels[levelIndex].replace(/_/g, ' ') });
    setStep("result");
  };

  const toggleInterest = (interest) => {
    setProfileData(prev => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter(i => i !== interest)
        : [...prev.interests, interest]
    }));
  };

  const saveProfile = async () => {
    setSaving(true);
    const me = await base44.auth.me();

    try {
      // Create student profile
      await base44.entities.StudentProfile.create({
        user_email: me.email,
        full_name: profileData.full_name || me.full_name,
        english_level: result.level,
        job: profileData.job,
        interests: profileData.interests,
        learning_goals: profileData.learning_goals,
        test_score: result.score,
        test_answers: { answers, questions: QUESTIONS.map(q => q.q) },
        lessons_remaining: 0,
        preferred_session_duration: 50
      });

      // Mark English level assessment as completed on User record (CRITICAL: wait for completion)
      await base44.auth.updateMe({
        english_level_assessment_completed: true
      });

      console.log('[PlacementTest] Assessment completed and saved - navigating to StudentDashboard');

      // Use navigate (which respects auth state) instead of hard reload
      // This gives the session time to update before RoleGuard re-checks
      navigate(createPageUrl("StudentDashboard"));
    } catch (error) {
      console.error('[PlacementTest] Error saving profile:', error);
      setSaving(false);
    }
  };

  const progress = step === "quiz" ? ((currentQ + 1) / QUESTIONS.length) * 100 : 0;

  return (
    <RoleGuard allowedRoles={["student"]}>
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-[#1a1b4b] flex items-center justify-center mx-auto mb-4">
            <GraduationCap className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-[#1a1b4b]">
            {step === "intro" && "Welcome! Let's Get Started"}
            {step === "profile" && "Tell Us About Yourself"}
            {step === "quiz" && "Placement Test"}
            {step === "result" && "Your Results"}
          </h1>
        </div>

        <AnimatePresence mode="wait">
          {/* Intro */}
          {step === "intro" && (
            <motion.div
              key="intro"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 text-center"
            >
              <p className="text-gray-500 mb-8 max-w-md mx-auto leading-relaxed">
                We'll start with a few questions about you, followed by a quick English assessment 
                to place you at the right level. This takes about 5 minutes.
              </p>
              <Button 
                size="lg"
                onClick={() => setStep("profile")}
                className="bg-[#1a1b4b] hover:bg-[#2a2b5b] rounded-full px-8"
              >
                Let's Begin <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </motion.div>
          )}

          {/* Profile */}
          {step === "profile" && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 space-y-6"
            >
              <div>
                <label className="text-sm font-medium text-[#1a1b4b] mb-2 block">Your Name</label>
                <Input
                  value={profileData.full_name}
                  onChange={(e) => setProfileData({ ...profileData, full_name: e.target.value })}
                  placeholder="Enter your full name"
                  className="rounded-xl h-12"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[#1a1b4b] mb-2 block">Your Job / Profession</label>
                <Input
                  value={profileData.job}
                  onChange={(e) => setProfileData({ ...profileData, job: e.target.value })}
                  placeholder="e.g. Software Engineer, Doctor, Student..."
                  className="rounded-xl h-12"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[#1a1b4b] mb-2 block">Your Interests</label>
                <div className="flex flex-wrap gap-2">
                  {INTEREST_OPTIONS.map(interest => (
                    <Badge
                      key={interest}
                      variant={profileData.interests.includes(interest) ? "default" : "outline"}
                      className={`cursor-pointer px-4 py-2 rounded-full text-sm transition-all ${
                        profileData.interests.includes(interest)
                          ? 'bg-[#1a1b4b] text-white hover:bg-[#2a2b5b]'
                          : 'border-gray-200 text-gray-600 hover:border-[#1a1b4b] hover:text-[#1a1b4b]'
                      }`}
                      onClick={() => toggleInterest(interest)}
                    >
                      {interest}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-[#1a1b4b] mb-2 block">What do you want to achieve?</label>
                <Textarea
                  value={profileData.learning_goals}
                  onChange={(e) => setProfileData({ ...profileData, learning_goals: e.target.value })}
                  placeholder="e.g. Improve my business English, prepare for IELTS, travel confidently..."
                  className="rounded-xl min-h-[100px]"
                />
              </div>
              <div className="flex justify-between pt-4">
                <Button variant="ghost" onClick={() => setStep("intro")} className="rounded-full">
                  <ChevronLeft className="w-4 h-4 mr-2" /> Back
                </Button>
                <Button
                  onClick={() => setStep("quiz")}
                  disabled={!profileData.full_name}
                  className="bg-[#1a1b4b] hover:bg-[#2a2b5b] rounded-full px-8"
                >
                  Start Test <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* Quiz */}
          {step === "quiz" && (
            <motion.div
              key="quiz"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            >
              {/* Progress */}
              <div className="mb-6">
                <div className="flex justify-between text-sm text-gray-400 mb-2">
                  <span>Question {currentQ + 1} of {QUESTIONS.length}</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-[#f97066] rounded-full"
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={currentQ}
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8"
                >
                  <p className="text-xl font-semibold text-[#1a1b4b] mb-6">
                    {QUESTIONS[currentQ].q}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {QUESTIONS[currentQ].options.map((opt, i) => (
                      <button
                        key={i}
                        onClick={() => handleAnswer(i)}
                        className="p-4 rounded-2xl border border-gray-100 text-left text-[#1a1b4b] font-medium hover:border-[#1a1b4b] hover:bg-[#1a1b4b]/5 transition-all"
                      >
                        <span className="text-xs text-gray-400 mr-2">{String.fromCharCode(65 + i)}.</span>
                        {opt}
                      </button>
                    ))}
                  </div>
                </motion.div>
              </AnimatePresence>
            </motion.div>
          )}

          {/* Result */}
          {step === "result" && result && (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 text-center"
            >
              <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10 text-green-500" />
              </div>
              <h2 className="text-2xl font-bold text-[#1a1b4b] mb-2">Test Complete!</h2>
              <p className="text-gray-500 mb-6">
                You scored {result.score} out of {result.total}
              </p>
              <div className="inline-flex items-center gap-2 px-6 py-3 bg-[#1a1b4b] rounded-2xl mb-8">
                <span className="text-white/60 text-sm">Your Level:</span>
                <span className="text-white font-bold capitalize">{result.levelLabel}</span>
              </div>
              <div className="max-w-sm mx-auto">
                <Button
                  size="lg"
                  onClick={saveProfile}
                  disabled={saving}
                  className="w-full bg-[#f97066] hover:bg-[#e8605a] rounded-full h-14"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Continue to Dashboard
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        </div>
      </div>
    </RoleGuard>
  );
}