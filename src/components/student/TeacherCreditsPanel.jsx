import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, Check, ShoppingCart, Zap, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const PACKAGES = [
  { lessons: 1,  label: "Single" },
  { lessons: 4,  label: "4 Lessons" },
  { lessons: 8,  label: "8 Lessons" },
  { lessons: 12, label: "12 Lessons" },
];

export default function TeacherCreditsPanel({ teacher, user, onSubscriptionUpdated }) {
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [selected, setSelected] = useState(PACKAGES[0]);

  useEffect(() => { loadSubscription(); }, [teacher, user]);

  const loadSubscription = async () => {
    if (!teacher || !user) return;
    const subs = await base44.entities.StudentTeacherSubscription.filter({
      student_email: user.email,
      teacher_email: teacher.user_email,
    });
    setSubscription(subs.length > 0 ? subs[0] : null);
    setLoading(false);
  };

  const pricePerLesson = teacher.lesson_price_50 || 35;

  const totalPrice = (pkg) => pricePerLesson * pkg.lessons;

  const handleCheckout = async () => {
    setPurchasing(true);
    try {
      const res = await base44.functions.invoke("createCheckoutSession", {
        amount: Math.round(totalPrice(selected) * 100),
        lessons_count: selected.lessons,
        teacher_id: teacher.id,
        teacher_email: teacher.user_email,
        student_email: user.email,
        student_name: user.full_name,
      });

      // Redirect to Stripe hosted checkout
      if (res.data?.session_url) {
        window.location.href = res.data.session_url;
      } else if (res.data?.sessionId) {
        window.location.href = `https://checkout.stripe.com/c/pay/${res.data.sessionId}`;
      }
    } catch (err) {
      console.error("Checkout failed:", err);
    } finally {
      setPurchasing(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-6">
      <Loader2 className="w-5 h-5 animate-spin text-[#1a1b4b]" />
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-[#1a1b4b] flex items-center gap-2">
          <ShoppingCart className="w-4 h-4" /> Buy Lessons
        </h3>
        {subscription?.balance_eur > 0 && (
          <Badge className="bg-emerald-100 text-emerald-700 rounded-full">
            €{(subscription.balance_eur || 0).toFixed(2)} available
          </Badge>
        )}
      </div>

      <p className="text-xs text-gray-400 mb-3">
        €{pricePerLesson}/lesson · Pay securely via Stripe
      </p>

      <div className="bg-blue-50 border border-blue-100 rounded-lg p-2.5 mb-4 flex items-start gap-2">
        <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-blue-700">You'll be redirected to Stripe checkout to pay securely</p>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        {PACKAGES.map((pkg) => (
          <button
            key={pkg.lessons}
            onClick={() => setSelected(pkg)}
            className={`relative p-3 rounded-xl border text-left transition-all ${
              selected.lessons === pkg.lessons
                ? "border-[#1a1b4b] bg-[#1a1b4b]/5"
                : "border-gray-100 bg-white hover:border-gray-300"
            }`}
          >
            <p className="text-sm font-bold text-[#1a1b4b]">{pkg.label}</p>
            <p className="text-xs text-gray-400">€{totalPrice(pkg).toFixed(0)}</p>
            {selected.lessons === pkg.lessons && (
              <Check className="w-3 h-3 text-[#1a1b4b] absolute top-2 right-2" />
            )}
          </button>
        ))}
      </div>

      <div className="bg-gray-50 rounded-xl p-3 mb-4 flex items-center justify-between">
        <span className="text-sm text-gray-600">{selected.lessons} lesson{selected.lessons > 1 ? "s" : ""}</span>
        <div className="text-right">
          <span className="font-bold text-[#1a1b4b]">€{totalPrice(selected).toFixed(2)}</span>
        </div>
      </div>

      <Button
        onClick={handleCheckout}
        disabled={purchasing}
        className="w-full bg-[#f97066] hover:bg-[#e8605a] rounded-xl h-10 font-semibold"
      >
        {purchasing ? <Loader2 className="w-4 h-4 animate-spin" /> : (
          <><Zap className="w-4 h-4 mr-2" /> Buy {selected.lessons} Lesson{selected.lessons > 1 ? "s" : ""}</>
        )}
      </Button>
    </div>
  );
}