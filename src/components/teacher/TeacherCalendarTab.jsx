import React, { useState, useEffect, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import {
  ChevronLeft, ChevronRight, Globe, Save, Loader2, X,
  Video, MessageSquare, CheckCircle, Ban, Clock, ToggleLeft, ToggleRight,
  CalendarDays, User, GripVertical, Zap
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createPageUrl } from "@/utils";
import { useNavigate } from "react-router-dom";
import {
  format, addDays, subWeeks, addWeeks, startOfWeek,
  isToday, isBefore, parseISO, differenceInSeconds
} from "date-fns";

// ─── Grid constants ─────────────────────────────────────────────────────────
const DAY_START_H  = 0;   // 00:00 midnight
const DAY_END_H    = 24;  // 24:00 midnight
const VISIBLE_SPAN = 24 * 60; // 1440 mins
const ROW_H        = 3;   // px per minute
const GRID_H       = VISIBLE_SPAN * ROW_H;            // 4320px
const SNAP_MINS    = 30;
const TOTAL_MINS   = 24 * 60;
const DAY_LABELS   = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS        = Array.from({ length: 24 }, (_, i) => i);
const TIME_COL_W   = 64; // px

// ─── Time utilities ──────────────────────────────────────────────────────────
const toMin  = (t) => { const [h, m] = (t || "00:00").split(":").map(Number); return h * 60 + m; };
const fromMin = (m) => `${String(Math.floor(m / 60)).padStart(2,"0")}:${String(m % 60).padStart(2,"0")}`;
const detectTZ = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

const getOffsetMs = (tz) => {
  try {
    const now = new Date();
    return new Date(now.toLocaleString("en-US", { timeZone: tz })) -
           new Date(now.toLocaleString("en-US", { timeZone: "UTC" }));
  } catch { return 0; }
};
const localToUTC = (hhmm, tz) => {
  try {
    const d = new Date(`${format(new Date(),"yyyy-MM-dd")}T${hhmm}:00`);
    const u = new Date(d.getTime() - getOffsetMs(tz));
    return `${String(u.getUTCHours()).padStart(2,"0")}:${String(u.getUTCMinutes()).padStart(2,"0")}`;
  } catch { return hhmm; }
};
const utcToLocal = (hhmm, tz) => {
  try {
    const d = new Date(`${format(new Date(),"yyyy-MM-dd")}T${hhmm}:00Z`);
    const l = new Date(d.getTime() + getOffsetMs(tz));
    return `${String(l.getHours()).padStart(2,"0")}:${String(l.getMinutes()).padStart(2,"0")}`;
  } catch { return hhmm; }
};
const collides = (as, ae, bs, be) => toMin(as) < toMin(be) && toMin(ae) > toMin(bs);

// Convert a local hhmm to px offset within the visible grid
const minToY = (hhmm) => {
  const m = toMin(hhmm);
  const offset = m - DAY_START_H * 60;
  return Math.max(0, offset) * ROW_H;
};
const durationToPx = (s, e) => {
  const mins = Math.max(0, toMin(e) - toMin(s));
  return Math.max(ROW_H * SNAP_MINS, mins * ROW_H);
};

// ─── 8-bit avatar colour palette ────────────────────────────────────────────
const AVATAR_COLORS = [
  ["#7C3AED","#DDD6FE"], ["#0369A1","#BAE6FD"], ["#B45309","#FDE68A"],
  ["#065F46","#A7F3D0"], ["#9D174D","#FBCFE8"], ["#1E40AF","#BFDBFE"],
];
const getAvatarColor = (name) => {
  const i = (name?.charCodeAt(0) || 0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[i];
};

// ─── Countdown formatter ─────────────────────────────────────────────────────
const formatCountdown = (secs) => {
  if (secs <= 0) return "Now!";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2,"0")}m`;
  return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
};

// ─── Next lesson countdown banner ────────────────────────────────────────────
function NextLessonBanner({ bookings, tz, navigate }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const upcoming = bookings
    .filter(b => b.status === "scheduled")
    .map(b => {
      const dt = new Date(`${b.date}T${b.start_time}Z`);
      const secs = Math.floor((dt - now) / 1000);
      return { ...b, secs, localStart: utcToLocal(b.start_time, tz) };
    })
    .filter(b => b.secs > -3600) // show even if just started (within 1hr past)
    .sort((a, b2) => a.secs - b2.secs);

  const next = upcoming[0];
  if (!next) return null;

  const isImminent = next.secs >= 0 && next.secs <= 900; // ≤15 min
  const isNow      = next.secs < 0 && next.secs > -3600;

  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
      isNow      ? "bg-[#f97066] border-[#f97066] text-white shadow-lg shadow-[#f97066]/30" :
      isImminent ? "bg-orange-50 border-orange-300 text-orange-800 shadow-sm" :
                   "bg-[#1a1b4b]/5 border-[#1a1b4b]/10 text-[#1a1b4b]"
    }`}>
      {isNow ? <Zap className="w-4 h-4 shrink-0 animate-pulse" /> : <Clock className="w-4 h-4 shrink-0" />}
      <span className="truncate">
        {isNow ? "Lesson in progress · " : "Next lesson with "}
        <strong>{next.student_name?.split(" ")[0]}</strong>
        {isNow ? `${next.student_name?.split(" ")[0]} · ` : " starts in "}
        {!isNow && <span className={`font-mono font-bold ${isImminent ? "text-orange-600" : ""}`}>
          {formatCountdown(next.secs)}
        </span>}
        {!isNow && ` at ${next.localStart}`}
      </span>
      {(!isNow && !isBefore(new Date(`${next.date}T${next.start_time}Z`), new Date())) && (
        <Button
          size="sm"
          onClick={() => navigate(createPageUrl(`TeacherDashboard?tab=classroom&bookingId=${next.id}`))}
          className={`ml-auto shrink-0 rounded-lg text-xs gap-1.5 h-7 ${
            isImminent ? "bg-orange-500 hover:bg-orange-600 text-white" : "bg-[#1a1b4b] hover:bg-[#2a2b5b] text-white"
          }`}
        >
          <Video className="w-3 h-3" /> Join
        </Button>
      )}
    </div>
  );
}

// ─── Current time line ───────────────────────────────────────────────────────
function CurrentTimeLine({ tz, isThisWeek }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  if (!isThisWeek) return null;

  const localH = now.getHours() + now.getMinutes() / 60;
  if (localH < 0 || localH >= 24) return null;

  const yPx = (localH - DAY_START_H) * 60 * ROW_H;
  return (
    <div className="absolute left-0 right-0 z-30 pointer-events-none" style={{ top: yPx }}>
      <div className="flex items-center">
        <div className="w-2 h-2 rounded-full bg-red-500 shrink-0 -ml-1 shadow-sm shadow-red-400" />
        <div className="flex-1 border-t-2 border-red-400" style={{ borderStyle: "solid" }} />
      </div>
    </div>
  );
}

// ─── Booking card ─────────────────────────────────────────────────────────────
function BookingCard({ booking, tz, now, onDetailsClick, onDragStart, navigate }) {
  const localStart = utcToLocal(booking.start_time, tz);
  const localEnd   = utcToLocal(booking.end_time, tz);
  const lessonDt   = new Date(`${booking.date}T${booking.start_time}Z`);
  const secsToLesson = Math.floor((lessonDt - now) / 1000);
  const isPast     = isBefore(lessonDt, now);
  const isCanceled = booking.status === "canceled";
  const isCompleted= booking.status === "completed" || (isPast && booking.status !== "canceled" && booking.status !== "rescheduled");
  const isImminent = secsToLesson >= 0 && secsToLesson <= 900;
  const isRescheduled = booking.status === "rescheduled";

  const yPx = minToY(localStart);
  const hPx = durationToPx(localStart, localEnd);

  const [bgFg, border] = isCanceled    ? ["bg-gray-100 text-gray-500","border-gray-300"] :
                         isCompleted   ? ["bg-emerald-500 text-white","border-emerald-600"] :
                         isRescheduled ? ["bg-blue-400 text-white","border-blue-500"] :
                         isImminent    ? ["bg-orange-500 text-white","border-orange-600"] :
                                         ["bg-[#1a1b4b] text-white","border-[#0f1038]"];

  const [avatarBg, avatarFg] = getAvatarColor(booking.student_name);
  const initials = (booking.student_name || "?").split(" ").map(n => n[0]).join("").slice(0,2).toUpperCase();

  // Only show join if not past and not canceled
  const showJoin = !isPast && !isCanceled && !isRescheduled && hPx > 50;

  return (
    <div
      className={`absolute left-1 right-1 rounded-xl border-l-4 ${border} ${bgFg} z-20 overflow-hidden cursor-pointer select-none group transition-all hover:brightness-105 hover:shadow-lg`}
      style={{ top: yPx, height: hPx }}
      draggable={!isCanceled && !isCompleted}
      onDragStart={e => !isCanceled && !isCompleted && onDragStart(e, booking)}
      onClick={() => onDetailsClick(booking)}
    >
      <div className="p-2 h-full flex flex-col gap-1">
        {/* Avatar + name row */}
        <div className="flex items-center gap-1.5 min-w-0">
          <div
            className="w-5 h-5 rounded-md shrink-0 flex items-center justify-center text-[9px] font-black border"
            style={{ background: avatarBg, color: avatarFg, borderColor: avatarFg + "40" }}
          >
            {initials}
          </div>
          <span className="text-[11px] font-bold leading-tight truncate">
            {booking.student_name?.split(" ")[0]}
          </span>
          {isImminent && <span className="text-[9px] font-bold animate-pulse ml-auto shrink-0">NOW</span>}
        </div>

        {/* Time */}
        {hPx > 45 && (
          <p className="text-[10px] opacity-80 leading-tight">{localStart}–{localEnd}</p>
        )}

        {/* Join button */}
        {showJoin && (
          <button
            onClick={e => { e.stopPropagation(); navigate(createPageUrl(`TeacherDashboard?tab=classroom&bookingId=${booking.id}`)); }}
            className={`mt-auto flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold w-fit transition-colors ${
              isImminent
                ? "bg-white text-orange-600 hover:bg-orange-50"
                : "bg-white/20 hover:bg-white/30 text-white"
            }`}
          >
            <Video className="w-2.5 h-2.5" />
            Join Classroom
          </button>
        )}
      </div>

      {/* Drag handle */}
      {!isCanceled && !isCompleted && (
        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-50 transition-opacity cursor-grab">
          <GripVertical className="w-3 h-3" />
        </div>
      )}
    </div>
  );
}

// ─── Booking detail modal ─────────────────────────────────────────────────────
function BookingModal({ booking, tz, onClose, onCancel, onComplete, onMessage, onJoinClassroom }) {
  if (!booking) return null;
  const localStart = utcToLocal(booking.start_time, tz);
  const localEnd   = utcToLocal(booking.end_time, tz);
  const isPast     = isBefore(new Date(`${booking.date}T${booking.start_time}Z`), new Date());
  const [avatarBg, avatarFg] = getAvatarColor(booking.student_name);
  const initials = (booking.student_name || "?").split(" ").map(n => n[0]).join("").slice(0,2).toUpperCase();
  const statusMap = { scheduled:"Scheduled", completed:"Completed", canceled:"Cancelled", rescheduled:"Rescheduled" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header strip */}
        <div className="p-5 pb-4" style={{ background: `linear-gradient(135deg, #1a1b4b 0%, #2d2f6e 100%)` }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black border-2"
                style={{ background: avatarBg, color: avatarFg, borderColor: avatarFg }}>
                {initials}
              </div>
              <div>
                <h3 className="text-base font-bold text-white">{booking.student_name}</h3>
                <p className="text-xs text-white/60">{booking.student_email}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10 transition-colors">
              <X className="w-4 h-4 text-white/70" />
            </button>
          </div>
        </div>

        <div className="p-5">
          <div className="space-y-2.5 mb-5 text-sm text-gray-600">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#1a1b4b]/8 flex items-center justify-center shrink-0">
                <CalendarDays className="w-3.5 h-3.5 text-[#1a1b4b]" />
              </div>
              <span>{format(parseISO(booking.date), "EEEE, MMMM d, yyyy")}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#1a1b4b]/8 flex items-center justify-center shrink-0">
                <Clock className="w-3.5 h-3.5 text-[#1a1b4b]" />
              </div>
              <span className="font-semibold">{localStart} – {localEnd}</span>
              <span className="text-gray-400 text-xs">({booking.session_duration} min)</span>
            </div>
            {booking.student_level && (
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-[#1a1b4b]/8 flex items-center justify-center shrink-0">
                  <User className="w-3.5 h-3.5 text-[#1a1b4b]" />
                </div>
                <span className="capitalize">{booking.student_level.replace(/_/g," ")}</span>
              </div>
            )}
            <div className="flex items-center gap-2 pt-1">
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                booking.status === "scheduled"    ? "bg-blue-100 text-blue-700" :
                booking.status === "completed"    ? "bg-emerald-100 text-emerald-700" :
                booking.status === "rescheduled"  ? "bg-blue-100 text-blue-600" :
                "bg-gray-100 text-gray-600"
              }`}>{statusMap[booking.status] || booking.status}</span>
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                booking.payment_status === "paid" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
              }`}>{booking.payment_status === "paid" ? "✓ Paid" : "Unpaid"}</span>
            </div>
          </div>

          <div className="space-y-2">
            {!isPast && booking.status === "scheduled" && (
              <>
                <Button onClick={() => onJoinClassroom(booking.id)}
                  className="w-full rounded-xl gap-2 bg-[#f97066] hover:bg-[#e8605a] font-bold">
                  <Video className="w-4 h-4" /> Join Classroom
                </Button>
                <Button onClick={() => onMessage(booking)} variant="outline"
                  className="w-full rounded-xl gap-2 border-[#1a1b4b]/20 text-[#1a1b4b] hover:bg-[#1a1b4b]/5">
                  <MessageSquare className="w-4 h-4" /> Message Student
                </Button>
                <Button onClick={() => onCancel(booking)} variant="outline"
                  className="w-full rounded-xl gap-2 border-red-200 text-red-500 hover:bg-red-50">
                  <Ban className="w-4 h-4" /> Cancel Lesson
                </Button>
              </>
            )}
            {booking.status === "rescheduled" && (
              <div className="text-xs text-center text-blue-500 font-medium py-2 bg-blue-50 rounded-xl">
                Lesson rescheduled — awaiting student confirmation
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Reschedule confirm modal ─────────────────────────────────────────────────
function RescheduleModal({ booking, newDate, newStart, newEnd, onConfirm, onCancel }) {
  if (!booking) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-[#1a1b4b] mb-1">Reschedule Lesson?</h3>
        <p className="text-sm text-gray-500 mb-4">Moving <strong>{booking.student_name}</strong>'s lesson to:</p>
        <div className="bg-[#1a1b4b]/5 border border-[#1a1b4b]/10 rounded-xl p-4 mb-4 space-y-1">
          <p className="text-sm font-bold text-[#1a1b4b]">{format(parseISO(newDate), "EEEE, MMMM d, yyyy")}</p>
          <p className="text-sm text-gray-600">{newStart} – {newEnd}</p>
        </div>
        <p className="text-xs text-gray-400 mb-5">The student will be notified automatically via an internal message.</p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onCancel} className="flex-1 rounded-xl">Cancel</Button>
          <Button onClick={onConfirm} className="flex-1 rounded-xl bg-[#1a1b4b] hover:bg-[#2a2b5b]">Confirm</Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function TeacherCalendarTab({ user }) {
  const navigate = useNavigate();
  const [now, setNow] = useState(new Date());

  const [tz, setTz]               = useState(detectTZ());
  const [profile, setProfile]     = useState(null);
  const [weeklySlots, setWeeklySlots] = useState({});
  const [bookings, setBookings]   = useState([]);
  const [blockedDates, setBlockedDates] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);

  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [mode, setMode]           = useState("view"); // "view" | "availability"

  const [selectedBooking, setSelectedBooking]     = useState(null);
  const [pendingReschedule, setPendingReschedule] = useState(null);

  const dragRef        = useRef(null);
  const [dragPreview, setDragPreview] = useState(null);
  const gridRefs       = useRef({});
  const scrollRef      = useRef(null);
  const lessonDragRef  = useRef(null);
  const [dropHighlight, setDropHighlight] = useState(null);

  // Tick clock every 30s for countdown + current time line
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (!loading && scrollRef.current) {
      // Scroll to current hour minus 1 hour for context
      const nowH = now.getHours() + now.getMinutes() / 60;
      const target = Math.max(0, (nowH - 1)) * 60 * ROW_H;
      scrollRef.current.scrollTop = target;
    }
  }, [loading]);

  // Real-time subscription
  useEffect(() => {
    const unsub = base44.entities.Booking.subscribe(async (event) => {
      if (event.data?.teacher_email && event.data.teacher_email !== (user?.email || (await base44.auth.me()).email)) return;
      if (event.type === "create") {
        setBookings(prev => [...prev, event.data]);
        toast.success(`📅 New booking: ${event.data.student_name}`);
      } else if (event.type === "update") {
        setBookings(prev => prev.map(b => b.id === event.id ? event.data : b));
      } else if (event.type === "delete") {
        setBookings(prev => prev.filter(b => b.id !== event.id));
      }
    });
    return unsub;
  }, [user?.email]);

  const loadData = async () => {
    const me = user || await base44.auth.me();
    const [profiles, slots, blocked, bkgs] = await Promise.all([
      base44.entities.TeacherProfile.filter({ user_email: me.email }),
      base44.entities.AvailabilitySlots.filter({ teacher_email: me.email }),
      base44.entities.BlockedDate.filter({ teacher_email: me.email }),
      base44.entities.Booking.filter({ teacher_email: me.email }),
    ]);
    if (profiles[0]) { setProfile(profiles[0]); if (profiles[0].timezone) setTz(profiles[0].timezone); }
    const grouped = {};
    slots.forEach(s => {
      if (!grouped[s.day_of_week]) grouped[s.day_of_week] = [];
      grouped[s.day_of_week].push({ id: s.id, start_time: s.start_time, end_time: s.end_time });
    });
    setWeeklySlots(grouped);
    setBlockedDates(blocked);
    setBookings(bkgs);
    setLoading(false);
  };

  // ── Availability drag ──────────────────────────────────────────────────────
  const getMinFromY = (y, el) => {
    const rect = el.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (y - rect.top) / rect.height));
    const rawMin = frac * VISIBLE_SPAN + DAY_START_H * 60;
    return Math.round(rawMin / SNAP_MINS) * SNAP_MINS;
  };

  const handleMouseDown = useCallback((e, colIdx, dayOfWeek) => {
    if (mode !== "availability" || e.button !== 0 || lessonDragRef.current) return;
    const el = gridRefs.current[colIdx];
    if (!el) return;
    const startMin = getMinFromY(e.clientY, el);
    dragRef.current = { colIdx, dayOfWeek, startMin, endMin: startMin };
    setDragPreview({ colIdx, startMin, endMin: startMin });
    e.preventDefault();
  }, [mode]);

  const handleMouseMove = useCallback((e) => {
    if (!dragRef.current) return;
    const el = gridRefs.current[dragRef.current.colIdx];
    if (!el) return;
    const endMin = getMinFromY(e.clientY, el);
    dragRef.current.endMin = endMin;
    setDragPreview({ colIdx: dragRef.current.colIdx, startMin: dragRef.current.startMin, endMin });
  }, []);

  const handleMouseUp = useCallback(() => {
    if (!dragRef.current) return;
    const { dayOfWeek, startMin, endMin } = dragRef.current;
    dragRef.current = null; setDragPreview(null);
    const lo = Math.min(startMin, endMin);
    const hi = Math.max(startMin, endMin + SNAP_MINS);
    if (hi - lo < SNAP_MINS) return;
    const utcStart = localToUTC(fromMin(lo), tz);
    const utcEnd   = localToUTC(fromMin(hi), tz);
    setWeeklySlots(prev => {
      const existing = prev[dayOfWeek] || [];
      if (existing.some(s => collides(utcStart, utcEnd, s.start_time, s.end_time))) {
        toast.error("Overlaps with existing availability."); return prev;
      }
      return { ...prev, [dayOfWeek]: [...existing, { start_time: utcStart, end_time: utcEnd }] };
    });
  }, [tz]);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => { window.removeEventListener("mousemove", handleMouseMove); window.removeEventListener("mouseup", handleMouseUp); };
  }, [handleMouseMove, handleMouseUp]);

  const removeSlot = (dayOfWeek, slot) => {
    setWeeklySlots(prev => ({
      ...prev,
      [dayOfWeek]: (prev[dayOfWeek] || []).filter(s => !(s.start_time === slot.start_time && s.end_time === slot.end_time))
    }));
  };

  const saveAvailability = async () => {
    setSaving(true);
    const me = user || await base44.auth.me();
    const existing = await base44.entities.AvailabilitySlots.filter({ teacher_email: me.email });
    await Promise.all(existing.map(s => base44.entities.AvailabilitySlots.delete(s.id)));
    const toCreate = [];
    Object.entries(weeklySlots).forEach(([day, slots]) => {
      slots.forEach(s => toCreate.push({ teacher_email: me.email, day_of_week: Number(day), start_time: s.start_time, end_time: s.end_time, is_recurring: true }));
    });
    if (toCreate.length > 0) await base44.entities.AvailabilitySlots.bulkCreate(toCreate);
    if (profile?.id) await base44.entities.TeacherProfile.update(profile.id, { timezone: tz });
    setSaving(false);
    toast.success("Weekly availability saved!");
  };

  // ── Lesson drag-to-reschedule ──────────────────────────────────────────────
  const handleLessonDragStart = (e, booking) => {
    lessonDragRef.current = { booking };
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", booking.id);
  };

  const handleDropOnColumn = (e, colIdx, date) => {
    e.preventDefault();
    setDropHighlight(null);
    const b = lessonDragRef.current?.booking;
    if (!b) return;
    lessonDragRef.current = null;
    const el = gridRefs.current[colIdx];
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    const rawMin = frac * VISIBLE_SPAN + DAY_START_H * 60;
    const startMin = Math.round(rawMin / SNAP_MINS) * SNAP_MINS;
    const duration = toMin(b.end_time) - toMin(b.start_time);
    const endMin = startMin + duration;
    const newStartLocal = fromMin(startMin);
    const newEndLocal   = fromMin(Math.min(endMin, TOTAL_MINS));
    const newStartUTC   = localToUTC(newStartLocal, tz);
    const newEndUTC     = localToUTC(newEndLocal, tz);
    const newDate       = format(date, "yyyy-MM-dd");
    if (newDate === b.date && newStartUTC === b.start_time) return;
    setPendingReschedule({ booking: b, newDate, newStartUTC, newEndUTC, newStartLocal, newEndLocal });
  };

  const confirmReschedule = async () => {
    const { booking, newDate, newStartUTC, newEndUTC } = pendingReschedule;
    await base44.entities.Booking.update(booking.id, {
      date: newDate, start_time: newStartUTC, end_time: newEndUTC,
      status: "rescheduled", change_timestamp: new Date().toISOString()
    });
    await base44.functions.invoke("sendPrivateMessage", {
      recipientEmail: booking.student_email,
      content: `Hi ${booking.student_name?.split(" ")[0]}, your lesson has been rescheduled. New time: ${format(parseISO(newDate), "MMMM d, yyyy")} at ${pendingReschedule.newStartLocal}. Please check your schedule.`
    });
    setBookings(prev => prev.map(b => b.id === booking.id ? { ...b, date: newDate, start_time: newStartUTC, end_time: newEndUTC, status: "rescheduled" } : b));
    setPendingReschedule(null);
    toast.success("Lesson rescheduled & student notified!");
  };

  // ── Booking actions ────────────────────────────────────────────────────────
  const cancelBooking = async (booking) => {
    await base44.entities.Booking.update(booking.id, { status: "canceled", change_timestamp: new Date().toISOString() });
    setBookings(prev => prev.map(b => b.id === booking.id ? { ...b, status: "canceled" } : b));
    setSelectedBooking(null);
    toast.success("Lesson cancelled");
  };
  const completeBooking = async (booking) => {
    await base44.entities.Booking.update(booking.id, { status: "completed", change_timestamp: new Date().toISOString() });
    setBookings(prev => prev.map(b => b.id === booking.id ? { ...b, status: "completed" } : b));
    setSelectedBooking(null);
    toast.success("Marked as completed");
  };

  // ── Blocked dates ──────────────────────────────────────────────────────────
  const addBlockedDate = async (dateStr) => {
    if (!dateStr) return;
    const me = user || await base44.auth.me();
    const created = await base44.entities.BlockedDate.create({ teacher_email: me.email, date: dateStr, reason: "" });
    setBlockedDates(prev => [...prev, created]);
    toast.success("Day blocked");
  };
  const removeBlockedDate = async (id) => {
    await base44.entities.BlockedDate.delete(id);
    setBlockedDates(prev => prev.filter(b => b.id !== id));
    toast.success("Day unblocked");
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const isBlocked = (date) => blockedDates.some(b => b.date === format(date, "yyyy-MM-dd"));
  const bookingsForDate = (date) => bookings.filter(b => b.date === format(date, "yyyy-MM-dd"));

  const weekBookings = weekDays.flatMap(d => bookingsForDate(d));
  const weekScheduled = weekBookings.filter(b => b.status === "scheduled").length;
  const weekCompleted = weekBookings.filter(b => b.status === "completed").length;
  const weekHours = weekBookings.reduce((s, b) => s + (b.session_duration || 0), 0) / 60;

  // Is this week the current week? (for showing red time line)
  const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 });
  const isThisWeek = format(weekStart, "yyyy-MM-dd") === format(thisWeekStart, "yyyy-MM-dd");

  // Current time Y position (px) in the visible grid
  const nowLocalMins = now.getHours() * 60 + now.getMinutes();
  const nowYPx = isThisWeek ? Math.max(0, (nowLocalMins - DAY_START_H * 60)) * ROW_H : null;

  if (loading) return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Loader2 className="w-8 h-8 animate-spin text-[#1a1b4b]" />
    </div>
  );

  // Drag preview px values
  const dpStartY = dragPreview ? Math.max(0, dragPreview.startMin - DAY_START_H * 60) * ROW_H : 0;
  const dpEndMin = dragPreview ? Math.max(dragPreview.startMin, dragPreview.endMin) + SNAP_MINS : 0;
  const dpH      = dragPreview ? Math.max(SNAP_MINS * ROW_H, (dpEndMin - Math.min(dragPreview.startMin, dragPreview.endMin)) * ROW_H) : 0;

  return (
    <div className="flex flex-col gap-3" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1b4b] tracking-tight">Schedule</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {mode === "availability"
              ? "✏️ Drag to set recurring availability · click a slot to remove"
              : "📋 Click a lesson for details · drag to reschedule"}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Timezone */}
          <div className="flex items-center gap-1.5 bg-white border border-gray-200 px-3 py-2 rounded-xl shadow-sm">
            <Globe className="w-3.5 h-3.5 text-gray-500 shrink-0" />
            <select value={tz} onChange={e => setTz(e.target.value)}
              className="bg-transparent text-xs text-gray-700 outline-none max-w-[140px]">
              {["UTC","America/New_York","America/Chicago","America/Denver","America/Los_Angeles",
                "Europe/London","Europe/Paris","Europe/Berlin","Europe/Moscow","Asia/Dubai",
                "Asia/Kolkata","Asia/Singapore","Asia/Tokyo","Australia/Sydney","Pacific/Auckland"
              ].map(z => <option key={z} value={z}>{z.replace(/_/g," ")}</option>)}
            </select>
          </div>

          {/* Mode toggle */}
          <button
            onClick={() => setMode(m => m === "view" ? "availability" : "view")}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
              mode === "availability"
                ? "bg-emerald-500 text-white border-emerald-500 shadow-sm"
                : "bg-white text-gray-600 border-gray-200 hover:border-emerald-400 shadow-sm"
            }`}
          >
            {mode === "availability" ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
            {mode === "availability" ? "Editing Hours" : "Set Weekly Hours"}
          </button>

          {mode === "availability" && (
            <Button onClick={saveAvailability} disabled={saving} size="sm"
              className="bg-emerald-500 hover:bg-emerald-600 rounded-xl gap-1.5 text-xs shadow-sm">
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              Save Hours
            </Button>
          )}
        </div>
      </div>

      {/* ── Next lesson countdown ────────────────────────────────────────── */}
      <NextLessonBanner bookings={bookings} tz={tz} navigate={navigate} />

      {/* ── Stats bar ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "This week", sub: "upcoming", value: weekScheduled, pill: "bg-[#1a1b4b] text-white" },
          { label: "This week", sub: "completed", value: weekCompleted, pill: "bg-emerald-500 text-white" },
          { label: "This week", sub: "hours taught", value: weekHours.toFixed(1) + "h", pill: "bg-[#f97066] text-white" },
        ].map(s => (
          <div key={s.sub} className="bg-white border border-gray-100 rounded-xl p-3 text-center shadow-sm">
            <span className={`inline-block px-2 py-0.5 rounded-full text-sm font-bold mb-1 ${s.pill}`}>{s.value}</span>
            <p className="text-[10px] text-gray-400 leading-tight capitalize">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Week navigator ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 bg-white border border-gray-100 rounded-xl px-3 py-2 shadow-sm w-fit">
        <button onClick={() => setWeekStart(w => subWeeks(w, 1))}
          className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors">
          <ChevronLeft className="w-4 h-4 text-gray-600" />
        </button>
        <span className="text-sm font-bold text-[#1a1b4b] min-w-[170px] text-center">
          {format(weekStart, "MMM d")} – {format(addDays(weekStart, 6), "MMM d, yyyy")}
        </span>
        <button onClick={() => setWeekStart(w => addWeeks(w, 1))}
          className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors">
          <ChevronRight className="w-4 h-4 text-gray-600" />
        </button>
        <div className="w-px h-4 bg-gray-200 mx-1" />
        <button onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
          className="flex items-center gap-1 text-xs font-semibold text-[#1a1b4b] hover:text-[#f97066] transition-colors px-1">
          <CalendarDays className="w-3.5 h-3.5" /> Today
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          THE GRID
      ══════════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl border border-gray-300 shadow-md overflow-hidden">

        {/* ── Sticky day headers ─────────────────────────────────────────── */}
        <div className="grid border-b-2 border-gray-300 bg-white sticky top-0 z-40 shadow-sm"
          style={{ gridTemplateColumns: `${TIME_COL_W}px repeat(7, 1fr)` }}>
          {/* Time zone label */}
          <div className="flex items-end justify-end px-3 py-3">
            <span className="text-[9px] font-bold text-gray-300 uppercase tracking-widest leading-none">
              {tz.split("/").pop()?.replace(/_/g," ")?.slice(0,6)}
            </span>
          </div>
          {weekDays.map((date, colIdx) => {
            const blocked  = isBlocked(date);
            const today    = isToday(date);
            const dayBks   = bookingsForDate(date).filter(b => b.status === "scheduled");
            return (
              <div key={colIdx}
                className={`py-3 px-2 text-center border-l border-gray-300 relative
                  ${today ? "bg-[#1a1b4b]/3" : blocked ? "bg-red-50/80" : ""}`}>
                <p className={`text-[10px] font-black uppercase tracking-widest ${today ? "text-[#f97066]" : "text-gray-400"}`}>
                  {DAY_LABELS[colIdx]}
                </p>
                <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full mt-1 text-sm font-black ${
                  today ? "bg-[#f97066] text-white shadow-lg shadow-[#f97066]/30" : "text-[#1a1b4b]"
                }`}>
                  {format(date, "d")}
                </div>
                {dayBks.length > 0 && (
                  <span className="absolute top-2 right-2 bg-[#f97066] text-white text-[9px] font-black rounded-full w-4 h-4 flex items-center justify-center">
                    {dayBks.length}
                  </span>
                )}
                {blocked ? (
                  <button onClick={() => { const e = blockedDates.find(b => b.date === format(date,"yyyy-MM-dd")); if(e) removeBlockedDate(e.id); }}
                    className="flex items-center gap-0.5 mx-auto mt-1 text-[9px] text-red-400 hover:text-red-600 font-bold transition-colors">
                    <Ban className="w-2.5 h-2.5" /> Blocked
                  </button>
                ) : (
                  <button onClick={() => addBlockedDate(format(date, "yyyy-MM-dd"))}
                    className="mx-auto mt-1 text-[9px] text-gray-200 hover:text-red-400 transition-colors block font-medium">
                    block
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Scrollable time grid ───────────────────────────────────────── */}
        <div ref={scrollRef} className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 380px)", minHeight: "500px" }}>
          <div className="grid relative" style={{ gridTemplateColumns: `${TIME_COL_W}px repeat(7, 1fr)` }}>

            {/* ── Time labels column ── */}
            <div className="relative bg-gray-50 border-r border-gray-300" style={{ height: GRID_H }}>
              {HOURS.map(h => (
                <div key={h} className="absolute w-full flex items-center justify-end pr-3"
                  style={{ top: (h - DAY_START_H) * 60 * ROW_H - 8 }}>
                  {h < DAY_END_H && (
                    <span className={`text-xs font-bold leading-none ${
                      h === now.getHours() && isThisWeek ? "text-red-500" : "text-gray-400"
                    }`}>
                      {String(h).padStart(2,"0")}:00
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* ── Day columns ── */}
            {weekDays.map((date, colIdx) => {
              const dayOfWeek  = date.getDay();
              const avSlots    = weeklySlots[dayOfWeek] || [];
              const dayBookings = bookingsForDate(date).filter(b => b.status !== "canceled" && b.status !== "cancelled");
              const blocked    = isBlocked(date);
              const isDropTarget = dropHighlight === colIdx;
              const today      = isToday(date);

              return (
                <div key={colIdx}
                  data-col={colIdx}
                  id={`col-${colIdx}`}
                  className={`relative border-l border-gray-300 select-none transition-colors
                    ${blocked ? "bg-red-50/40" : isDropTarget ? "bg-blue-50/50" : "bg-white"}
                    ${mode === "availability" && !blocked ? "cursor-crosshair" : "cursor-default"}
                  `}
                  style={{ height: GRID_H }}
                  ref={el => gridRefs.current[colIdx] = el}
                  onMouseDown={!blocked ? e => handleMouseDown(e, colIdx, dayOfWeek) : undefined}
                  onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDropHighlight(colIdx); }}
                  onDragLeave={() => setDropHighlight(null)}
                  onDrop={e => handleDropOnColumn(e, colIdx, date)}
                >
                  {/* Hour lines (bold) + half-hour lines (dashed) */}
                  {HOURS.map(h => (
                    <React.Fragment key={h}>
                      <div className="absolute w-full border-t border-gray-300"
                        style={{ top: (h - DAY_START_H) * 60 * ROW_H }} />
                      {h < DAY_END_H && (
                        <div className="absolute w-full border-t border-gray-200 border-dashed"
                          style={{ top: (h - DAY_START_H) * 60 * ROW_H + 30 * ROW_H }} />
                      )}
                    </React.Fragment>
                  ))}

                  {/* Blocked overlay */}
                  {blocked && (
                    <div className="absolute inset-0 z-5 pointer-events-none"
                      style={{ backgroundImage: "repeating-linear-gradient(-45deg, transparent, transparent 8px, rgba(239,68,68,0.06) 8px, rgba(239,68,68,0.06) 16px)" }} />
                  )}

                  {/* ── Unavailable background (grey) ── */}
                  {!blocked && <div className="absolute inset-0 z-0 bg-gray-100 pointer-events-none" />}

                  {/* ── Layer 1: Availability bands ── */}
                  {!blocked && avSlots.map((slot, i) => {
                    const dispStart = utcToLocal(slot.start_time, tz);
                    const dispEnd   = utcToLocal(slot.end_time, tz);
                    const yTop  = minToY(dispStart);
                    const yH    = durationToPx(dispStart, dispEnd);
                    return (
                      <div key={i}
                        className={`absolute left-1 right-1 z-10 rounded-xl transition-all
                          ${mode === "availability"
                            ? "bg-emerald-500/50 border border-emerald-500 hover:bg-red-400/50 hover:border-red-500 cursor-pointer group"
                            : "bg-emerald-500/50 border border-emerald-500 pointer-events-none"
                          }
                        `}
                        style={{ top: yTop + 2, height: yH - 4 }}
                        onClick={mode === "availability" ? e => { e.stopPropagation(); removeSlot(dayOfWeek, slot); } : undefined}
                        title={mode === "availability" ? `${dispStart}–${dispEnd} · click to remove` : `Available`}
                      >
                        {yH > 24 && (
                          <span className={`absolute top-1 left-1.5 text-[10px] font-bold leading-tight
                            ${mode === "availability" ? "text-emerald-900 group-hover:text-red-700" : "text-emerald-900"}`}>
                            {dispStart}
                            {yH > 48 && <span className="block text-[9px] font-normal opacity-70">→ {dispEnd}</span>}
                          </span>
                        )}
                        {mode === "availability" && (
                          <X className="absolute top-1 right-1 w-3 h-3 text-emerald-700 opacity-0 group-hover:opacity-100 group-hover:text-red-600" />
                        )}
                      </div>
                    );
                  })}

                  {/* ── Layer 2: Booked lesson cards ── */}
                  {dayBookings.map(booking => (
                    <BookingCard
                      key={booking.id}
                      booking={booking}
                      tz={tz}
                      now={now}
                      onDetailsClick={setSelectedBooking}
                      onDragStart={handleLessonDragStart}
                      navigate={navigate}
                    />
                  ))}

                  {/* ── Current time red line (only on today's column) ── */}
                  {isThisWeek && today && nowYPx !== null && nowYPx >= 0 && nowYPx <= GRID_H && (
                    <div className="absolute left-0 right-0 z-30 pointer-events-none" style={{ top: nowYPx }}>
                      <div className="flex items-center">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-md shadow-red-400/50 shrink-0 -ml-1.5 z-10" />
                        <div className="flex-1 h-0.5 bg-red-400" />
                      </div>
                    </div>
                  )}
                  {/* Faint red line across all columns for today's week */}
                  {isThisWeek && !today && nowYPx !== null && nowYPx >= 0 && nowYPx <= GRID_H && (
                    <div className="absolute left-0 right-0 z-30 pointer-events-none" style={{ top: nowYPx }}>
                      <div className="h-px bg-red-300/50" />
                    </div>
                  )}

                  {/* ── Availability drag preview ── */}
                  {dragPreview?.colIdx === colIdx && (() => {
                    const lo = Math.min(dragPreview.startMin, dragPreview.endMin);
                    const hi = Math.max(dragPreview.startMin, dragPreview.endMin) + SNAP_MINS;
                    const yTop = Math.max(0, (lo - DAY_START_H * 60)) * ROW_H;
                    const yH   = Math.max(SNAP_MINS * ROW_H, (hi - lo) * ROW_H);
                    return (
                      <div className="absolute left-0 right-0 bg-emerald-400/30 border-2 border-emerald-500 rounded-lg z-30 pointer-events-none"
                        style={{ top: yTop, height: yH }}>
                        <span className="text-[10px] text-emerald-700 font-bold px-1.5 pt-1 block">
                          {fromMin(lo)} → {fromMin(Math.min(hi, TOTAL_MINS))}
                        </span>
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Grid footer / legend ─────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-t border-gray-100 bg-gray-50/50 text-[11px] text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-emerald-200 border-l-2 border-emerald-400 inline-block" />
            Available
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-[#1a1b4b] inline-block" />
            Scheduled
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-orange-500 inline-block" />
            Starting soon
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-emerald-500 inline-block" />
            Completed
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-blue-400 inline-block" />
            Rescheduled
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
            Current time
          </span>
          <span className="ml-auto text-gray-400 hidden sm:block">
            {mode === "availability" ? "Drag to create · click to remove · save when done" : "Drag lesson card to reschedule"}
          </span>
        </div>
      </div>

      {/* ── Modals ─────────────────────────────────────────────────────── */}
      {selectedBooking && (
        <BookingModal
          booking={selectedBooking}
          tz={tz}
          onClose={() => setSelectedBooking(null)}
          onCancel={cancelBooking}
          onComplete={completeBooking}
          onMessage={() => { setSelectedBooking(null); navigate(createPageUrl("TeacherDashboard") + "?tab=messages"); }}
          onJoinClassroom={(bookingId) => { setSelectedBooking(null); navigate(createPageUrl(`TeacherDashboard?tab=classroom&bookingId=${bookingId}`)); }}
        />
      )}
      {pendingReschedule && (
        <RescheduleModal
          booking={pendingReschedule.booking}
          newDate={pendingReschedule.newDate}
          newStart={pendingReschedule.newStartLocal}
          newEnd={pendingReschedule.newEndLocal}
          onConfirm={confirmReschedule}
          onCancel={() => setPendingReschedule(null)}
        />
      )}
    </div>
  );
}