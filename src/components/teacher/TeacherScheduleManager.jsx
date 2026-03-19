import React, { useState, useEffect, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import {
  Save, Loader2, AlertCircle, CheckCircle, Globe, X, Plus,
  ChevronLeft, ChevronRight, CalendarDays
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  format, parseISO, startOfWeek, addDays, addWeeks, subWeeks,
  isSameDay, isToday, isBefore, startOfDay
} from "date-fns";

// ─── Time helpers ───────────────────────────────────────────────────────────
const toMin = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const fromMin = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const detectTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

const getOffsetMs = (tz) => {
  try {
    const now = new Date();
    const utcStr = now.toLocaleString("en-US", { timeZone: "UTC" });
    const localStr = now.toLocaleString("en-US", { timeZone: tz });
    return new Date(localStr) - new Date(utcStr);
  } catch { return 0; }
};

const localToUTC = (hhmm, tz) => {
  try {
    const now = new Date();
    const localDate = new Date(`${format(now, "yyyy-MM-dd")}T${hhmm}:00`);
    const utcMs = localDate.getTime() - getOffsetMs(tz);
    const utc = new Date(utcMs);
    return `${String(utc.getUTCHours()).padStart(2, "0")}:${String(utc.getUTCMinutes()).padStart(2, "0")}`;
  } catch { return hhmm; }
};

const utcToLocal = (hhmm, tz) => {
  try {
    const now = new Date();
    const utcDate = new Date(`${format(now, "yyyy-MM-dd")}T${hhmm}:00Z`);
    const local = new Date(utcDate.getTime() + getOffsetMs(tz));
    return `${String(local.getHours()).padStart(2, "0")}:${String(local.getMinutes()).padStart(2, "0")}`;
  } catch { return hhmm; }
};

const collides = (as, ae, bs, be) => toMin(as) < toMin(be) && toMin(ae) > toMin(bs);
const hasOverlap = (slots) =>
  slots.some((a, i) => slots.slice(i + 1).some(b => collides(a.start_time, a.end_time, b.start_time, b.end_time)));

// Grid constants
const GRID_HEIGHT = 1440; // px  (1px per minute)
const TOTAL_MINS = 24 * 60;
const VISIBLE_HOURS = Array.from({ length: 24 }, (_, i) => i);

const toGridPct = (hhmm) => (toMin(hhmm) / TOTAL_MINS) * 100;
const toGridHeightPct = (s, e) => Math.max(0.8, ((toMin(e) - toMin(s)) / TOTAL_MINS) * 100);

// ─── Component ───────────────────────────────────────────────────────────────
export default function TeacherScheduleManager() {
  const [view, setView] = useState("calendar");
  const [tz, setTz] = useState(detectTimezone());
  const [profile, setProfile] = useState(null);
  const [weeklySlots, setWeeklySlots] = useState({});   // { dayOfWeek: [{start_time, end_time}] }
  const [bookings, setBookings] = useState([]);          // real booked sessions
  const [blockedDates, setBlockedDates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [newBlockDate, setNewBlockDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [newBlockReason, setNewBlockReason] = useState("");

  const dragRef = useRef(null);
  const [dragPreview, setDragPreview] = useState(null);
  const gridRefs = useRef({});        // keyed by dayIndex (0–6) for calendar view
  const scrollRef = useRef(null);

  useEffect(() => { loadData(); }, []);

  // Auto-scroll to 7am on mount
  useEffect(() => {
    if (!loading && scrollRef.current) {
      scrollRef.current.scrollTop = (7 / 24) * GRID_HEIGHT;
    }
  }, [loading]);

  const loadData = async () => {
    const me = await base44.auth.me();
    const [profiles, slots, blocked, bkgs] = await Promise.all([
      base44.entities.TeacherProfile.filter({ user_email: me.email }),
      base44.entities.AvailabilitySlots.filter({ teacher_email: me.email }),
      base44.entities.BlockedDate.filter({ teacher_email: me.email }),
      base44.entities.Booking.list(),
    ]);
    if (profiles.length > 0) {
      setProfile(profiles[0]);
      if (profiles[0].timezone) setTz(profiles[0].timezone);
    }
    const grouped = {};
    slots.forEach(s => {
      const d = s.day_of_week;
      if (!grouped[d]) grouped[d] = [];
      grouped[d].push({ id: s.id, start_time: s.start_time, end_time: s.end_time });
    });
    setWeeklySlots(grouped);
    setBlockedDates(blocked);
    setBookings(bkgs);
    setLoading(false);
  };

  // ── Drag handlers (for availability editing) ─────────────────────────────
  const getMinFromY = (y, el) => {
    const rect = el.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (y - rect.top) / rect.height));
    return Math.round((frac * TOTAL_MINS) / 30) * 30;
  };

  const calcPreview = (startMin, endMin, key) => {
    const lo = Math.min(startMin, endMin);
    const hi = Math.max(startMin, endMin + 30);
    return { key, topPct: (lo / TOTAL_MINS) * 100, heightPct: ((hi - lo) / TOTAL_MINS) * 100 };
  };

  const handleMouseDown = useCallback((e, key, dayOfWeek) => {
    if (e.button !== 0) return;
    const el = gridRefs.current[key];
    if (!el) return;
    const startMin = getMinFromY(e.clientY, el);
    dragRef.current = { key, dayOfWeek, startMin, endMin: startMin };
    setDragPreview(calcPreview(startMin, startMin, key));
    e.preventDefault();
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!dragRef.current) return;
    const el = gridRefs.current[dragRef.current.key];
    if (!el) return;
    const endMin = getMinFromY(e.clientY, el);
    dragRef.current.endMin = endMin;
    setDragPreview(calcPreview(dragRef.current.startMin, endMin, dragRef.current.key));
  }, []);

  const handleMouseUp = useCallback(() => {
    if (!dragRef.current) return;
    const { dayOfWeek, startMin, endMin } = dragRef.current;
    dragRef.current = null;
    setDragPreview(null);
    const lo = Math.min(startMin, endMin);
    const hi = Math.max(startMin, endMin + 30);
    if (hi - lo < 30) return;
    const utcStart = localToUTC(fromMin(lo), tz);
    const utcEnd = localToUTC(fromMin(hi), tz);
    const newSlot = { start_time: utcStart, end_time: utcEnd };
    setWeeklySlots(prev => {
      const existing = prev[dayOfWeek] || [];
      const overlaps = existing.some(s => collides(newSlot.start_time, newSlot.end_time, s.start_time, s.end_time));
      if (overlaps) { toast.error("Overlaps with existing availability."); return prev; }
      return { ...prev, [dayOfWeek]: [...existing, newSlot] };
    });
  }, [tz]);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const removeSlot = (dayOfWeek, slot) => {
    setWeeklySlots(prev => ({
      ...prev,
      [dayOfWeek]: (prev[dayOfWeek] || []).filter(
        s => !(s.start_time === slot.start_time && s.end_time === slot.end_time)
      )
    }));
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const save = async () => {
    const errors = [];
    [0,1,2,3,4,5,6].forEach(idx => {
      if (hasOverlap(weeklySlots[idx] || [])) errors.push(`${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][idx]} has overlapping slots`);
    });
    if (errors.length > 0) { setSaveStatus({ errors }); errors.forEach(e => toast.error(e)); return; }
    setSaving(true); setSaveStatus(null);
    const me = await base44.auth.me();
    const existing = await base44.entities.AvailabilitySlots.filter({ teacher_email: me.email });
    await Promise.all(existing.map(s => base44.entities.AvailabilitySlots.delete(s.id)));
    const toCreate = [];
    Object.entries(weeklySlots).forEach(([day, slots]) => {
      slots.forEach(s => toCreate.push({
        teacher_email: me.email, day_of_week: Number(day),
        start_time: s.start_time, end_time: s.end_time, is_recurring: true
      }));
    });
    if (toCreate.length > 0) await base44.entities.AvailabilitySlots.bulkCreate(toCreate);
    if (profile?.id) await base44.entities.TeacherProfile.update(profile.id, { timezone: tz });
    setSaving(false); setSaveStatus("success");
    setTimeout(() => setSaveStatus(null), 3000);
  };

  // ── Blocked dates ─────────────────────────────────────────────────────────
  const addBlockedDate = async () => {
    if (!newBlockDate) return;
    const me = await base44.auth.me();
    const created = await base44.entities.BlockedDate.create({
      teacher_email: me.email, date: newBlockDate, reason: newBlockReason
    });
    setBlockedDates(prev => [...prev, created]);
    setNewBlockReason("");
  };

  const removeBlockedDate = async (id) => {
    await base44.entities.BlockedDate.delete(id);
    setBlockedDates(prev => prev.filter(b => b.id !== id));
  };

  // ── Week navigation ───────────────────────────────────────────────────────
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const goToday = () => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }));

  // ── Render helpers ────────────────────────────────────────────────────────
  // bookings for a specific calendar date
  const bookingsForDate = (date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return bookings.filter(b => {
      if (b.date !== dateStr) return false;
      // Mark as completed if the lesson date + time has passed
      const lessonDateTime = new Date(`${b.date}T${b.start_time}`);
      if (isBefore(lessonDateTime, new Date()) && b.status === "scheduled") {
        // Auto-mark as completed for display
        return true;
      }
      return true;
    });
  };

  // is this date blocked?
  const isBlocked = (date) =>
    blockedDates.some(b => b.date === format(date, "yyyy-MM-dd"));

  if (loading) return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <Loader2 className="w-6 h-6 animate-spin text-[#1a1b4b]" />
    </div>
  );

  return (
    <div>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1b4b]">Schedule</h1>
          <p className="text-gray-400 text-sm mt-0.5">Drag to set availability · bookings appear automatically</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 bg-gray-100 px-3 py-2 rounded-xl">
            <Globe className="w-4 h-4 text-gray-500" />
            <select value={tz} onChange={e => setTz(e.target.value)}
              className="bg-transparent text-sm text-gray-700 outline-none max-w-[170px]">
              {["UTC","America/New_York","America/Chicago","America/Denver","America/Los_Angeles",
                "Europe/London","Europe/Paris","Europe/Berlin","Europe/Moscow","Asia/Dubai",
                "Asia/Kolkata","Asia/Singapore","Asia/Tokyo","Australia/Sydney","Pacific/Auckland"
              ].map(z => <option key={z} value={z}>{z.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <Button onClick={save} disabled={saving} className="bg-[#f97066] hover:bg-[#e8605a] rounded-xl gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
          </Button>
        </div>
      </div>

      {/* ── Status banners ──────────────────────────────────────────────── */}
      {saveStatus === "success" && (
        <div className="mb-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-emerald-700 text-sm">
          <CheckCircle className="w-4 h-4" /> Schedule saved!
        </div>
      )}
      {saveStatus?.errors && (
        <div className="mb-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          <div className="flex items-center gap-2 mb-1 font-medium"><AlertCircle className="w-4 h-4" /> Fix overlapping slots:</div>
          {saveStatus.errors.map((e, i) => <div key={i} className="ml-6">• {e}</div>)}
        </div>
      )}

      {/* ── View toggle ─────────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-4 w-fit">
        {[["calendar", "Calendar"], ["exceptions", "Blocked Dates"]].map(([id, label]) => (
          <button key={id} onClick={() => setView(id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${view === id ? 'bg-white text-[#1a1b4b] shadow-sm' : 'text-gray-500 hover:text-[#1a1b4b]'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          CALENDAR VIEW
      ══════════════════════════════════════════════════════════════════ */}
      {view === "calendar" && (
        <div>
          {/* Week navigator */}
          <div className="flex items-center gap-2 mb-3">
            <Button variant="outline" size="icon" onClick={() => setWeekStart(w => subWeeks(w, 1))} className="rounded-xl h-9 w-9">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => setWeekStart(w => addWeeks(w, 1))} className="rounded-xl h-9 w-9">
              <ChevronRight className="w-4 h-4" />
            </Button>
            <span className="text-sm font-semibold text-[#1a1b4b] min-w-[180px]">
              {format(weekStart, "MMM d")} – {format(addDays(weekStart, 6), "MMM d, yyyy")}
            </span>
            <Button variant="outline" size="sm" onClick={goToday} className="rounded-xl gap-1 text-xs">
              <CalendarDays className="w-3 h-3" /> Today
            </Button>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mb-3 text-xs text-gray-500">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#1a1b4b]/20 border border-[#1a1b4b]/40 inline-block" /> Availability</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#f97066] inline-block" /> Booked lesson</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-100 border border-red-300 inline-block" /> Blocked day</span>
          </div>

          {/* Grid */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Day headers */}
            <div className="grid border-b border-gray-100 sticky top-0 z-20 bg-white"
              style={{ gridTemplateColumns: "52px repeat(7, 1fr)" }}>
              <div className="p-2" />
              {weekDays.map((date, i) => {
                const blocked = isBlocked(date);
                const todayDay = isToday(date);
                return (
                  <div key={i} className={`p-2 text-center border-l border-gray-100 ${blocked ? "bg-red-50" : ""}`}>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                      {format(date, "EEE")}
                    </p>
                    <p className={`text-sm font-bold mt-0.5 ${todayDay ? "text-[#f97066]" : "text-[#1a1b4b]"}`}>
                      {format(date, "d")}
                    </p>
                    <p className="text-[10px] text-gray-300">{format(date, "MMM")}</p>
                    {blocked && <p className="text-[9px] text-red-400 font-medium mt-0.5">Blocked</p>}
                  </div>
                );
              })}
            </div>

            {/* Scrollable time grid */}
            <div ref={scrollRef} className="overflow-y-auto" style={{ maxHeight: "600px" }}>
              <div className="grid" style={{ gridTemplateColumns: "52px repeat(7, 1fr)" }}>
                {/* Time labels */}
                <div className="relative" style={{ height: GRID_HEIGHT }}>
                  {VISIBLE_HOURS.map(h => (
                    <div key={h} className="absolute w-full pr-2 text-right"
                      style={{ top: `${(h / 24) * 100}%` }}>
                      <span className="text-[10px] text-gray-300 -mt-2 block">
                        {String(h).padStart(2, "0")}:00
                      </span>
                    </div>
                  ))}
                </div>

                {/* Day columns */}
                {weekDays.map((date, colIdx) => {
                  const dayOfWeek = date.getDay(); // 0=Sun
                  const avSlots = weeklySlots[dayOfWeek] || [];
                  const dayBookings = bookingsForDate(date);
                  const blocked = isBlocked(date);
                  const key = colIdx; // unique per visible column

                  return (
                    <div key={colIdx}
                      className={`relative border-l border-gray-100 select-none ${blocked ? "bg-red-50/40" : "cursor-crosshair"}`}
                      style={{ height: GRID_HEIGHT }}
                      ref={el => gridRefs.current[key] = el}
                      onMouseDown={blocked ? undefined : e => handleMouseDown(e, key, dayOfWeek)}>

                      {/* Hour lines */}
                      {VISIBLE_HOURS.map(h => (
                        <div key={h} className="absolute w-full border-t border-gray-50"
                          style={{ top: `${(h / 24) * 100}%` }} />
                      ))}

                      {/* ── Availability bands ── */}
                      {!blocked && avSlots.map((slot, i) => {
                        const dispStart = utcToLocal(slot.start_time, tz);
                        const dispEnd = utcToLocal(slot.end_time, tz);
                        return (
                          <div key={i}
                            onClick={e => { e.stopPropagation(); removeSlot(dayOfWeek, slot); }}
                            title={`Availability ${dispStart}–${dispEnd} · Click to remove`}
                            className="absolute left-0 right-0 bg-[#1a1b4b]/10 border-l-2 border-[#1a1b4b]/50 cursor-pointer hover:bg-red-100 hover:border-red-400 transition-colors group z-10"
                            style={{
                              top: `${toGridPct(dispStart)}%`,
                              height: `${toGridHeightPct(dispStart, dispEnd)}%`
                            }}>
                            <span className="text-[9px] text-[#1a1b4b]/70 group-hover:text-red-500 px-1 leading-tight block truncate font-medium">
                              {dispStart}
                            </span>
                          </div>
                        );
                      })}

                      {/* ── Booked lessons overlay ── */}
                      {dayBookings.map((booking, i) => {
                        const dispStart = utcToLocal(booking.start_time, tz);
                        const dispEnd = utcToLocal(booking.end_time, tz);
                        const lessonDateTime = new Date(`${booking.date}T${booking.start_time}`);
                        const isPast = isBefore(lessonDateTime, new Date());
                        const isCompleted = booking.status === "completed" || isPast;
                        return (
                          <div key={`bk-${i}`}
                            title={`${booking.student_name} · ${dispStart}–${dispEnd} · ${booking.session_duration}min · ${isCompleted ? "Completed" : "Scheduled"}`}
                            className={`absolute left-1 right-1 rounded-md text-white z-20 px-1.5 py-0.5 overflow-hidden shadow-sm ${
                              isCompleted ? "bg-emerald-500" : "bg-[#f97066]"
                            }`}
                            style={{
                              top: `${toGridPct(dispStart)}%`,
                              height: `${Math.max(toGridHeightPct(dispStart, dispEnd), 2)}%`
                            }}>
                            <p className="text-[10px] font-bold leading-tight truncate">{booking.student_name}</p>
                            <p className="text-[9px] opacity-80 leading-tight">{dispStart}–{dispEnd}</p>
                          </div>
                        );
                      })}

                      {/* ── Drag preview ── */}
                      {dragPreview?.key === key && (
                        <div className="absolute left-1 right-1 bg-blue-400/30 border-2 border-blue-400 rounded-md z-30 pointer-events-none"
                          style={{ top: `${dragPreview.topPct}%`, height: `${dragPreview.heightPct}%` }} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-300 mt-2 text-center">
            Drag on a column to create availability · Click an availability band to remove it · Booked lessons shown in orange
          </p>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          BLOCKED DATES VIEW
      ══════════════════════════════════════════════════════════════════ */}
      {view === "exceptions" && (
        <div className="max-w-2xl space-y-5">
          <p className="text-sm text-gray-500">Block specific dates — these override your weekly schedule.</p>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5 space-y-4">
              <h3 className="font-semibold text-[#1a1b4b]">Block a Date</h3>
              <div className="flex gap-3 flex-wrap">
                <Input type="date" value={newBlockDate} onChange={e => setNewBlockDate(e.target.value)}
                  className="rounded-xl w-40" min={format(new Date(), "yyyy-MM-dd")} />
                <Input value={newBlockReason} onChange={e => setNewBlockReason(e.target.value)}
                  placeholder="Reason (e.g. Holiday)" className="rounded-xl flex-1 min-w-32" />
                <Button onClick={addBlockedDate} className="bg-[#1a1b4b] hover:bg-[#2a2b5b] rounded-xl gap-2">
                  <Plus className="w-4 h-4" /> Block Date
                </Button>
              </div>
            </CardContent>
          </Card>
          {blockedDates.length === 0 ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-10 text-center">
                <p className="text-gray-400 text-sm">No blocked dates yet.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {blockedDates.sort((a, b) => a.date.localeCompare(b.date)).map(b => (
                <div key={b.id} className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-xl">🚫</div>
                    <div>
                      <p className="font-semibold text-[#1a1b4b]">{format(parseISO(b.date), "EEEE, MMMM d, yyyy")}</p>
                      {b.reason && <p className="text-xs text-gray-400">{b.reason}</p>}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeBlockedDate(b.id)}
                    className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl">
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}