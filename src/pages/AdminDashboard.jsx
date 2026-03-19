import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import RoleGuard from "@/components/RoleGuard";
import DashboardLayout from "@/components/DashboardLayout";
import { Loader2, LayoutDashboard, Users, BarChart2, ShieldCheck, Wrench } from "lucide-react";
import AdminOverview from "@/components/admin/AdminOverview";
import AdminUsersManagement from "@/components/admin/AdminUsersManagement";
import AdminFinancials from "@/components/admin/AdminFinancials";
import AdminCompliance from "@/components/admin/AdminCompliance";
import AdminPDFTools from "@/components/admin/AdminPDFTools";

const NAV = [
  { id: "overview",    label: "Dashboard Overview",    icon: LayoutDashboard },
  { id: "users",       label: "Users Management",       icon: Users },
  { id: "financials",  label: "Financial Analytics",    icon: BarChart2 },
  { id: "compliance",  label: "Compliance & Audit",     icon: ShieldCheck },
  { id: "tools",       label: "App Tools",              icon: Wrench },
];

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [applications, setApplications] = useState([]);
  const [pdfLessons, setPdfLessons] = useState([]);
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const me = await base44.auth.me();
      setUser(me);
      const [apps, pdfs, studs, pays, tchrs] = await Promise.all([
        base44.entities.TeacherSignupRequest.list("-created_date"),
        base44.entities.PDFLesson.list("-created_date"),
        base44.entities.StudentProfile.list("-created_date"),
        base44.entities.Payment.list("-created_date", 100),
        base44.entities.TeacherProfile.list("-created_date"),
      ]);
      setApplications(apps);
      setPdfLessons(pdfs);
      setStudents(studs);
      setPayments(pays);
      setTeachers(tchrs);
      setLoading(false);
    })();
  }, []);

  const pendingApps = applications.filter(a => a.status === "pending").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-[#1a1b4b]" />
      </div>
    );
  }

  return (
    <RoleGuard allowedRoles={["admin"]}>
      <DashboardLayout
        user={user}
        navItems={NAV}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        sectionLabel="Overseer Mode"
        badge={{ tabId: "compliance", count: pendingApps }}
      >
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#1a1b4b]">
            {NAV.find(n => n.id === activeTab)?.label}
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">Platform management & oversight</p>
        </div>

        {activeTab === "overview" && (
          <AdminOverview
            students={students}
            teachers={teachers}
            pendingApps={pendingApps}
            onGoToCompliance={() => setActiveTab("compliance")}
          />
        )}
        {activeTab === "users" && (
          <AdminUsersManagement teachers={teachers} students={students} />
        )}
        {activeTab === "financials" && (
          <AdminFinancials />
        )}
        {activeTab === "compliance" && (
          <AdminCompliance applications={applications} onApplicationsChange={setApplications} />
        )}
        {activeTab === "tools" && (
          <div className="rounded-2xl border-2 border-dashed border-gray-200 p-16 text-center">
            <Wrench className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400 font-medium">App Tools</p>
            <p className="text-gray-300 text-sm mt-1">Platform settings coming soon</p>
          </div>
        )}
      </DashboardLayout>
    </RoleGuard>
  );
}