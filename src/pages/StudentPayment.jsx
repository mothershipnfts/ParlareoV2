import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import {
  CreditCard, Wallet, Plus, Trash2, CheckCircle2, Loader2,
  Shield, Lock, Star
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { motion, AnimatePresence } from "framer-motion";

const METHOD_ICONS = {
  credit_card: "💳",
  paypal: "🅿️",
  wise: "🌍",
  bank_transfer: "🏦"
};

const METHOD_LABELS = {
  credit_card: "Credit / Debit Card",
  paypal: "PayPal",
  wise: "Wise",
  bank_transfer: "Bank Transfer"
};

export default function StudentPayment() {
  const [loading, setLoading] = useState(true);

  useEffect(() => { setLoading(false); }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-[#1a1b4b]" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#1a1b4b]">Payments</h1>
        <p className="text-gray-400 text-sm mt-1">All lesson payments are processed securely via Stripe in EUR</p>
      </div>

      {/* Security badge */}
      <Card className="border border-green-100 bg-green-50 shadow-none">
        <CardContent className="p-4 flex items-center gap-3">
          <Shield className="w-5 h-5 text-green-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-green-800">Secure Payments</p>
            <p className="text-xs text-green-600">All payments are processed securely via Stripe. Your card details are encrypted and never stored on our servers.</p>
          </div>
          <Lock className="w-4 h-4 text-green-400 ml-auto flex-shrink-0" />
        </CardContent>
      </Card>

      {/* Info */}
      <Card className="border border-blue-100 bg-blue-50 shadow-none">
        <CardContent className="p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
            <Wallet className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-blue-800">Purchase Lesson Packages</p>
            <p className="text-xs text-blue-600 mt-0.5">
              Browse tutors and purchase lesson packages directly from their profiles. Pay securely with Stripe at checkout.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}