import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, Send, AlertCircle, CheckCircle2 } from "lucide-react";

const METHODS = [
  { value: "stripe", label: "Stripe (instant)" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "paypal", label: "PayPal" },
];

export default function AdminEarningsWithdrawal({ totalCommissionEarned, walletTxns }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("stripe");
  const [account, setAccount] = useState("");
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState(null);

  const adminWithdrawals = walletTxns.filter(t => t.type === "admin_withdrawal");
  const totalWithdrawn = adminWithdrawals
    .filter(t => t.status === "completed")
    .reduce((s, t) => s + (t.amount || 0), 0);
  const available = parseFloat((totalCommissionEarned - totalWithdrawn).toFixed(2));

  const handleWithdraw = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0 || amt > available) {
      setMessage({ type: "error", text: `Enter a valid amount (max €${available.toFixed(2)})` });
      return;
    }
    setProcessing(true);
    setMessage(null);
    try {
      const res = await base44.functions.invoke("adminWithdrawal", {
        amount: amt,
        withdrawal_method: method,
        withdrawal_account: account,
      });
      if (res.data?.success) {
        setMessage({ type: "success", text: `€${amt.toFixed(2)} withdrawal ${res.data.status === "completed" ? "completed" : "requested"}!` });
        setAmount("");
      } else {
        setMessage({ type: "error", text: res.data?.error || "Withdrawal failed" });
      }
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    }
    setProcessing(false);
  };

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Earned", value: `€${totalCommissionEarned.toFixed(2)}`, color: "text-emerald-600" },
          { label: "Total Withdrawn", value: `€${totalWithdrawn.toFixed(2)}`, color: "text-[#1a1b4b]" },
          { label: "Available", value: `€${available.toFixed(2)}`, color: "text-[#f97066]" },
        ].map(s => (
          <Card key={s.label} className="border-0 shadow-sm">
            <CardContent className="p-5">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Withdraw form */}
      <Card className="border-0 shadow-sm">
        <CardHeader><CardTitle className="text-base">Withdraw Admin Earnings</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {message && (
            <div className={`p-3 rounded-xl flex items-center gap-2 ${message.type === "success" ? "bg-emerald-50 border border-emerald-200" : "bg-red-50 border border-red-200"}`}>
              {message.type === "success"
                ? <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                : <AlertCircle className="w-4 h-4 text-red-500" />}
              <p className={`text-sm font-medium ${message.type === "success" ? "text-emerald-800" : "text-red-800"}`}>{message.text}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Amount (EUR)</label>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder={`Max €${available.toFixed(2)}`}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a1b4b]/20"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Method</label>
              <select
                value={method}
                onChange={e => setMethod(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a1b4b]/20 bg-white"
              >
                {METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
          </div>
          {method !== "stripe" && (
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Account / IBAN</label>
              <input
                type="text"
                value={account}
                onChange={e => setAccount(e.target.value)}
                placeholder="PayPal email or IBAN"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a1b4b]/20"
              />
            </div>
          )}
          <Button
            onClick={handleWithdraw}
            disabled={processing || available <= 0}
            className="bg-[#f97066] hover:bg-[#e8605a] rounded-full gap-2"
          >
            {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Withdraw Earnings
          </Button>
        </CardContent>
      </Card>

      {/* Withdrawal history */}
      <Card className="border-0 shadow-sm">
        <CardHeader><CardTitle className="text-base">Withdrawal History</CardTitle></CardHeader>
        <CardContent>
          {adminWithdrawals.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">No withdrawals yet</p>
          ) : (
            <div className="space-y-0">
              {adminWithdrawals.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)).map(t => (
                <div key={t.id} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-[#1a1b4b]">{t.withdrawal_method} withdrawal</p>
                    <p className="text-xs text-gray-400">{t.notes}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className={t.status === "completed" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}>
                      {t.status}
                    </Badge>
                    <p className="font-bold text-[#1a1b4b]">€{t.amount?.toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}