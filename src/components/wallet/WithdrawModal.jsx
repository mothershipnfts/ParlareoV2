import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import {
  X, Send, Loader2, CheckCircle2, AlertCircle, Shield
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { motion, AnimatePresence } from "framer-motion";

const METHODS = {
  stripe: { label: 'Stripe (Instant)', icon: '⚡', description: 'Immediate transfer to Stripe account', processing_time: 'Instant' },
  paypal: { label: 'PayPal', icon: '🅿️', description: 'Transfer to PayPal account', processing_time: '1-2 days' },
  wise: { label: 'Wise', icon: '🌍', description: 'Low-cost international transfer', processing_time: '1-3 days' },
  bank_transfer: { label: 'Bank Transfer', icon: '🏦', description: 'Direct to your bank account', processing_time: '2-3 days' }
};

export default function WithdrawModal({ wallet, teacher, onClose, onSuccess }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("stripe");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);

  const minAmount = 10;
  const maxAmount = wallet?.balance || 0;
  const numAmount = parseFloat(amount) || 0;
  const isValid = numAmount >= minAmount && numAmount <= maxAmount;

  const handleWithdraw = async () => {
    if (!isValid) return;

    setLoading(true);
    setError(null);

    try {
      const response = await base44.functions.invoke('processTeacherWithdrawal', {
        amount: numAmount,
        withdrawal_method: method
      });

      if (response.data.success) {
        setStatus({
          type: 'success',
          message: response.data.message,
          transactionId: response.data.transaction_id
        });

        setTimeout(() => {
          onSuccess();
          onClose();
        }, 2000);
      } else {
        setError(response.data.error || 'Withdrawal failed');
      }
    } catch (err) {
      setError(err.message || 'An error occurred');
      console.error('Withdrawal error:', err);
    }

    setLoading(false);
  };

  const handleQuickAmount = (pct) => {
    const quick = Math.floor((maxAmount * pct) / 10) * 10;
    setAmount(quick.toString());
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white">
          <h2 className="text-xl font-bold text-[#1a1b4b]">Withdraw Funds</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg transition">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Status messages */}
          <AnimatePresence>
            {status && status.type === 'success' && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-xl bg-green-50 border border-green-200 flex items-start gap-3"
              >
                <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-green-800">Success!</p>
                  <p className="text-sm text-green-700 mt-1">{status.message}</p>
                  <p className="text-xs text-green-600 mt-2">Transaction ID: {status.transactionId}</p>
                </div>
              </motion.div>
            )}

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3"
              >
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-red-800">Error</p>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Current balance */}
          <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
            <p className="text-sm text-gray-600 mb-1">Available Balance</p>
            <p className="text-3xl font-bold text-[#1a1b4b]">€{maxAmount.toFixed(2)}</p>
            <p className="text-xs text-gray-500 mt-2">Minimum withdrawal: €{minAmount}</p>
          </div>

          {/* Amount input */}
          <div>
            <label className="text-sm font-semibold text-[#1a1b4b] mb-2 block">Withdrawal Amount</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-xl font-bold text-gray-400">€</span>
              <Input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                min={minAmount}
                max={maxAmount}
                step="0.01"
                className="pl-8 text-lg rounded-xl"
              />
            </div>

            {/* Quick amounts */}
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => handleQuickAmount(0.25)}
                className="flex-1 py-2 px-3 rounded-lg bg-gray-100 hover:bg-gray-200 text-xs font-medium text-gray-700 transition"
              >
                25%
              </button>
              <button
                onClick={() => handleQuickAmount(0.5)}
                className="flex-1 py-2 px-3 rounded-lg bg-gray-100 hover:bg-gray-200 text-xs font-medium text-gray-700 transition"
              >
                50%
              </button>
              <button
                onClick={() => handleQuickAmount(0.75)}
                className="flex-1 py-2 px-3 rounded-lg bg-gray-100 hover:bg-gray-200 text-xs font-medium text-gray-700 transition"
              >
                75%
              </button>
              <button
                onClick={() => setAmount(maxAmount.toString())}
                className="flex-1 py-2 px-3 rounded-lg bg-gray-100 hover:bg-gray-200 text-xs font-medium text-gray-700 transition"
              >
                All
              </button>
            </div>
          </div>

          {/* Withdrawal method */}
          <div>
            <label className="text-sm font-semibold text-[#1a1b4b] mb-3 block">Withdrawal Method</label>
            <div className="space-y-2">
              {Object.entries(METHODS).map(([key, data]) => {
                const isDisabled = key !== 'stripe' && !teacher?.[`${key}_account`];
                
                return (
                  <button
                    key={key}
                    onClick={() => !isDisabled && setMethod(key)}
                    disabled={isDisabled}
                    className={`w-full p-3 rounded-xl border transition text-left ${
                      method === key
                        ? 'border-[#1a1b4b] bg-[#1a1b4b]/5'
                        : isDisabled
                        ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{data.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[#1a1b4b] text-sm">{data.label}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{data.description}</p>
                        <p className="text-xs text-gray-400 mt-1">⏱️ {data.processing_time}</p>
                      </div>
                      {method === key && (
                        <CheckCircle2 className="w-5 h-5 text-[#1a1b4b] flex-shrink-0 mt-0.5" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Fee info */}
          <Card className="border-0 bg-gray-50">
            <CardContent className="p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Withdrawal amount:</span>
                <span className="font-semibold text-[#1a1b4b]">€{numAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Processing fee:</span>
                <span className="font-semibold text-[#1a1b4b]">€0.00</span>
              </div>
              <div className="border-t border-gray-300 pt-2 flex justify-between">
                <span className="font-semibold text-gray-700">You'll receive:</span>
                <span className="text-lg font-bold text-emerald-600">€{numAmount.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Security badge */}
          <div className="p-3 rounded-xl bg-green-50 border border-green-200 flex items-center gap-2">
            <Shield className="w-4 h-4 text-green-600" />
            <p className="text-xs text-green-700"><strong>Secure:</strong> All withdrawals are encrypted and processed securely.</p>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="flex-1 rounded-full"
            >
              Cancel
            </Button>
            <Button
              onClick={handleWithdraw}
              disabled={!isValid || loading || status?.type === 'success'}
              className="flex-1 bg-[#f97066] hover:bg-[#e8605a] rounded-full gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Processing
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" /> Withdraw €{numAmount.toFixed(2)}
                </>
              )}
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}