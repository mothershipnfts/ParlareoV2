import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { CreditCard, Shield, Lock, CheckCircle2, XCircle, Clock, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

const statusConfig = {
  completed: { label: "Completed", icon: CheckCircle2, color: "bg-emerald-100 text-emerald-700" },
  pending:   { label: "Pending",   icon: Clock,        color: "bg-amber-100 text-amber-700" },
  refunded:  { label: "Refunded",  icon: XCircle,      color: "bg-red-100 text-red-700" },
  failed:    { label: "Failed",    icon: XCircle,      color: "bg-red-100 text-red-700" },
};

export default function StudentWalletTab({ user }) {
  const [payments, setPayments] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      base44.entities.Payment.filter({ student_email: user.email }, "-created_date", 50),
      base44.entities.StudentTeacherSubscription.filter({ student_email: user.email })
    ]).then(([p, subs]) => {
      // Only show completed and refunded — hide pending (open checkout sessions) and failed (declined cards)
      setPayments(p.filter(pay => pay.status === "completed" || pay.status === "refunded"));
      setSubscriptions(subs);
      setLoading(false);
    });
  }, [user]);

  const totalSpent = payments.filter(p => p.status === "completed").reduce((s, p) => s + (p.amount || 0), 0);
  const totalAvailable = subscriptions.reduce((s, sub) => s + (sub.balance_eur || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1a1b4b]">Wallet & Payments</h1>
        <p className="text-gray-400 text-sm mt-1">All lesson payments processed securely via Stripe in EUR</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Available Balance</p>
            <p className="text-2xl font-bold text-emerald-600">€{totalAvailable.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Total Spent</p>
            <p className="text-2xl font-bold text-[#1a1b4b]">€{totalSpent.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Payments</p>
            <p className="text-2xl font-bold text-[#1a1b4b]">{payments.filter(p => p.status === "completed").length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Security badge */}
      <Card className="border border-green-100 bg-green-50 shadow-none">
        <CardContent className="p-4 flex items-center gap-3">
          <Shield className="w-5 h-5 text-green-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-green-800">Secure Payments via Stripe</p>
            <p className="text-xs text-green-600">Card details are encrypted and never stored on our servers.</p>
          </div>
          <Lock className="w-4 h-4 text-green-400 flex-shrink-0" />
        </CardContent>
      </Card>

      {/* Payment History */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Payment History</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-300" /></div>
          ) : payments.length === 0 ? (
            <div className="text-center py-10">
              <CreditCard className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">No payments yet. Purchase lesson packages from a tutor's profile.</p>
            </div>
          ) : (
            <div className="space-y-0">
              {payments.map(p => {
                const cfg = statusConfig[p.status] || statusConfig.pending;
                const Icon = cfg.icon;
                return (
                  <div key={p.id} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${cfg.color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[#1a1b4b]">
                          {p.lessons_count} lesson{p.lessons_count !== 1 ? "s" : ""}
                          {p.session_duration ? ` · ${p.session_duration}min` : ""}
                        </p>
                        <p className="text-xs text-gray-400">
                          {p.created_date ? format(new Date(p.created_date), "MMM d, yyyy") : ""}
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-3">
                      <Badge className={`rounded-full text-xs ${cfg.color}`}>{cfg.label}</Badge>
                      <p className="font-bold text-[#1a1b4b]">€{(p.amount || 0).toFixed(2)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}