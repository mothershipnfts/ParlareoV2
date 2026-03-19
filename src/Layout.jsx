import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { createPageUrl } from "@/utils";
import {
  Home, BookOpen, Calendar, GraduationCap, Video,
  Menu, LogOut, ChevronRight, User, Sparkles, Wallet, Users,
  FileText, Search, LayoutDashboard, UserCircle, ShieldCheck, MessageSquare, Settings
} from "lucide-react";
import { Button } from "@/components/ui/button";

const FULL_PAGE_ROUTES = [
  "Home", "PlacementTest", "TeacherSignup", "PDFViewer",
  "StudentDashboard", "TeacherDashboard", "AdminDashboard",
  "TeacherPendingReview", "TeacherRejected",
];

const ROLE_HOME = {
  admin: "AdminDashboard",
  teacher: "TeacherDashboard",
  student: "StudentDashboard",
};

const TEACHER_STATUS_HOME = {
  pending_review: "TeacherPendingReview",
  rejected: "TeacherRejected",
  approved: "TeacherDashboard",
};

export default function Layout({ children, currentPageName }) {
  const { user, logout, navigateToLogin } = useAuth();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const navigate = useNavigate();

  const role = user?.role || "student";
  const isAdmin = role === "admin";
  const isTeacher = role === "teacher";
  const isStudent = role === "student";
  const isLoggedIn = !!user;

  const studentLinks = [
    { name: "Dashboard", page: "StudentDashboard", icon: LayoutDashboard },
    { name: "Browse Tutors", page: "StudentDashboard?tab=tutors", icon: Search },
    { name: "My Lessons", page: "MyLessons", icon: BookOpen },
    { name: "Messages", page: "StudentDashboard?tab=messages", icon: MessageSquare },
    { name: "Classroom", page: "StudentDashboard?tab=classroom", icon: Video },
    { name: "Buy Credits", page: "BuyLessonPackage", icon: Wallet },
    { name: "PDF Lessons", page: "PDFLessonStore", icon: FileText },
    { name: "Lesson Store", page: "LessonStore", icon: Sparkles },
  ];

  const teacherLinks = user?.teacher_status === "pending_review"
    ? [
        { name: "Application Status", page: "TeacherPendingReview", icon: LayoutDashboard },
        { name: "My Profile", page: "TeacherProfileEdit", icon: UserCircle },
        { name: "Manage Schedule", page: "ManageSchedule", icon: Settings },
      ]
    : user?.teacher_status === "rejected"
    ? [
        { name: "Application Status", page: "TeacherRejected", icon: LayoutDashboard },
        { name: "Resubmit Application", page: "TeacherSignup", icon: FileText },
      ]
    : [
        { name: "Dashboard", page: "TeacherDashboard", icon: LayoutDashboard },
        { name: "My Profile", page: "TeacherProfileEdit", icon: UserCircle },
        { name: "Calendar", page: "TeacherDashboard?tab=calendar", icon: Calendar },
        { name: "Classroom", page: "TeacherDashboard?tab=classroom", icon: Video },
        { name: "Messages", page: "TeacherDashboard?tab=messages", icon: MessageSquare },
        { name: "Student Lessons", page: "StudentLessons", icon: GraduationCap },
        { name: "PDF Lessons", page: "PDFLessonStore", icon: FileText },
        { name: "Wallet", page: "TeacherWallet", icon: Wallet },
      ];

  const adminLinks = [
    { name: "Admin Dashboard", page: "AdminDashboard", icon: ShieldCheck },
  ];

  const links = isAdmin ? adminLinks : isTeacher ? teacherLinks : isStudent ? studentLinks : [];

  const roleLabel = isAdmin ? "Admin" : isTeacher ? "Teacher" : isStudent ? "Student" : "";
  const teacherStatus = user?.teacher_status;
  const homePage = role
    ? (role === "teacher" && teacherStatus ? (TEACHER_STATUS_HOME[teacherStatus] || "TeacherDashboard") : (ROLE_HOME[role] || "Home"))
    : "Home";

  if (FULL_PAGE_ROUTES.includes(currentPageName)) {
    return (
      <div className="min-h-screen">
        <style>{`:root { --navy: #1a1b4b; --coral: #f97066; --cream: #faf9f7; --sage: #e8ede6; }`}</style>
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf9f7] flex">
      <style>{`:root { --navy: #1a1b4b; --coral: #f97066; --cream: #faf9f7; --sage: #e8ede6; }`}</style>

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`
        fixed lg:sticky top-0 left-0 h-screen w-72 bg-[#1a1b4b] text-white z-50
        transform transition-transform duration-300 ease-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        flex flex-col
      `}>
        <div className="p-6 border-b border-white/10">
          <Link to={createPageUrl(homePage)} className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#f97066] flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Parlareo</h1>
            </div>
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {!isLoggedIn ? (
            <>
              <p className="text-xs text-white/30 uppercase tracking-widest px-4 py-2 mt-1">Get Started</p>
              <button onClick={() => navigateToLogin(createPageUrl("StudentDashboard"))}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium w-full text-white/60 hover:text-white hover:bg-white/5 transition-all">
                <User className="w-4 h-4" /> Sign In
              </button>
              <Link to={createPageUrl("BrowseTeachers")} onClick={() => setSidebarOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 transition-all">
                <Search className="w-4 h-4" /> Browse Tutors
              </Link>
            </>
          ) : (
            links.map((link) => {
              const isActive = currentPageName === link.page;
              return (
                <Link key={link.page} to={createPageUrl(link.page)} onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    isActive ? 'bg-white/15 text-white shadow-lg shadow-black/10' : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}>
                  <link.icon className="w-4 h-4" />
                  {link.name}
                  {isActive && <ChevronRight className="w-3 h-3 ml-auto" />}
                </Link>
              );
            })
          )}
        </nav>

        <div className="p-4 border-t border-white/10">
          {isLoggedIn ? (
            <>
              <div className="flex items-center gap-3 px-4 py-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm">
                  {user?.full_name?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user?.full_name || 'User'}</p>
                  <p className="text-xs text-white/40 truncate capitalize">{roleLabel}</p>
                </div>
              </div>
              <button onClick={() => logout(createPageUrl("Home"))}
                className="flex items-center gap-3 px-4 py-2 rounded-xl text-sm text-white/50 hover:text-white hover:bg-white/5 w-full transition-all">
                <LogOut className="w-4 h-4" /> Sign Out
              </button>
            </>
          ) : (
            <button onClick={() => navigateToLogin(createPageUrl("StudentDashboard"))}
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl text-sm font-medium bg-[#f97066] hover:bg-[#e8605a] text-white transition-all">
              <User className="w-4 h-4" /> Sign In
            </button>
          )}
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-h-screen">
        <header className="lg:hidden flex items-center justify-between p-4 border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-30">
          <button onClick={() => setSidebarOpen(true)} className="p-2 -ml-2">
            <Menu className="w-5 h-5 text-[#1a1b4b]" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#f97066] flex items-center justify-center">
              <GraduationCap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-[#1a1b4b]">Parlareo</span>
          </div>
          <div className="w-9" />
        </header>

        <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}