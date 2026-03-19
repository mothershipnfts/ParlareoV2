import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import {
  Wallet, TrendingUp, ArrowDownToLine, Clock, CheckCircle2,
  Loader2, Send, RefreshCw, Shield
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import WithdrawModal from "@/components/wallet/WithdrawModal";
import TransactionList from "@/components/wallet/TransactionList";

export default function TeacherWalletTab({ user }) {
  const [wallet, setWallet] = useState(null);
  const [teacher, setTeacher] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [heldEur, setHeldEur] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [stripeStatus, setStripeStatus] = useState(null);

  useEffect(() => {
    if (!user?.email) {
      setLoading(false);
      return;
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get("stripe_success")) {
      setStripeStatus("success");
      setTimeout(() => setStripeStatus(null), 3000);
    } else if (params.get("stripe_refresh")) {
      setStripeStatus("refresh");
    }
    loadData();
  }, [user?.email]);

  const loadData = async () => {
    if (!user?.email) return;
    setLoading(true);
    try {
      const [profiles, wallets, txns, subs] = await Promise.all([
        base44.entities.TeacherProfile.filter({ user_email: user.email }),
        base44.entities.TeacherWallet.filter({ teacher_email: user.email }),
        base44.entities.WalletTransaction.filter({ teacher_email: user.email }, "-created_date", 50),
        base44.entities.StudentTeacherSubscription.filter({ teacher_email: user.email }),
      ]);

      if (profiles.length > 0) setTeacher(profiles[0]);

      let myWallet = wallets.length > 0 ? wallets[0] : null;
      if (!myWallet) {
        myWallet = await base44.entities.TeacherWallet.create({
          teacher_email: user.email,
          balance: 0,
          total_earned: 0,
          total_withdrawn: 0,
          pending_balance: 0,
          currency: "EUR",
        });
      }
      setWallet(myWallet);
      setTransactions(txns);
      setHeldEur(subs.reduce((sum, s) => sum + (s.held_eur || 0), 0));
    } catch (error) {
      console.error("Error loading wallet data:", error);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-[#1a1b4b]" />
      </div>
    );
  }

  const stats = [
    { label: "Available Balance", value: `€${(wallet?.balance || 0).toFixed(2)}`, icon: Wallet, color: "bg-emerald-50 text-emerald-600", accent: "border-emerald-200" },
    { label: "Total Earned", value: `€${(wallet?.total_earned || 0).toFixed(2)}`, icon: TrendingUp, color: "bg-blue-50 text-blue-600", accent: "border-blue-200" },
    { label: "Student Credits Held", value: `€${(wallet?.pending_balance || 0).toFixed(2)}`, icon: Clock, color: "bg-amber-50 text-amber-600", accent: "border-amber-200" },
    { label: "Total Withdrawn", value: `€${(wallet?.total_withdrawn || 0).toFixed(2)}`, icon: ArrowDownToLine, color: "bg-purple-50 text-purple-600", accent: "border-purple-200" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1b4b]">Wallet & Analytics</h1>
          <p className="text-gray-400 text-sm mt-1">Manage your earnings and secure withdrawals</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="sm" className="rounded-full gap-2" onClick={loadData}>
            <RefreshCw className="w-4 h-4" /> Refresh
          </Button>
          <Button
            onClick={() => setShowWithdraw(true)}
            disabled={!wallet || wallet.balance <= 0}
            className="bg-[#f97066] hover:bg-[#e8605a] rounded-full gap-2"
          >
            <Send className="w-4 h-4" /> Withdraw Funds
          </Button>
        </div>
      </div>

      {/* Stripe status */}
      {stripeStatus === "success" && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-green-50 border border-green-200 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-600" />
          <div>
            <p className="font-semibold text-green-800">Stripe setup successful!</p>
            <p className="text-sm text-green-700">Your account is ready for instant payouts.</p>
          </div>
        </motion.div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
            <Card className={`border shadow-sm ${stat.accent}`}>
              <CardContent className="p-5">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${stat.color}`}>
                  <stat.icon className="w-4 h-4" />
                </div>
                <p className="text-xs text-gray-400 mb-1">{stat.label}</p>
                <p className="text-2xl font-bold text-[#1a1b4b]">{stat.value}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* How it works */}
      <Card className="border border-blue-100 bg-blue-50 shadow-none">
        <CardContent className="p-4 space-y-3">
          {[
            { n: 1, title: "Students buy lesson credits", desc: "Funds are securely held by Stripe" },
            { n: 2, title: "Lesson marked as completed", desc: "Your net earnings (after commission) are credited to your balance" },
            { n: 3, title: "Request a withdrawal", desc: "Processed within 2-3 business days" },
          ].map(({ n, title, desc }) => (
            <div key={n} className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-blue-200 flex items-center justify-center text-sm font-bold text-blue-700 flex-shrink-0">{n}</div>
              <div>
                <p className="font-semibold text-blue-900">{title}</p>
                <p className="text-sm text-blue-700">{desc}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Transactions */}
      <div>
        <h2 className="text-lg font-bold text-[#1a1b4b] mb-4">Transaction History</h2>
        <TransactionList transactions={transactions} />
      </div>

      {showWithdraw && (
        <WithdrawModal
          wallet={wallet}
          teacher={teacher}
          onClose={() => setShowWithdraw(false)}
          onSuccess={loadData}
        />
      )}
    </div>
  );
}