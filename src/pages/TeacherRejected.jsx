import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import RoleGuard from "@/components/RoleGuard";
import { XCircle, RefreshCw, LogOut, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function TeacherRejected() {
  const [user, setUser] = useState(null);
  const [application, setApplication] = useState(null);

  useEffect(() => {
    (async () => {
      const me = await base44.auth.me().catch(() => null);
      setUser(me);
      if (me?.email) {
        const apps = await base44.entities.TeacherSignupRequest.filter({ email: me.email });
        if (apps.length > 0) {
          // Get the most recent
          const sorted = apps.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
          setApplication(sorted[0]);
        }
      }
    })();
  }, []);

  return (
    <RoleGuard allowedRoles={["teacher", "admin"]}>
      <div className="min-h-screen bg-[#faf9f7] flex items-center justify-center px-6">
        <div className="max-w-lg w-full">
          {/* Icon */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-10 h-10 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold text-[#1a1b4b]">Application Not Approved</h1>
            <p className="text-gray-500 mt-2">Hi {user?.full_name?.split(' ')[0]}, unfortunately your application was not approved at this time.</p>
          </div>

          {/* Rejection Reason */}
          {application?.rejection_reason && (
            <Card className="border-0 shadow-sm bg-red-50 border border-red-100 mb-6">
              <CardContent className="p-5">
                <p className="text-sm font-semibold text-red-700 mb-1">Reason from our team:</p>
                <p className="text-sm text-red-600">{application.rejection_reason}</p>
              </CardContent>
            </Card>
          )}

          {/* What to do */}
          <Card className="border-0 shadow-sm bg-white mb-6">
            <CardContent className="p-5 space-y-3">
              <p className="font-semibold text-[#1a1b4b] text-sm">What you can do:</p>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-[#f97066] font-bold mt-0.5">1.</span>
                  Address the issue mentioned in the rejection reason above.
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#f97066] font-bold mt-0.5">2.</span>
                  Prepare updated, clearer versions of your documents.
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#f97066] font-bold mt-0.5">3.</span>
                  Resubmit your application with the corrected files.
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="space-y-3">
            <Link to={createPageUrl("TeacherSignup")}>
              <Button className="w-full bg-[#f97066] hover:bg-[#e8605a] rounded-xl h-11">
                <RefreshCw className="w-4 h-4 mr-2" /> Resubmit Application
              </Button>
            </Link>
            <a href="mailto:support@fluentlyapp.com">
              <Button variant="outline" className="w-full rounded-xl h-11 border-gray-200">
                <Mail className="w-4 h-4 mr-2" /> Contact Support
              </Button>
            </a>
          </div>

          <button
            onClick={() => base44.auth.logout()}
            className="flex items-center justify-center gap-2 text-sm text-gray-400 hover:text-gray-600 transition-colors mt-6 w-full"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </div>
    </RoleGuard>
  );
}