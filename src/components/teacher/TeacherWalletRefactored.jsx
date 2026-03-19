import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, DollarSign, TrendingUp, Send, CheckCircle2, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import TransactionList from "../wallet/TransactionList";

export default function TeacherWalletRefactored({ user }) {
  const [teacher, setTeacher] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [commissionInfo, setCommissionInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [withdrawing, setWithdrawing] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Get teacher profile
      const teachers = await base44.entities.TeacherProfile.filter({
        user_email: user.email
      });
      if (teachers.length > 0) {
        setTeacher(teachers[0]);

        // Get commission info
        const commResponse = await base44.functions.invoke('getTeacherCommissionRate', {
          teacher_email: user.email
        });
        setCommissionInfo(commResponse.data);
      }

      // Get wallet
      const wallets = await base44.entities.TeacherWallet.filter({
        teacher_email: user.email
      });
      if (wallets.length > 0) {
        setWallet(wallets[0]);
      }

      // Get transactions
      const txns = await base44.entities.WalletTransaction.filter(
        { teacher_email: user.email },
        "-created_date",
        50
      );
      setTransactions(txns);
    } catch (error) {
      console.error('Error loading wallet:', error);
    }

    setLoading(false);
  };

  const handleInstantPayout = async () => {
    if (!teacher || !wallet || wallet.balance <= 0) return;

    setWithdrawing(true);
    try {
      // In production, this would trigger a Stripe transfer
      await base44.entities.WalletTransaction.create({
        teacher_email: user.email,
        teacher_name: teacher.full_name,
        type: 'withdrawal',
        amount: wallet.balance,
        currency: 'EUR',
        status: 'completed',
        withdrawal_method: teacher.withdrawal_method || 'stripe',
        withdrawal_account: teacher.withdrawal_account,
        notes: 'Instant Stripe payout'
      });

      // Update wallet
      await base44.entities.TeacherWallet.update(wallet.id, {
        balance: 0,
        total_withdrawn: (wallet.total_withdrawn || 0) + wallet.balance
      });

      setMessage({ type: 'success', text: `€${wallet.balance.toFixed(2)} withdrawn successfully!` });
      setTimeout(() => {
        setMessage(null);
        loadData();
      }, 2000);
    } catch (error) {
      setMessage({ type: 'error', text: 'Withdrawal failed: ' + error.message });
    } finally {
      setWithdrawing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-[#1a1b4b]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1a1b4b]">Wallet & Payouts</h1>
        <p className="text-gray-400 text-sm mt-1">Manage earnings and instant withdrawals</p>
      </div>

      {/* Status Messages */}
      {message && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-xl border flex items-center gap-3 ${
            message.type === 'success'
              ? 'bg-green-50 border-green-200'
              : 'bg-red-50 border-red-200'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-green-600" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600" />
          )}
          <p className={message.type === 'success' ? 'text-green-800' : 'text-red-800'}>
            {message.text}
          </p>
        </motion.div>
      )}

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Current Monthly Earnings */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="border border-blue-100 bg-gradient-to-br from-blue-50 to-blue-50/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                This Month
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-[#1a1b4b]">
                €{((wallet?.balance || 0) + (wallet?.total_withdrawn || 0)).toFixed(2)}
              </p>
              <p className="text-xs text-gray-500 mt-1">Current + withdrawn</p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Available for Payout */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="border border-green-100 bg-gradient-to-br from-green-50 to-green-50/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <DollarSign className="w-4 h-4 text-green-600" />
                Available
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-[#1a1b4b]">
                €{(wallet?.balance || 0).toFixed(2)}
              </p>
              <p className="text-xs text-gray-500 mt-1">Ready to withdraw</p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Commission Tier */}
        {commissionInfo && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="border border-amber-100 bg-gradient-to-br from-amber-50 to-amber-50/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  Commission Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-bold text-[#1a1b4b]">
                    {(commissionInfo.teacher_net_rate * 100).toFixed(1)}%
                  </p>
                  <Badge className="bg-amber-100 text-amber-900">{commissionInfo.tier_name}</Badge>
                </div>
                <p className="text-xs text-gray-500 mt-1">Admin takes {(commissionInfo.commission_rate * 100).toFixed(1)}%</p>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>

      {/* Instant Payout Section */}
      {wallet && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`p-6 rounded-xl border-2 ${
            wallet.balance > 0
              ? 'border-green-300 bg-green-50'
              : 'border-gray-200 bg-gray-50'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-lg text-[#1a1b4b]">Ready to Withdraw?</h3>
              <p className={`text-sm mt-1 ${wallet.balance > 0 ? 'text-green-700' : 'text-gray-600'}`}>
                {wallet.balance > 0
                  ? `You have €${wallet.balance.toFixed(2)} available for instant withdrawal via Stripe`
                  : 'No funds available right now. Complete more lessons to earn!'}
              </p>
            </div>
            <Button
              onClick={handleInstantPayout}
              disabled={!wallet || wallet.balance <= 0 || withdrawing}
              className={`rounded-full gap-2 ${
                wallet.balance > 0
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-gray-400'
              }`}
            >
              {withdrawing ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
              ) : (
                <><Send className="w-4 h-4" /> Instant Payout</>
              )}
            </Button>
          </div>
        </motion.div>
      )}

      {/* How It Works */}
      <Card className="border border-blue-100 bg-blue-50">
        <CardContent className="p-4 space-y-3">
          <h3 className="font-semibold text-blue-900">How Payments Work</h3>
          <div className="space-y-2 text-sm text-blue-800">
            <div className="flex gap-3">
              <span className="font-bold">1.</span>
              <span>Student books and pays for a lesson</span>
            </div>
            <div className="flex gap-3">
              <span className="font-bold">2.</span>
              <span>After completion, your earnings minus commission are added to your balance</span>
            </div>
            <div className="flex gap-3">
              <span className="font-bold">3.</span>
              <span>Click "Instant Payout" to transfer directly to your bank</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transaction History */}
      <div>
        <h2 className="text-lg font-bold text-[#1a1b4b] mb-4">Transaction History</h2>
        <TransactionList transactions={transactions} />
      </div>
    </div>
  );
}