import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { motion } from "framer-motion";
import { GraduationCap, ArrowRight, Globe, LogOut, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";



const fadeIn = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0, transition: { duration: 0.6 } } };
const stagger = { visible: { transition: { staggerChildren: 0.12 } } };

export default function Home() {
  const navigate = useNavigate();
  const [isAuth, setIsAuth] = useState(false);
  const [user, setUser] = useState(null);


  useEffect(() => {
    base44.auth.isAuthenticated().then(auth => {
      setIsAuth(auth);
      if (auth) base44.auth.me().then(setUser);
    });
  }, []);

  const ROLE_HOME = { admin: "AdminDashboard", teacher: "TeacherDashboard", student: "StudentDashboard" };

  const handleGetStarted = () => {
    navigate(createPageUrl(ROLE_HOME[user?.role] || "StudentDashboard"));
  };

  return (
    <div className="min-h-screen bg-[#0d0e1f] text-white overflow-x-hidden">
      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0d0e1f]/90 backdrop-blur-lg border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#f97066] flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">Parlareo</span>
          </div>
          <div className="flex items-center gap-3">
            {isAuth && user ? (
              <>
                {/* User avatar + name */}
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
                  <div className="w-7 h-7 rounded-full bg-[#1a1b4b] border border-white/20 flex items-center justify-center text-base">
                    {user.avatar ? user.avatar : (user.full_name?.[0]?.toUpperCase() || "?")}
                  </div>
                  <span className="text-sm font-medium text-white/90 hidden sm:block">{user.full_name}</span>
                </div>
                {/* Dashboard button */}
                <Button onClick={handleGetStarted}
                  className="bg-[#f97066] hover:bg-[#e8605a] rounded-full px-5 gap-2">
                  <LayoutDashboard className="w-4 h-4" />
                  <span className="hidden sm:inline">Dashboard</span>
                </Button>
                {/* Log Out */}
                <Button variant="ghost" onClick={() => base44.auth.logout(createPageUrl("Home"))}
                  className="text-white/50 hover:text-white hover:bg-white/5 rounded-full gap-2 px-3">
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Log Out</span>
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" onClick={() => base44.auth.redirectToLogin(window.location.href)}
                  className="text-white/70 hover:text-white hover:bg-white/5 rounded-full px-5">
                  Log In
                </Button>
                <Button onClick={() => base44.auth.redirectToLogin(createPageUrl("PlacementTest"))}
                  className="bg-white/10 border border-white/20 hover:bg-white/15 rounded-full px-5 text-white hidden sm:inline-flex">
                  Sign Up as Student
                </Button>
                <Button onClick={() => base44.auth.redirectToLogin(createPageUrl("TeacherSignup"))}
                  className="bg-[#f97066] hover:bg-[#e8605a] rounded-full px-5">
                  Apply as Teacher
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <img src="https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=1600&q=80"
            alt="" className="w-full h-full object-cover" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-[#0d0e1f]/60 via-[#0d0e1f]/40 to-[#0d0e1f]" />

        <div className="relative max-w-7xl mx-auto">
          <motion.div initial="hidden" animate="visible" variants={stagger} className="max-w-3xl">
            <motion.div variants={fadeIn} className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full mb-8">
              <Globe className="w-4 h-4 text-[#f97066]" />
              <span className="text-sm text-white/70">Online English Lessons · Learn at Your Pace</span>
            </motion.div>

            <motion.h1 variants={fadeIn} className="text-5xl md:text-7xl font-black leading-[1.05] tracking-tight">
              Learn English<br />
              <span className="text-[#f97066]">the right way.</span>
            </motion.h1>

            <motion.p variants={fadeIn} className="mt-6 text-lg text-white/60 max-w-xl leading-relaxed">
              Expert tutors, live video sessions, and flexible scheduling — all in one place.
            </motion.p>

            <motion.div variants={fadeIn} className="mt-10 flex flex-wrap gap-4">
              {isAuth ? (
                <Button size="lg" onClick={handleGetStarted}
                  className="bg-[#f97066] hover:bg-[#e8605a] rounded-full px-8 h-14 text-base font-semibold">
                  Go to Dashboard <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              ) : (
                <>
                  <Button size="lg" onClick={() => base44.auth.redirectToLogin(createPageUrl("PlacementTest"))}
                    className="bg-[#f97066] hover:bg-[#e8605a] rounded-full px-8 h-14 text-base font-semibold">
                    Sign Up as Student <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                  <Button size="lg" onClick={() => base44.auth.redirectToLogin(createPageUrl("TeacherSignup"))}
                    className="rounded-full px-8 h-14 text-base border-white/20 text-white bg-white/5 hover:bg-white/10 border">
                    Apply as Teacher
                  </Button>
                </>
              )}
            </motion.div>


          </motion.div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="px-6 py-20">
        <div className="max-w-7xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}
            className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: "👩‍🏫", title: "Expert Tutors", desc: "Browse verified tutors. Get 1 free 25-min trial per teacher. Subscribe to your favourite for ongoing lessons." },
              { icon: "🎥", title: "Video or Audio Lessons", desc: "Choose video or audio-only one-on-one sessions. Flexible scheduling based on your tutor's live availability." },
              { icon: "📅", title: "Flexible Scheduling", desc: "Book sessions that fit your life. Choose from available slots across your tutor's calendar, up to 2 months ahead." },
            ].map((f, i) => (
              <motion.div key={i} variants={fadeIn}
                className="p-8 rounded-3xl bg-white/5 border border-white/10 hover:bg-white/8 hover:border-[#f97066]/30 transition-all">
                <div className="text-4xl mb-5">{f.icon}</div>
                <h3 className="text-xl font-bold mb-2">{f.title}</h3>
                <p className="text-white/50 leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>



      {/* HOW IT WORKS */}
      <section className="px-6 py-20">
        <div className="max-w-7xl mx-auto">
          <p className="text-sm font-semibold text-[#f97066] uppercase tracking-wide mb-3">Get Started</p>
          <h2 className="text-3xl md:text-4xl font-bold mb-16">Four simple steps</h2>
          <div className="grid md:grid-cols-4 gap-8">
            {[
              { n: "01", title: "Sign Up", desc: "Create your account as a student or apply as a teacher." },
              { n: "02", title: "Take Placement Test", desc: "Students: a quick level assessment to personalise your experience." },
              { n: "03", title: "Browse Tutors", desc: "Find a verified tutor that matches your goals and schedule." },
              { n: "04", title: "Book a Tutor", desc: "Choose a verified tutor, get a free trial, then subscribe." },
            ].map((s) => (
              <div key={s.n}>
                <span className="text-6xl font-black text-white/5">{s.n}</span>
                <h3 className="text-lg font-bold mt-2 mb-2">{s.title}</h3>
                <p className="text-white/50 text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20">
        <div className="max-w-7xl mx-auto">
          <div className="rounded-3xl bg-[#f97066] p-12 md:p-16 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-0 w-64 h-64 bg-[#1a1b4b]/20 rounded-full blur-3xl" />
            <div className="relative z-10">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Ready to speak with confidence?</h2>
              <p className="text-white/80 mb-8 max-w-lg mx-auto">Join our community of learners today. Book a free trial with a verified tutor and start speaking with confidence.</p>
              <div className="flex flex-wrap gap-4 justify-center">
                {isAuth ? (
                  <Button size="lg" onClick={handleGetStarted}
                    className="bg-white text-[#f97066] hover:bg-white/90 rounded-full px-10 h-14 font-semibold">
                    Go to Dashboard <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                ) : (
                  <>
                    <Button size="lg" onClick={() => base44.auth.redirectToLogin(createPageUrl("PlacementTest"))}
                      className="bg-white text-[#f97066] hover:bg-white/90 rounded-full px-10 h-14 font-semibold">
                      Sign Up as Student
                    </Button>
                    <Button size="lg" onClick={() => base44.auth.redirectToLogin(createPageUrl("TeacherSignup"))}
                      className="bg-[#1a1b4b] hover:bg-[#2a2b5b] text-white rounded-full px-10 h-14 font-semibold">
                      Apply as Teacher
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="px-6 py-10 border-t border-white/5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#f97066] flex items-center justify-center">
              <GraduationCap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold">Parlareo</span>
          </div>
          <p className="text-sm text-white/30">© 2026 Parlareo. All rights reserved. · parlareo.com</p>
        </div>
      </footer>

    </div>
  );
}