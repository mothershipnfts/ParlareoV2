import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { createPageUrl } from "@/utils";
import { Video, Loader2, BookOpen, X, AlertTriangle, Clock, CheckCircle2, Info, Euro } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, parseISO, isAfter, isBefore, differenceInHours } from "date-fns";

function CancelModal({ booking, onConfirm, onClose, loading }) {
  const [reason, setReason] = useState("");
  const lessonStart = new Date(`${booking.date}T${booking.start_time}`);
  const hoursUntil = differenceInHours(lessonStart, new Date());
  const isLateCancellation = hoursUntil < 12;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#1a1b4b]">Cancel Lesson</h2>
            <p className="text-sm text-gray-400 mt-0.5">
              {format(parseISO(booking.date), "EEEE, MMMM d")} at {booking.start_time?.slice(0, 5)}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cancellation Policy */}
        <div className="rounded-xl bg-blue-50 border border-blue-100 p-4 space-y-2">
          <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5" /> Cancellation Policy
          </p>
          <div className="space-y-1.5">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-blue-700">
                <span className="font-semibold">Full refund</span> — Cancel more than 12 hours before the lesson starts
              </p>
            </div>
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-blue-700">
                <span className="font-semibold">No refund</span> — Cancel within 12 hours or fail to attend — the full lesson fee is charged
              </p>
            </div>
          </div>
        </div>

        {/* Status banner */}
        {isLateCancellation ? (
          <div className="rounded-xl bg-red-50 border border-red-200 p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-800">Late Cancellation — Fee Will Be Charged</p>
              <p className="text-xs text-red-600 mt-1">
                This lesson starts in <span className="font-bold">{hoursUntil < 1 ? "less than 1 hour" : `${hoursUntil} hours`}</span>.
                Cancelling now will forfeit your lesson payment — the funds will be released to your teacher.
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-emerald-800">Free Cancellation — Full Refund</p>
              <p className="text-xs text-emerald-600 mt-1">
                Lesson starts in <span className="font-bold">{hoursUntil} hours</span>.
                Your lesson balance will be fully restored to your account.
              </p>
            </div>
          </div>
        )}

        {/* Reason input */}
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1.5 block">Reason for cancellation (optional)</label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Let your teacher know why you're cancelling..."
            rows={3}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1a1b4b]/20 resize-none"
          />
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1 rounded-xl" disabled={loading}>
            Keep Lesson
          </Button>
          <Button
            onClick={() => onConfirm(reason)}
            disabled={loading}
            className={`flex-1 rounded-xl ${isLateCancellation ? "bg-red-500 hover:bg-red-600" : "bg-[#f97066] hover:bg-[#e8605a]"} text-white`}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : isLateCancellation ? "Cancel & Forfeit Fee" : "Cancel & Get Refund"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function MyLessons() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [tab, setTab] = useState("upcoming");
  const [loading, setLoading] = useState(true);
  const [cancelModal, setCancelModal] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [resultMessage, setResultMessage] = useState(null);
  const [user, setUser] = useState(null);

  const { user: authUser } = useAuth();

  useEffect(() => {
    loadData();
  }, [authUser?.id]);

  const loadData = async () => {
    if (!authUser?.id) {
      setLoading(false);
      return;
    }
    setUser(authUser);
    const { data: allBookings } = await supabase
      .from("bookings")
      .select("*")
      .eq("student_id", authUser.id)
      .order("date", { ascending: false });
    setBookings(allBookings || []);
    setSubscriptions([]);
    setLoading(false);
  };

  const totalBalance = subscriptions.reduce((sum, s) => sum + (s.balance_eur || 0), 0);
  const totalHeld = subscriptions.reduce((sum, s) => sum + (s.held_eur || 0), 0);

  const handleCancelConfirm = async (reason) => {
    if (!cancelModal || !authUser?.id) return;
    setCancelling(true);
    try {
      const { error } = await supabase
        .from("bookings")
        .update({ status: "canceled", notes: reason || "Cancelled by student" })
        .eq("id", cancelModal.id)
        .eq("student_id", authUser.id);
      if (error) throw error;
      setBookings((prev) => prev.map((b) => (b.id === cancelModal.id ? { ...b, status: "canceled" } : b)));
      setResultMessage({
        type: "success",
        text: "Lesson cancelled successfully.",
      });
    } catch (err) {
      setResultMessage({ type: "error", text: "Failed to cancel lesson. Please try again." });
    }
    setCancelling(false);
    setCancelModal(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-[#1a1b4b]" />
      </div>
    );
  }

  const now = new Date();
  const upcoming = bookings
    .filter(b => b.status === "scheduled" && isAfter(new Date(`${b.date}T${b.end_time}`), now))
    .sort((a, b) => new Date(`${a.date}T${a.start_time}`) - new Date(`${b.date}T${b.start_time}`));
  const past = bookings.filter(b => b.status === "completed" || (b.status === "scheduled" && isBefore(new Date(`${b.date}T${b.end_time}`), now)));
  const cancelled = bookings.filter(b => b.status === "canceled" || b.status === "cancelled");

  const lessonInProgress = upcoming.find(b => {
    const start = new Date(`${b.date}T${b.start_time}`);
    const end = new Date(`${b.date}T${b.end_time}`);
    return now >= start && now <= end;
  });
  const featuredLesson = lessonInProgress || upcoming[0] || null;
  const featuredIsLive = !!lessonInProgress;

  const filteredBookings = tab === "upcoming" ? upcoming : tab === "past" ? past : cancelled;
  const listBookings = tab === "upcoming" && featuredLesson
    ? filteredBookings.filter(b => b.id !== featuredLesson.id)
    : filteredBookings;

  const statusColors = {
    scheduled: "bg-blue-100 text-blue-700",
    completed: "bg-emerald-100 text-emerald-700",
    canceled: "bg-red-100 text-red-700",
    cancelled: "bg-red-100 text-red-700",
  };

  return (
    <div>
      {cancelModal && (
        <CancelModal
          booking={cancelModal}
          onConfirm={handleCancelConfirm}
          onClose={() => setCancelModal(null)}
          loading={cancelling}
        />
      )}

      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-3xl font-bold text-[#1a1b4b]">My Lessons</h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5">
            <Euro className="w-4 h-4 text-blue-600" />
            <div>
              <p className="text-xs text-gray-400 leading-none">Available</p>
              <p className="text-base font-bold text-[#1a1b4b] leading-tight">€{totalBalance.toFixed(2)}</p>
            </div>
          </div>
          {totalHeld > 0 && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-xl px-4 py-2.5">
              <Clock className="w-4 h-4 text-amber-500" />
              <div>
                <p className="text-xs text-gray-400 leading-none">In Escrow</p>
                <p className="text-base font-bold text-amber-700 leading-tight">€{totalHeld.toFixed(2)}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Result message */}
      {resultMessage && (
        <div className={`mb-4 p-4 rounded-xl flex items-start gap-3 ${
          resultMessage.type === "success" ? "bg-emerald-50 border border-emerald-200" :
          resultMessage.type === "warning" ? "bg-amber-50 border border-amber-200" :
          "bg-red-50 border border-red-200"
        }`}>
          {resultMessage.type === "success"
            ? <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
            : <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />}
          <p className={`text-sm font-medium ${
            resultMessage.type === "success" ? "text-emerald-800" :
            resultMessage.type === "warning" ? "text-amber-800" :
            "text-red-800"
          }`}>{resultMessage.text}</p>
          <button onClick={() => setResultMessage(null)} className="ml-auto text-gray-300 hover:text-gray-500">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Featured / Next Lesson Hero */}
      {featuredLesson && (
        <div className={`rounded-2xl p-6 mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-5 ${featuredIsLive ? "bg-[#f97066]" : "bg-[#1a1b4b]"}`}>
          <div className={`w-16 h-16 rounded-2xl flex flex-col items-center justify-center shrink-0 ${featuredIsLive ? "bg-white/20" : "bg-white/10"}`}>
            {featuredIsLive ? (
              <Video className="w-7 h-7 text-white" />
            ) : (
              <>
                <span className="text-xs text-white/70 font-medium">{format(parseISO(featuredLesson.date), "MMM")}</span>
                <span className="text-xl font-bold text-white leading-none">{format(parseISO(featuredLesson.date), "d")}</span>
              </>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="mb-1">
              {featuredIsLive ? (
                <span className="flex items-center gap-1.5 text-xs font-bold text-white bg-white/20 rounded-full px-2.5 py-0.5 w-fit">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> LIVE NOW
                </span>
              ) : (
                <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">Next Lesson</span>
              )}
            </div>
            <h2 className="text-xl font-bold text-white">{format(parseISO(featuredLesson.date), "EEEE, MMMM d")}</h2>
            <p className="text-white/70 text-sm mt-0.5">
              {featuredLesson.start_time?.slice(0, 5)} – {featuredLesson.end_time?.slice(0, 5)} · {featuredLesson.session_duration} min
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 shrink-0">
            {!featuredIsLive && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCancelModal(featuredLesson)}
                className="rounded-xl border-white/30 text-white hover:bg-white/10 bg-transparent"
              >
                <X className="w-3 h-3 mr-1" /> Cancel
              </Button>
            )}
            <Button
              onClick={() => navigate(createPageUrl(`StudentDashboard?tab=classroom&bookingId=${featuredLesson.id}`))}
              className={`rounded-xl font-semibold px-6 h-auto py-2.5 ${featuredIsLive ? "bg-white text-[#f97066] hover:bg-white/90" : "bg-[#f97066] hover:bg-[#e8605a] text-white"}`}
            >
              <Video className="w-4 h-4 mr-2" />
              {featuredIsLive ? "Rejoin Lesson" : "Join Classroom"}
            </Button>
          </div>
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab} className="mb-6">
        <TabsList className="bg-gray-100 rounded-full p-1">
          <TabsTrigger value="upcoming" className="rounded-full">Upcoming ({upcoming.length})</TabsTrigger>
          <TabsTrigger value="past" className="rounded-full">Past ({past.length})</TabsTrigger>
          <TabsTrigger value="cancelled" className="rounded-full">Cancelled ({cancelled.length})</TabsTrigger>
        </TabsList>
      </Tabs>

      {listBookings.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-12 text-center">
            <BookOpen className="w-12 h-12 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-400">
              {tab === "upcoming" && featuredLesson ? "No other upcoming lessons." : "No lessons found."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {listBookings.map((booking) => {
            const hoursUntil = differenceInHours(new Date(`${booking.date}T${booking.start_time}`), now);
            const canCancel = booking.status === "scheduled";
            const isLateCancelRisk = hoursUntil < 12 && hoursUntil > 0;
            return (
              <Card key={booking.id} className="border-0 shadow-sm">
                <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-[#1a1b4b] flex flex-col items-center justify-center text-white flex-shrink-0">
                    <span className="text-xs font-medium">{format(parseISO(booking.date), 'MMM')}</span>
                    <span className="text-lg font-bold leading-none">{format(parseISO(booking.date), 'd')}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[#1a1b4b]">{booking.start_time?.slice(0, 5)} – {booking.end_time?.slice(0, 5)}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{format(parseISO(booking.date), "EEEE, MMMM d")}</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <Badge variant="outline" className="rounded-full text-xs">{booking.session_duration} min</Badge>
                      <Badge className={`rounded-full text-xs ${statusColors[booking.status] || 'bg-gray-100 text-gray-600'}`}>
                        {booking.status}
                      </Badge>
                      {canCancel && isLateCancelRisk && (
                        <Badge className="rounded-full text-xs bg-amber-100 text-amber-700 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Late cancel fee applies
                        </Badge>
                      )}
                    </div>
                  </div>
                  {tab === 'upcoming' && canCancel && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setCancelModal(booking)}
                        className={`rounded-full ${isLateCancelRisk ? "text-red-500 border-red-200 hover:bg-red-50" : "text-gray-500 border-gray-200 hover:bg-gray-50"}`}
                      >
                        <X className="w-3 h-3 mr-1" /> Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => navigate(createPageUrl(`StudentDashboard?tab=classroom&bookingId=${booking.id}`))}
                        className="bg-[#f97066] hover:bg-[#e8605a] rounded-full"
                      >
                        <Video className="w-3 h-3 mr-1" /> Join
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}