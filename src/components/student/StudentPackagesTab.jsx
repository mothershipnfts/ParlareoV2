import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { Check, Loader2, Sparkles, Crown, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

const PACKAGES = [
  { 
    id: "single_25", label: "Single Lesson", duration: 25, lessons: 1, price: 20,
    desc: "Try a 25-minute session", icon: Star, color: "bg-blue-500"
  },
  { 
    id: "single_50", label: "Single Lesson", duration: 50, lessons: 1, price: 35,
    desc: "Try a full 50-minute session", icon: Star, color: "bg-violet-500"
  },
  { 
    id: "pack_5_25", label: "5 Lessons Pack", duration: 25, lessons: 5, price: 90,
    desc: "Save 10% — 25 min sessions", icon: Sparkles, color: "bg-emerald-500", popular: false
  },
  { 
    id: "pack_5_50", label: "5 Lessons Pack", duration: 50, lessons: 5, price: 160,
    desc: "Save 9% — 50 min sessions", icon: Sparkles, color: "bg-[#f97066]", popular: true
  },
  { 
    id: "pack_10_25", label: "10 Lessons Pack", duration: 25, lessons: 10, price: 170,
    desc: "Save 15% — 25 min sessions", icon: Crown, color: "bg-amber-500"
  },
  { 
    id: "pack_10_50", label: "10 Lessons Pack", duration: 50, lessons: 10, price: 300,
    desc: "Save 14% — 50 min sessions", icon: Crown, color: "bg-[#1a1b4b]"
  },
];

export default function StudentPackagesTab({ profile, onProfileUpdated }) {
  const [purchasing, setPurchasing] = useState(null);

  const handlePurchase = async (pkg) => {
    setPurchasing(pkg.id);
    const me = await base44.auth.me();

    // Record the payment
    await base44.entities.Payment.create({
      student_email: me.email,
      student_name: profile?.full_name || me.full_name,
      package_type: pkg.id,
      amount: pkg.price,
      currency: "USD",
      lessons_count: pkg.lessons,
      session_duration: pkg.duration,
      status: "completed"
    });

    // Credit the teacher wallet
    const wallets = await base44.entities.TeacherWallet.list();
    if (wallets.length > 0) {
      const w = wallets[0];
      await base44.entities.TeacherWallet.update(w.id, {
        balance: (w.balance || 0) + pkg.price,
        total_earned: (w.total_earned || 0) + pkg.price
      });
    } else {
      await base44.entities.TeacherWallet.create({
        balance: pkg.price,
        total_earned: pkg.price,
        total_withdrawn: 0,
        pending_balance: 0
      });
    }

    // Record wallet transaction
    await base44.entities.WalletTransaction.create({
      type: "payment_received",
      amount: pkg.price,
      currency: "USD",
      student_email: me.email,
      student_name: profile?.full_name || me.full_name,
      package_type: pkg.id,
      lessons_count: pkg.lessons,
      status: "completed"
    });

    // Add lessons to student profile
    if (profile) {
      await base44.entities.StudentProfile.update(profile.id, {
        lessons_remaining: (profile.lessons_remaining || 0) + pkg.lessons
      });
      onProfileUpdated(prev => ({ ...prev, lessons_remaining: (prev.lessons_remaining || 0) + pkg.lessons }));
    }

    setPurchasing(null);
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#1a1b4b]">Buy Lesson Packages</h1>
        <p className="text-gray-400 mt-1">
          Choose a package that works for you • {profile?.lessons_remaining || 0} lessons remaining
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {PACKAGES.map((pkg, i) => (
          <motion.div key={pkg.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
            <Card className={`border-0 shadow-sm relative overflow-hidden ${pkg.popular ? 'ring-2 ring-[#f97066]' : ''}`}>
              {pkg.popular && (
                <div className="absolute top-0 right-0">
                  <Badge className="bg-[#f97066] text-white rounded-none rounded-bl-xl px-3 py-1.5 text-xs">
                    Most Popular
                  </Badge>
                </div>
              )}
              <CardContent className="p-6">
                <div className={`w-12 h-12 rounded-2xl ${pkg.color} flex items-center justify-center mb-4`}>
                  <pkg.icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-bold text-[#1a1b4b]">{pkg.label}</h3>
                <p className="text-sm text-gray-400 mb-4">{pkg.desc}</p>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-4xl font-bold text-[#1a1b4b]">${pkg.price}</span>
                  <span className="text-gray-400 text-sm">USD</span>
                </div>
                <p className="text-xs text-gray-400 mb-6">
                  ${(pkg.price / pkg.lessons).toFixed(0)} per lesson • {pkg.duration} min each
                </p>
                <ul className="space-y-2 mb-6">
                  {[
                    `${pkg.lessons} lesson${pkg.lessons > 1 ? 's' : ''}`,
                    `${pkg.duration}-minute sessions`,
                    "AI-personalized content",
                    "Flexible scheduling"
                  ].map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm text-gray-600">
                      <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button
                  onClick={() => handlePurchase(pkg)}
                  disabled={purchasing === pkg.id}
                  className={`w-full rounded-xl h-12 ${
                    pkg.popular 
                      ? 'bg-[#f97066] hover:bg-[#e8605a]' 
                      : 'bg-[#1a1b4b] hover:bg-[#2a2b5b]'
                  }`}
                >
                  {purchasing === pkg.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Purchase'}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}