import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, Loader2 } from "lucide-react";

export default function AdminOverview({ students, teachers, pendingApps, onGoToCompliance }) {
  const [commissions, setCommissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.AdminCommission.list("-created_date", 500).then(c => {
      setCommissions(c);
      setLoading(false);
    });
  }, []);

  const totalGross = commissions.reduce((s, c) => s + (c.gross_amount || 0), 0);
  const totalAdminCommission = commissions.reduce((s, c) => s + (c.commission_amount || 0), 0);

  const stats = [
    { label: "Total Students", value: students.length },
    { label: "Total Teachers", value: teachers.length },
    { label: "Pending Applications", value: pendingApps, alert: pendingApps > 0 },
    { label: "Total Gross Revenue", value: `$${totalGross.toFixed(2)}` },
    { label: "Admin Commission Earned", value: `$${totalAdminCommission.toFixed(2)}` },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {stats.map((stat, i) => (
          <Card key={i} className={`border-0 shadow-sm ${stat.alert ? "bg-amber-50 border border-amber-200" : ""}`}>
            <CardContent className="p-5">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{stat.label}</p>
              <p className={`text-2xl font-bold ${stat.alert ? "text-amber-700" : "text-[#1a1b4b]"}`}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {pendingApps > 0 && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600" />
          <p className="text-amber-700 text-sm font-medium">
            {pendingApps} teacher application{pendingApps > 1 ? "s" : ""} awaiting document review
          </p>
          <Button size="sm" onClick={onGoToCompliance} className="ml-auto bg-amber-600 hover:bg-amber-700 rounded-full text-xs">
            Review Now
          </Button>
        </div>
      )}

      <Card className="border-0 shadow-sm">
        <CardHeader><CardTitle>Recent Commission Activity</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-gray-300" /></div>
          ) : commissions.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-6">No completed lessons yet</p>
          ) : (
            commissions.slice(0, 8).map(c => (
              <div key={c.id} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-[#1a1b4b]">{c.teacher_name || c.teacher_email}</p>
                  <p className="text-xs text-gray-400">
                    Student: {c.student_name} · {c.lesson_date} · {c.session_duration}min
                  </p>
                </div>
                <div className="text-right">
                  <Badge className="rounded-full bg-emerald-100 text-emerald-700">
                    +${c.commission_amount?.toFixed(2)}
                  </Badge>
                  <p className="text-xs text-gray-400 mt-0.5">{Math.round((c.commission_rate || 0.15) * 100)}% rate</p>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}