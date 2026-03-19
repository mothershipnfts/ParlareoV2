import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { createPageUrl } from "@/utils";
import { Loader2 } from "lucide-react";

// ─── Route Ownership Maps ───────────────────────────────────────────────────
// Pages exclusively owned by each role. Any role NOT in the list is bounced.
const STUDENT_PAGES = new Set([
  "StudentDashboard", "PlacementTest", "BrowseTeachers", "BookLessons",
  "MyLessons", "PDFLessonStore", "LessonStore", "StudentPayment", "TeacherProfile",
]);

const TEACHER_PAGES = new Set([
  "TeacherDashboard", "TeacherPendingReview", "TeacherRejected",
  "TeacherProfileEdit", "ManageSchedule", "StudentLessons",
  "TeacherWallet", "LessonRoom", "TeacherSignup", "PDFLessonStore",
]);

const ADMIN_PAGES = new Set([
  "AdminDashboard", "TeacherProfileEdit", "ManageSchedule",
  "StudentLessons", "TeacherWallet", "PDFLessonStore",
]);

// Teacher non-approved allow-lists
const TEACHER_PENDING_ALLOWED = new Set(["TeacherPendingReview", "TeacherProfileEdit", "ManageSchedule"]);
const TEACHER_REJECTED_ALLOWED = new Set(["TeacherRejected", "TeacherSignup"]);

function getPageName() {
  const path = window.location.pathname;
  const match = path.match(/\/([^/?#]+)(?:[?#].*)?$/);
  return match ? match[1] : "";
}

function getRedirectForRole(role, teacherStatus, assessmentCompleted) {
  if (role === "admin") return createPageUrl("AdminDashboard");
  if (role === "teacher") {
    if (teacherStatus === "pending_review") return createPageUrl("TeacherPendingReview");
    if (teacherStatus === "rejected") return createPageUrl("TeacherRejected");
    return createPageUrl("TeacherDashboard");
  }
  // student
  return assessmentCompleted
    ? createPageUrl("StudentDashboard")
    : createPageUrl("PlacementTest");
}

/**
 * Authoritative RBAC guard. Pass `allowedRoles` — an array of roles that may
 * access the wrapped page. Enforces strict role isolation:
 *
 *  admin   → only ADMIN_PAGES, always lands on AdminDashboard
 *  teacher → only TEACHER_PAGES, gated by teacher_status
 *  student → only STUDENT_PAGES, gated by english_level_assessment_completed
 */
export default function RoleGuard({ allowedRoles, children }) {
  const navigate = useNavigate();
  const [ok, setOk] = useState(false);

  const { user: me, isAuthenticated, navigateToLogin } = useAuth();

  useEffect(() => {
    (async () => {
      try {
        if (!isAuthenticated || !me) {
          navigateToLogin(window.location.href);
          return;
        }

        const role = me.role || "student";
        const teacherStatus = me.teacher_status;
        const assessmentCompleted = me.english_level_assessment_completed || false;
        const pageName = getPageName();

        // ── ADMIN: exclusive lockdown ────────────────────────────────────────
        if (role === "admin") {
          if (!allowedRoles.includes("admin")) {
            navigate(createPageUrl("AdminDashboard"), { replace: true });
            return;
          }
          // Admin may not access pure student pages
          if (STUDENT_PAGES.has(pageName) && !ADMIN_PAGES.has(pageName)) {
            navigate(createPageUrl("AdminDashboard"), { replace: true });
            return;
          }
          setOk(true);
          return;
        }

        // ── TEACHER: exclusive lockdown ──────────────────────────────────────
        if (role === "teacher") {
          // Block all student-only pages
          if (STUDENT_PAGES.has(pageName) && !TEACHER_PAGES.has(pageName)) {
            navigate(createPageUrl("TeacherDashboard"), { replace: true });
            return;
          }

          if (!allowedRoles.includes("teacher")) {
            navigate(getRedirectForRole(role, teacherStatus, assessmentCompleted), { replace: true });
            return;
          }

          // Status gates
          if (teacherStatus === "pending_review") {
            if (!TEACHER_PENDING_ALLOWED.has(pageName)) {
              navigate(createPageUrl("TeacherPendingReview"), { replace: true });
              return;
            }
          } else if (teacherStatus === "rejected") {
            if (!TEACHER_REJECTED_ALLOWED.has(pageName)) {
              navigate(createPageUrl("TeacherRejected"), { replace: true });
              return;
            }
          }

          setOk(true);
          return;
        }

        // ── STUDENT: exclusive lockdown ──────────────────────────────────────
        if (role === "student") {
          // Block all teacher-only pages
          if (TEACHER_PAGES.has(pageName) && !STUDENT_PAGES.has(pageName)) {
            navigate(
              assessmentCompleted
                ? createPageUrl("StudentDashboard")
                : createPageUrl("PlacementTest"),
              { replace: true }
            );
            return;
          }

          if (!allowedRoles.includes("student")) {
            navigate(getRedirectForRole(role, teacherStatus, assessmentCompleted), { replace: true });
            return;
          }

          // Assessment gate: block dashboard until test is complete
          if (!assessmentCompleted && pageName !== "PlacementTest") {
            navigate(createPageUrl("PlacementTest"), { replace: true });
            return;
          }

          // Once completed, don't let them re-take the test
          if (assessmentCompleted && pageName === "PlacementTest") {
            navigate(createPageUrl("StudentDashboard"), { replace: true });
            return;
          }

          setOk(true);
          return;
        }

        // Fallback for unknown roles
        navigate(createPageUrl("Home"), { replace: true });
      } catch {
        setOk(true);
      }
    })();
  }, [navigate, isAuthenticated, me, navigateToLogin]);

  if (!ok) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-[#1a1b4b]" />
      </div>
    );
  }

  return children;
}