import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, DollarSign, Users, Clock, Send, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import AdminEarningsWithdrawal from "./AdminEarningsWithdrawal";

const SUB_TABS = ["Overview", "Per Teacher", "Student Bookings", "Commission Log", "Withdrawals", "Stripe Payouts", "Admin Earnings"];

export default function AdminFinancials() {
  const [sub, setSub] = useState("Overview");
  const [loading, setLoading] = useState(true);
  const [commissions, setCommissions] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [walletTxns, setWalletTxns] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [teacherProfiles, setTeacherProfiles] = useState([]);
  const [studentProfiles, setStudentProfiles] = useState([]);
  const [processingPayout, setProcessingPayout] = useState(null);
  const [payoutMessage, setPayoutMessage] = useState(null);

  useEffect(() => {
    (async () => {
      const [comms, wlts, txns, bkgs, tps, sps] = await Promise.all([
        base44.entities.AdminCommission.list("-created_date", 500),
        base44.entities.TeacherWallet.list(),
        base44.entities.WalletTransaction.list("-created_date", 500),
        base44.entities.Booking.list("-created_date", 500),
        base44.entities.TeacherProfile.list(),
        base44.entities.StudentProfile.list(),
      ]);
      setCommissions(comms);
      setWallets(wlts);
      setWalletTxns(txns);
      setBookings(bkgs);
      setTeacherProfiles(tps);
      setStudentProfiles(sps);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-[#1a1b4b]" /></div>;
  }

  // Aggregates
  const totalCommissionEarned = commissions.reduce((s, c) => s + (c.commission_amount || 0), 0);
  const totalGross = commissions.reduce((s, c) => s + (c.gross_amount || 0), 0);
  const totalTeacherNet = commissions.reduce((s, c) => s + (c.teacher_net || 0), 0);
  const pendingWithdrawals = walletTxns.filter(t => t.type === "withdrawal" && t.status === "pending");
  const pendingWithdrawTotal = pendingWithdrawals.reduce((s, t) => s + (t.amount || 0), 0);
  const completedLessons = bookings.filter(b => b.status === "completed");

  // Per-teacher breakdown
  const teacherMap = {};
  commissions.forEach(c => {
    if (!teacherMap[c.teacher_email]) {
      const profile = teacherProfiles.find(p => p.user_email === c.teacher_email);
      teacherMap[c.teacher_email] = {
        email: c.teacher_email,
        name: profile?.full_name || c.teacher_email,
        gross: 0, commission: 0, net: 0, lessons: 0,
      };
    }
    teacherMap[c.teacher_email].gross += c.gross_amount || 0;
    teacherMap[c.teacher_email].commission += c.commission_amount || 0;
    teacherMap[c.teacher_email].net += c.teacher_net || 0;
    teacherMap[c.teacher_email].lessons += 1;
  });
  const teacherRows = Object.values(teacherMap).sort((a, b) => b.gross - a.gross);

  // Per-student bookings
  const studentMap = {};
  bookings.forEach(b => {
    if (!studentMap[b.student_email]) {
      const profile = studentProfiles.find(p => p.user_email === b.student_email);
      studentMap[b.student_email] = {
        email: b.student_email,
        name: b.student_name || profile?.full_name || b.student_email,
        total: 0, completed: 0, scheduled: 0, canceled: 0,
      };
    }
    studentMap[b.student_email].total += 1;
    if (b.status === "completed") studentMap[b.student_email].completed += 1;
    if (b.status === "scheduled") studentMap[b.student_email].scheduled += 1;
    if (b.status === "canceled" || b.status === "cancelled") studentMap[b.student_email].canceled += 1;
  });
  const studentRows = Object.values(studentMap).sort((a, b) => b.total - a.total);

  // Withdrawals (all, by teacher)
  const withdrawals = walletTxns.filter(t => t.type === "withdrawal").sort((a, b) => new Date(b.created_date) - new Date(a.created_date));

  // Process payout via Stripe
  const processPayout = async (withdrawalTxn) => {
    setProcessingPayout(withdrawalTxn.id);
    try {
      const response = await base44.functions.invoke('processTeacherWithdrawal', {
        withdrawal_id: withdrawalTxn.id,
        teacher_email: withdrawalTxn.teacher_email,
        amount: withdrawalTxn.amount,
        withdrawal_method: withdrawalTxn.withdrawal_method,
        withdrawal_account: withdrawalTxn.withdrawal_account,
      });

      if (response.data.success) {
        setPayoutMessage({ type: 'success', text: `Payout of €${withdrawalTxn.amount.toFixed(2)} processed successfully!` });
        setTimeout(() => { setPayoutMessage(null); window.location.reload(); }, 2000);
      } else {
        setPayoutMessage({ type: 'error', text: response.data.error || 'Payout processing failed' });
      }
    } catch (error) {
      setPayoutMessage({ type: 'error', text: error.message || 'Payout error' });
    } finally {
      setProcessingPayout(null);
    }
  };

  const statusColors = {
    completed: "bg-emerald-100 text-emerald-700",
    pending: "bg-amber-100 text-amber-700",
    failed: "bg-red-100 text-red-700",
  };

  return (
    <div className="space-y-5">
      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Gross Revenue", value: `$${totalGross.toFixed(2)}`, icon: DollarSign, color: "bg-blue-50 text-blue-600" },
          { label: "Admin Commission Earned", value: `$${totalCommissionEarned.toFixed(2)}`, icon: TrendingUp, color: "bg-emerald-50 text-emerald-600" },
          { label: "Teacher Net Earnings", value: `$${totalTeacherNet.toFixed(2)}`, icon: Users, color: "bg-violet-50 text-violet-600" },
          { label: "Pending Withdrawals", value: `$${pendingWithdrawTotal.toFixed(2)}`, icon: Clock, color: "bg-amber-50 text-amber-600" },
        ].map((kpi, i) => (
          <Card key={i} className="border-0 shadow-sm">
            <CardContent className="p-5 flex items-center gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${kpi.color}`}>
                <kpi.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-gray-400">{kpi.label}</p>
                <p className="text-xl font-bold text-[#1a1b4b]">{kpi.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Sub-tab nav */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit flex-wrap">
        {SUB_TABS.map(t => (
          <button key={t} onClick={() => setSub(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${sub === t ? "bg-white text-[#1a1b4b] shadow-sm" : "text-gray-500 hover:text-[#1a1b4b]"}`}>
            {t}
            {t === "Withdrawals" && pendingWithdrawals.length > 0 && (
              <span className="ml-1.5 bg-amber-500 text-white text-xs rounded-full px-1.5 py-0.5">{pendingWithdrawals.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Overview */}
       {sub === "Overview" && (
         <div className="space-y-4">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-0 shadow-sm">
            <CardHeader><CardTitle className="text-base">Revenue Split</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-gray-50">
                <span className="text-sm text-gray-500">Total Gross Collected</span>
                <span className="font-bold text-[#1a1b4b]">${totalGross.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-50">
                <span className="text-sm text-gray-500">Admin Commission (15% / 10%)</span>
                <span className="font-bold text-emerald-600">${totalCommissionEarned.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-50">
                <span className="text-sm text-gray-500">Teachers Net Earnings</span>
                <span className="font-bold text-violet-600">${totalTeacherNet.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-gray-500">Completed Lessons</span>
                <span className="font-bold text-[#1a1b4b]">{completedLessons.length}</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardHeader><CardTitle className="text-base">Commission Tiers</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: "Starter (0–99 lessons)", rate: "15%", color: "bg-blue-50", text: "text-blue-800", sub: "text-blue-600" },
                { label: "Rising (100–199 lessons)", rate: "14%", color: "bg-indigo-50", text: "text-indigo-800", sub: "text-indigo-600" },
                { label: "Skilled (200–299 lessons)", rate: "13%", color: "bg-violet-50", text: "text-violet-800", sub: "text-violet-600" },
                { label: "Experienced (300–399)", rate: "12%", color: "bg-amber-50", text: "text-amber-800", sub: "text-amber-600" },
                { label: "Senior (400–499 lessons)", rate: "11%", color: "bg-orange-50", text: "text-orange-800", sub: "text-orange-600" },
                { label: "Expert (500+ lessons)", rate: "10%", color: "bg-emerald-50", text: "text-emerald-800", sub: "text-emerald-600" },
              ].map(tier => (
                <div key={tier.label} className={`p-3 rounded-xl ${tier.color} flex items-center justify-between`}>
                  <p className={`text-xs font-semibold ${tier.text}`}>{tier.label}</p>
                  <span className={`text-xs font-bold ${tier.text}`}>{tier.rate}</span>
                </div>
              ))}
              <div className="p-3 rounded-xl bg-amber-50">
                <p className="text-sm font-semibold text-amber-800">Pending Withdrawals</p>
                <p className="text-xs text-amber-600 mt-0.5">${pendingWithdrawTotal.toFixed(2)} across {pendingWithdrawals.length} requests awaiting processing</p>
              </div>
            </CardContent>
            </Card>
            </div>
            </div>
            )}

      {/* Per Teacher */}
      {sub === "Per Teacher" && (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              Teacher Earnings Breakdown
              <span className="text-sm font-normal text-gray-400">{teacherRows.length} teachers</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {teacherRows.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">No completed lessons yet</p>
            ) : (
              <div className="space-y-0">
                <div className="grid grid-cols-6 text-xs text-gray-400 font-medium pb-2 border-b border-gray-100 px-2">
                  <span className="col-span-2">Teacher</span>
                  <span className="text-right">Lessons</span>
                  <span className="text-right">Gross</span>
                  <span className="text-right">Commission</span>
                  <span className="text-right">Net Earned</span>
                </div>
                {teacherRows.map(row => {
                  const wallet = wallets.find(w => w.teacher_email === row.email);
                  const reductions = Math.min(Math.floor(row.lessons / 100), 5);
                  const rate = `${15 - reductions}%`;
                  return (
                    <div key={row.email} className="grid grid-cols-6 py-3 border-b border-gray-50 last:border-0 px-2 hover:bg-gray-50 rounded-xl">
                      <div className="col-span-2">
                        <p className="text-sm font-semibold text-[#1a1b4b]">{row.name}</p>
                        <p className="text-xs text-gray-400">{row.email} · <span className="text-blue-500">{rate} rate</span></p>
                      </div>
                      <span className="text-sm text-right self-center font-medium">{row.lessons}</span>
                      <span className="text-sm text-right self-center text-gray-600">${row.gross.toFixed(2)}</span>
                      <span className="text-sm text-right self-center text-emerald-600">${row.commission.toFixed(2)}</span>
                      <div className="text-right self-center">
                        <p className="text-sm font-bold text-violet-600">${row.net.toFixed(2)}</p>
                        <p className="text-xs text-gray-400">Balance: ${(wallet?.balance || 0).toFixed(2)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Student Bookings */}
      {sub === "Student Bookings" && (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              Student Lesson Activity
              <span className="text-sm font-normal text-gray-400">{studentRows.length} students</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {studentRows.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">No bookings yet</p>
            ) : (
              <div className="space-y-0">
                <div className="grid grid-cols-5 text-xs text-gray-400 font-medium pb-2 border-b border-gray-100 px-2">
                  <span className="col-span-2">Student</span>
                  <span className="text-right">Total</span>
                  <span className="text-right">Completed</span>
                  <span className="text-right">Scheduled</span>
                </div>
                {studentRows.map(row => (
                  <div key={row.email} className="grid grid-cols-5 py-3 border-b border-gray-50 last:border-0 px-2 hover:bg-gray-50 rounded-xl">
                    <div className="col-span-2">
                      <p className="text-sm font-semibold text-[#1a1b4b]">{row.name}</p>
                      <p className="text-xs text-gray-400">{row.email}</p>
                    </div>
                    <span className="text-sm text-right self-center font-medium">{row.total}</span>
                    <span className="text-sm text-right self-center text-emerald-600">{row.completed}</span>
                    <span className="text-sm text-right self-center text-blue-600">{row.scheduled}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Commission Log */}
      {sub === "Commission Log" && (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              Admin Commission Log
              <span className="text-sm font-normal text-gray-400">Total: ${totalCommissionEarned.toFixed(2)}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {commissions.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">No commissions recorded yet</p>
            ) : (
              <div className="space-y-0">
                {commissions.map(c => (
                  <div key={c.id} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-[#1a1b4b]">{c.teacher_name || c.teacher_email}</p>
                      <p className="text-xs text-gray-400">
                        Student: {c.student_name} · {c.lesson_date} · {c.session_duration}min ·&nbsp;
                        <span className={c.commission_rate <= 0.10 ? "text-emerald-600" : "text-blue-600"}>
                          {Math.round(c.commission_rate * 100)}% rate
                        </span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-emerald-600">+${c.commission_amount?.toFixed(2)}</p>
                      <p className="text-xs text-gray-400">Gross: ${c.gross_amount?.toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Withdrawals */}
      {sub === "Withdrawals" && (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              Withdrawal Requests
              {pendingWithdrawals.length > 0 && (
                <Badge className="bg-amber-100 text-amber-700 rounded-full">
                  {pendingWithdrawals.length} pending
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {withdrawals.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">No withdrawal requests yet</p>
            ) : (
              <div className="space-y-0">
                {withdrawals.map(txn => (
                  <div key={txn.id} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-[#1a1b4b]">{txn.notes?.split("(")[0]?.replace("Withdrawal request from", "")?.trim() || txn.created_by}</p>
                      <p className="text-xs text-gray-400">
                        Via: {txn.withdrawal_method} · {txn.withdrawal_account} ·&nbsp;
                        {txn.created_date ? format(new Date(txn.created_date), "MMM d, yyyy") : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={`rounded-full text-xs ${statusColors[txn.status] || statusColors.pending}`}>
                        {txn.status}
                      </Badge>
                      <span className="font-bold text-[#1a1b4b]">${txn.amount?.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Admin Earnings & Withdrawal */}
      {sub === "Admin Earnings" && (
        <AdminEarningsWithdrawal
          totalCommissionEarned={totalCommissionEarned}
          walletTxns={walletTxns}
        />
      )}

      {/* Stripe Payouts */}
      {sub === "Stripe Payouts" && (
       <Card className="border-0 shadow-sm">
         <CardHeader>
           <CardTitle className="text-base">Instant Stripe Payouts</CardTitle>
           <p className="text-sm text-gray-400 mt-1">Admin-controlled payouts to teachers via Stripe Connect. Students pay admin, admin pays teachers.</p>
         </CardHeader>
         <CardContent className="space-y-4">
           {payoutMessage && (
             <div className={`p-4 rounded-xl flex items-start gap-3 ${payoutMessage.type === 'success' ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
               <AlertCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${payoutMessage.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`} />
               <p className={`text-sm font-medium ${payoutMessage.type === 'success' ? 'text-emerald-800' : 'text-red-800'}`}>{payoutMessage.text}</p>
             </div>
           )}

           {pendingWithdrawals.length === 0 ? (
             <p className="text-gray-400 text-sm text-center py-8">No pending withdrawal requests</p>
           ) : (
             <div className="space-y-3">
               {pendingWithdrawals.map(txn => {
                 const teacher = teacherProfiles.find(t => t.user_email === txn.teacher_email);
                 const hasStripeConnect = teacher?.stripe_connected_account_id;

                 return (
                   <div key={txn.id} className="p-4 rounded-xl border border-gray-200 bg-white hover:shadow-md transition-shadow">
                     <div className="flex items-start justify-between gap-4">
                       <div className="flex-1">
                         <p className="font-semibold text-[#1a1b4b]">{txn.teacher_name || txn.teacher_email}</p>
                         <div className="mt-2 space-y-1 text-sm text-gray-500">
                           <p>Method: <span className="font-medium capitalize text-gray-700">{txn.withdrawal_method}</span></p>
                           <p>Account: <span className="font-medium text-gray-700 font-mono text-xs">{txn.withdrawal_account}</span></p>
                           <p>Requested: {format(new Date(txn.created_date), "MMM d, yyyy 'at' HH:mm")}</p>
                           {!hasStripeConnect && (
                             <p className="text-amber-600 text-xs mt-2 flex items-center gap-1">
                               <AlertCircle className="w-3 h-3" />
                               Teacher hasn't connected Stripe - manual processing required
                             </p>
                           )}
                         </div>
                       </div>
                       <div className="text-right">
                         <p className="text-2xl font-bold text-[#1a1b4b]">€{txn.amount.toFixed(2)}</p>
                         <Button
                           onClick={() => processPayout(txn)}
                           disabled={processingPayout === txn.id || !hasStripeConnect}
                           className="mt-3 bg-[#f97066] hover:bg-[#e8605a] rounded-full text-white gap-2"
                           size="sm"
                         >
                           {processingPayout === txn.id ? (
                             <><Loader2 className="w-3 h-3 animate-spin" /> Processing...</>
                           ) : (
                             <><Send className="w-3 h-3" /> Process Payout</>
                           )}
                         </Button>
                       </div>
                     </div>
                   </div>
                 );
               })}
             </div>
           )}

           {/* Info box */}
           <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 mt-6">
             <p className="text-sm font-semibold text-blue-900 mb-2">How it works:</p>
             <ul className="text-xs text-blue-700 space-y-1">
               <li>✓ Students pay the admin via Stripe</li>
               <li>✓ Teachers request withdrawal to PayPal, Wise, or bank account</li>
               <li>✓ Admin reviews and approves payouts here</li>
               <li>✓ With Stripe Connect: Instant transfer to teacher's account</li>
               <li>✓ Without Stripe: Manual processing (2-3 business days)</li>
             </ul>
           </div>
         </CardContent>
       </Card>
      )}
      </div>
      );
      }