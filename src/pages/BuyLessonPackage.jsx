import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { Check, Loader2, Sparkles, Crown, Star, ShoppingCart, Lock, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";

const PACKAGES = [
  {
    id: "credit_15",
    label: "$15 Credits",
    price: 15,
    desc: "Use with any teacher",
    icon: Star,
    color: "bg-blue-500",
  },
  {
    id: "credit_25",
    label: "$25 Credits",
    price: 25,
    desc: "Use with any teacher",
    icon: Star,
    color: "bg-violet-500",
  },
  {
    id: "credit_50",
    label: "$50 Credits",
    price: 50,
    desc: "Most popular",
    icon: Sparkles,
    color: "bg-emerald-500",
  },
  {
    id: "credit_100",
    label: "$100 Credits",
    price: 100,
    desc: "Best value",
    icon: Sparkles,
    color: "bg-[#f97066]",
    popular: true,
  },
  {
    id: "credit_150",
    label: "$150 Credits",
    price: 150,
    desc: "Save with bulk purchase",
    icon: Crown,
    color: "bg-amber-500",
  },
  {
    id: "credit_250",
    label: "$250 Credits",
    price: 250,
    desc: "Premium bundle",
    icon: Crown,
    color: "bg-[#1a1b4b]",
  },
];

export default function BuyLessonPackage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [purchasing, setPurchasing] = useState(null);
  const [success, setSuccess] = useState(null);
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

    try {
      const res = await base44.functions.invoke("purchaseLessonPackage", {
        amount: pkg.price,
      });

      if (res.data?.error) {
        alert(res.data.error);
        setPurchasing(null);
        return;
      }

      // Redirect to Stripe Checkout
      if (res.data?.session_url) {
        window.location.href = res.data.session_url;
        return;
      }

      setPurchasing(null);
    } catch (error) {
      alert("Purchase failed. Please try again.");
      setPurchasing(null);
    }
  };

  if (authLoading) return null;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <button
          onClick={() => navigate(createPageUrl("StudentDashboard"))}
          className="flex items-center gap-2 text-gray-400 hover:text-[#1a1b4b] mb-4 transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>
        <h1 className="text-3xl font-bold text-[#1a1b4b]">Buy Lesson Credits</h1>
        <p className="text-gray-400 mt-2">
          Purchase USD credits that work with any teacher. Valid for 30 days from purchase.
        </p>
      </div>

      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-sm text-emerald-800 font-medium"
          >
            ✅ Purchase successful! Your credits are ready. Redirecting…
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {PACKAGES.map((pkg, i) => (
          <motion.div
            key={pkg.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card
              className={`border shadow-sm relative overflow-hidden transition-all hover:shadow-md h-full ${
                pkg.popular ? "ring-2 ring-[#f97066]" : "border-gray-100"
              }`}
            >
              {pkg.popular && (
                <div className="absolute top-0 right-0">
                  <Badge className="bg-[#f97066] text-white rounded-none rounded-bl-xl px-2.5 py-1 text-xs">
                    Popular
                  </Badge>
                </div>
              )}
              <CardContent className="p-4 flex flex-col h-full">
                <div className="flex items-start gap-3 mb-3">
                  <div
                    className={`w-9 h-9 rounded-xl ${pkg.color} flex items-center justify-center flex-shrink-0`}
                  >
                    <pkg.icon className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-[#1a1b4b]">{pkg.label}</p>
                    <p className="text-xs text-gray-400">{pkg.desc}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-lg font-bold text-[#1a1b4b]">${pkg.price}</p>
                  </div>
                </div>
                <ul className="space-y-1 mb-4 flex-1">
                  {[
                    "Work with any teacher",
                    "Valid for 30 days",
                    "Deduct exact lesson price",
                  ].map((f) => (
                    <li key={f} className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Check className="w-3 h-3 text-emerald-500 flex-shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <Button
                  onClick={() => handlePurchase(pkg)}
                  disabled={purchasing === pkg.id || !!success}
                  className={`w-full rounded-xl h-9 text-sm gap-1.5 ${
                    pkg.popular
                      ? "bg-[#f97066] hover:bg-[#e8605a]"
                      : "bg-[#1a1b4b] hover:bg-[#2a2b5b]"
                  }`}
                >
                  {purchasing === pkg.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : !user ? (
                    <>
                      <Lock className="w-3.5 h-3.5" /> Sign In to Buy
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="w-3.5 h-3.5" /> Buy Package
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <Card className="border border-blue-100 bg-blue-50 shadow-none">
        <CardContent className="p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-blue-800">USD-Based Lesson Credits</p>
            <p className="text-xs text-blue-600 mt-0.5">
              Each teacher charges different rates. Your credits automatically deduct the exact lesson price when you book.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}