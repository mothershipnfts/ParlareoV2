import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { Check, Loader2, Sparkles, Crown, Star, ShoppingCart, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";

const buildPackages = (teacher) => {
  const p50 = teacher?.lesson_price_50 || 35;
  const p25 = Math.round(p50 * 0.6); // Always 60% of base rate — not editable
  return [
    {
      id: "single_25", label: "Single Lesson", duration: 25, lessons: 1,
      price: p25, desc: "25-min focused session", icon: Star, color: "bg-blue-500",
    },
    {
      id: "single_50", label: "Single Lesson", duration: 50, lessons: 1,
      price: p50, desc: "50-min full session", icon: Star, color: "bg-violet-500",
    },
    {
      id: "pack_5_25", label: "5 Lessons Pack", duration: 25, lessons: 5,
      price: Math.round(p25 * 5 * 0.9), desc: "Save 10% — 25 min sessions", icon: Sparkles, color: "bg-emerald-500",
    },
    {
      id: "pack_5_50", label: "5 Lessons Pack", duration: 50, lessons: 5,
      price: Math.round(p50 * 5 * 0.9), desc: "Save 10% — 50 min sessions", icon: Sparkles, color: "bg-[#f97066]", popular: true,
    },
    {
      id: "pack_10_25", label: "10 Lessons Pack", duration: 25, lessons: 10,
      price: Math.round(p25 * 10 * 0.85), desc: "Save 15% — 25 min sessions", icon: Crown, color: "bg-amber-500",
    },
    {
      id: "pack_10_50", label: "10 Lessons Pack", duration: 50, lessons: 10,
      price: Math.round(p50 * 10 * 0.85), desc: "Save 15% — 50 min sessions", icon: Crown, color: "bg-[#1a1b4b]",
    },
  ];
};

export default function TeacherPackages({ teacher, selectedDuration, onPurchaseSuccess }) {
  const [purchasing, setPurchasing] = useState(null);
  const [success, setSuccess] = useState(null);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    base44.auth.isAuthenticated().then(async (auth) => {
      if (auth) setUser(await base44.auth.me());
      setAuthLoading(false);
    });
  }, []);

  const handlePurchase = async (pkg) => {
    if (!user) {
      base44.auth.redirectToLogin(window.location.href);
      return;
    }
    setPurchasing(pkg.id);

    const res = await base44.functions.invoke("purchaseTeacherPackage", {
      teacher_id: teacher.id,
      teacher_email: teacher.user_email,
      package_type: pkg.id,
      amount: pkg.price,
      lessons_count: pkg.lessons,
      session_duration: pkg.duration,
    });

    if (res.data?.error) {
      alert(res.data.error);
      setPurchasing(null);
      return;
    }

    setSuccess(pkg);
    setPurchasing(null);
    // Callback to parent to show booking view after short delay
    if (onPurchaseSuccess) {
      setTimeout(() => {
        onPurchaseSuccess(pkg);
        setSuccess(null);
      }, 1800);
    }
  };

  const allPackages = buildPackages(teacher);
  const packages = selectedDuration
    ? allPackages.filter(p => p.duration === selectedDuration)
    : allPackages;

  if (authLoading) return null;

  return (
    <div className="mt-2">
      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-sm text-emerald-800 font-medium"
          >
            ✅ Purchase successful! Redirecting to booking…
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {packages.map((pkg, i) => (
          <motion.div
            key={pkg.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
          >
            <Card className={`border shadow-sm relative overflow-hidden transition-all hover:shadow-md ${pkg.popular ? "ring-2 ring-[#f97066]" : "border-gray-100"}`}>
              {pkg.popular && (
                <div className="absolute top-0 right-0">
                  <Badge className="bg-[#f97066] text-white rounded-none rounded-bl-xl px-2.5 py-1 text-xs">
                    Popular
                  </Badge>
                </div>
              )}
              <CardContent className="p-4">
                <div className="flex items-start gap-3 mb-3">
                  <div className={`w-9 h-9 rounded-xl ${pkg.color} flex items-center justify-center flex-shrink-0`}>
                    <pkg.icon className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-[#1a1b4b]">{pkg.label}</p>
                    <p className="text-xs text-gray-400">{pkg.desc}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-lg font-bold text-[#1a1b4b]">${pkg.price}</p>
                    <p className="text-xs text-gray-400">${(pkg.price / pkg.lessons).toFixed(0)}/lesson</p>
                  </div>
                </div>
                <ul className="space-y-1 mb-3">
                  {[
                    `${pkg.lessons} lesson${pkg.lessons > 1 ? "s" : ""}`,
                    `${pkg.duration}-min sessions`,
                    "Flexible scheduling",
                  ].map((f) => (
                    <li key={f} className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Check className="w-3 h-3 text-emerald-500 flex-shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <Button
                  onClick={() => handlePurchase(pkg)}
                  disabled={purchasing === pkg.id || !!success}
                  size="sm"
                  className={`w-full rounded-xl h-9 text-sm gap-1.5 ${
                    pkg.popular ? "bg-[#f97066] hover:bg-[#e8605a]" : "bg-[#1a1b4b] hover:bg-[#2a2b5b]"
                  }`}
                >
                  {purchasing === pkg.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : !user ? (
                    <><Lock className="w-3.5 h-3.5" /> Sign In to Buy</>
                  ) : (
                    <><ShoppingCart className="w-3.5 h-3.5" /> Buy with {teacher.full_name?.split(" ")[0]}</>
                  )}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
      <p className="text-xs text-gray-300 mt-3 text-center">
        Funds are held in escrow and released to {teacher.full_name?.split(" ")[0]} as lessons are completed.
      </p>
    </div>
  );
}