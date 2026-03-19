import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import RoleGuard from "@/components/RoleGuard";
import { Clock, AlertCircle, UserCircle, Calendar, Settings, Lock, GraduationCap, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const AVAILABLE_LINKS = [
  { name: "My Profile", page: "TeacherProfileEdit", icon: UserCircle, description: "Complete your bio, set rates & preferences" },
  { name: "Manage Schedule", page: "ManageSchedule", icon: Calendar, description: "Set your availability for when you're approved" },
];

const LOCKED_LINKS = [
  { name: "Student Lessons", icon: GraduationCap, description: "Available after approval" },
  { name: "Wallet", icon: Settings, description: "Available after approval" },
];

export default function TeacherPendingReview() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  return (
    <RoleGuard allowedRoles={["teacher", "admin"]}>
      <div className="min-h-screen bg-[#faf9f7]">
        {/* Review Banner */}
        <div className="bg-amber-500 text-white px-6 py-4">
          <div className="max-w-4xl mx-auto flex items-start gap-3">
            <Clock className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-sm">Your documents are currently under review</p>
              <p className="text-amber-100 text-sm mt-0.5">
                Your ID and certificates are being reviewed by our admin team (2–3 business days).
                In the meantime, you can complete your profile, set your rates, and configure your availability —
                but you are <strong>not yet visible to students</strong>.
              </p>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-6 py-10">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-[#1a1b4b]">Welcome, {user?.full_name?.split(' ')[0] || 'Teacher'}!</h1>
              <Badge className="bg-amber-100 text-amber-700 border-0 rounded-full">Pending Review</Badge>
            </div>
            <p className="text-gray-500">Your account is set up. Here's what you can do while you wait.</p>
          </div>

          {/* Status Card */}
          <Card className="border-0 shadow-sm bg-white mb-6">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center">
                  <AlertCircle className="w-7 h-7 text-amber-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-[#1a1b4b]">Application Under Review</h3>
                  <p className="text-sm text-gray-500 mt-0.5">Our team will email you once a decision has been made. This typically takes 2–3 business days.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Available Now */}
          <h2 className="text-lg font-bold text-[#1a1b4b] mb-3">Available now</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            {AVAILABLE_LINKS.map((link) => (
              <Link key={link.page} to={createPageUrl(link.page)}>
                <Card className="border-0 shadow-sm bg-white hover:shadow-md transition-shadow cursor-pointer group h-full">
                  <CardContent className="p-5 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-[#1a1b4b]/5 flex items-center justify-center group-hover:bg-[#f97066]/10 transition-colors">
                      <link.icon className="w-5 h-5 text-[#1a1b4b] group-hover:text-[#f97066] transition-colors" />
                    </div>
                    <div>
                      <p className="font-semibold text-[#1a1b4b] text-sm">{link.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{link.description}</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {/* Locked */}
          <h2 className="text-lg font-bold text-gray-400 mb-3">Locked until approved</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            {LOCKED_LINKS.map((link) => (
              <Card key={link.name} className="border-0 shadow-sm bg-gray-50 opacity-60">
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center relative">
                    <link.icon className="w-5 h-5 text-gray-400" />
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-gray-200 rounded-full flex items-center justify-center">
                      <Lock className="w-2.5 h-2.5 text-gray-500" />
                    </div>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-400 text-sm">{link.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{link.description}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <button
            onClick={() => base44.auth.logout()}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </div>
    </RoleGuard>
  );
}