import React, { useState, useEffect, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Save, Loader2, AlertCircle, CheckCircle, Globe, X, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { format, addDays, startOfMonth, getDaysInMonth, parseISO } from "date-fns";

// ── Time helpers ────────────────────────────────────────────────────────────
const HOURS = Array.from({ length: 24 }, (_, i) => i); // 00–23
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "HH:MM" → minutes from midnight */
const toMin = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
/** minutes → "HH:MM" */
const fromMin = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** local "HH:MM" → UTC "HH:MM" on a given offset string like "America/New_York" */
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

const getOffsetMs = (tz) => {
  try {
    const now = new Date();
    const utcStr = now.toLocaleString("en-US", { timeZone: "UTC" });
    const localStr = now.toLocaleString("en-US", { timeZone: tz });
    return new Date(localStr) - new Date(utcStr);
  } catch { return 0; }
};

const detectTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

// ── Overlap / collision checks ───────────────────────────────────────────────
/** True if newStart < existingEnd AND newEnd > existingStart */
const collides = (newStart, newEnd, existingStart, existingEnd) =>
  toMin(newStart) < toMin(existingEnd) && toMin(newEnd) > toMin(existingStart);

/** True if any pair of slots in the array collide */
const hasOverlap = (slots) =>
  slots.some((a, i) =>
    slots.slice(i + 1).some(b => collides(a.start_time, a.end_time, b.start_time, b.end_time))
  );

// ── Slot component ──────────────────────────────────────────────────────────
function SlotBlock({ slot, tz, onRemove }) {
  const displayStart = utcToLocal(slot.start_time, tz);
  const displayEnd = utcToLocal(slot.end_time, tz);
  const topPct = (toMin(displayStart) / (24 * 60)) * 100;
  const heightPct = ((toMin(displayEnd) - toMin(displayStart)) / (24 * 60)) * 100;

  return (
    <div
      className="absolute left-1 right-1 bg-[#1a1b4b] rounded-lg text-white text-xs px-1.5 py-1 cursor-default select-none flex items-start justify-between gap-1 z-10 overflow-hidden group"
      style={{ top: `${topPct}%`, height: `${Math.max(heightPct, 1.5)}%` }}
    >
      <span className="truncate font-medium leading-tight">{displayStart}–{displayEnd}</span>
      <button onClick={() => onRemove(slot)} className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5">
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────
export default function ManageSchedule() {
  const [view, setView] = useState("weekly"); // "weekly" | "exceptions"
  const [tz, setTz] = useState(detectTimezone());
  const [profile, setProfile] = useState(null);
  const [weeklySlots, setWeeklySlots] = useState({}); // { dayIndex: [{start_time, end_time}] }
  const [blockedDates, setBlockedDates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // null | "success" | {errors: []}
  const [newBlockDate, setNewBlockDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [newBlockReason, setNewBlockReason] = useState("");

  // drag state
  const dragRef = useRef(null); // { day, startMin, endMin }
  const [dragPreview, setDragPreview] = useState(null); // { day, topPct, heightPct }
  const gridRefs = useRef({});

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const me = await base44.auth.me();
    const [profiles, slots, blocked] = await Promise.all([
      base44.entities.TeacherProfile.filter({ user_email: me.email }),
      base44.entities.AvailabilitySlots.filter({ teacher_email: me.email }),
      base44.entities.BlockedDate.filter({ teacher_email: me.email }),
    ]);

    if (profiles.length > 0) {
      setProfile(profiles[0]);
      if (profiles[0].timezone) setTz(profiles[0].timezone);
    }

    // group by day_of_week
    const grouped = {};
    slots.forEach(s => {
      const d = s.day_of_week;
      if (!grouped[d]) grouped[d] = [];
      grouped[d].push({ id: s.id, start_time: s.start_time, end_time: s.end_time, is_recurring: s.is_recurring });
    });
    setWeeklySlots(grouped);
    setBlockedDates(blocked);
    setLoading(false);
  };

  // ── Drag on grid ──────────────────────────────────────────────────────────
  const TOTAL_MINS_CONST = 24 * 60;

  const getMinFromY = (y, el) => {
    const rect = el.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (y - rect.top) / rect.height));
    return Math.round((frac * TOTAL_MINS_CONST) / 30) * 30; // snap to 30min
  };

  const calcPreview = (startMin, endMin, day) => {
    const lo = Math.min(startMin, endMin);
    const hi = Math.max(startMin, endMin + 30); // always at least 30min
    const topPct = (lo / TOTAL_MINS_CONST) * 100;
    const heightPct = ((hi - lo) / TOTAL_MINS_CONST) * 100;
    return { day, topPct, heightPct };
  };

  const handleMouseDown = useCallback((e, dayIndex) => {
    if (e.button !== 0) return;
    const el = gridRefs.current[dayIndex];
    if (!el) return;
    const startMin = getMinFromY(e.clientY, el);
    dragRef.current = { day: dayIndex, startMin, endMin: startMin };
    setDragPreview(calcPreview(startMin, startMin, dayIndex));
    e.preventDefault();
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!dragRef.current) return;
    const el = gridRefs.current[dragRef.current.day];
    if (!el) return;
    const endMin = getMinFromY(e.clientY, el);
    dragRef.current.endMin = endMin;
    setDragPreview(calcPreview(dragRef.current.startMin, endMin, dragRef.current.day));
  }, []);

  const handleMouseUp = useCallback(() => {
    if (!dragRef.current) return;
    const { day, startMin, endMin } = dragRef.current;
    dragRef.current = null;
    setDragPreview(null);

    const lo = Math.min(startMin, endMin);
    const hi = Math.max(startMin, endMin + 30);
    if (hi - lo < 30) return;

    // Create ONE solid block for the entire dragged range (in local time)
    const localStart = fromMin(lo);
    const localEnd = fromMin(hi);
    const utcStart = localToUTC(localStart, tz);
    const utcEnd = localToUTC(localEnd, tz);
    const newSlot = { start_time: utcStart, end_time: utcEnd, is_recurring: true };

    setWeeklySlots(prev => {
      const existing = prev[day] || [];
      // Check if new slot overlaps with any existing slot
      const overlaps = existing.some(s => collides(newSlot.start_time, newSlot.end_time, s.start_time, s.end_time));
      if (overlaps) {
        toast.error("This time range overlaps with existing availability.");
        return prev;
      }
      return { ...prev, [day]: [...existing, newSlot] };
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

  const removeSlot = (dayIndex, slot) => {
    setWeeklySlots(prev => {
      const updated = (prev[dayIndex] || []).filter(s =>
        !(s.start_time === slot.start_time && s.end_time === slot.end_time)
      );
      return { ...prev, [dayIndex]: updated };
    });
  };

  const clearAll = () => {
    setWeeklySlots({});
    toast.success("All slots cleared. Don't forget to save.");
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const save = async () => {
    // Validate overlaps per day
    const errors = [];
    DAYS.forEach((label, idx) => {
      const slots = weeklySlots[idx] || [];
      if (hasOverlap(slots)) errors.push(`${label} has overlapping slots`);
    });
    if (errors.length > 0) {
      setSaveStatus({ errors });
      errors.forEach(e => toast.error(e));
      return;
    }

    setSaving(true);
    setSaveStatus(null);
    const me = await base44.auth.me();

    // Delete all existing slots for this teacher and re-create
    const existing = await base44.entities.AvailabilitySlots.filter({ teacher_email: me.email });
    await Promise.all(existing.map(s => base44.entities.AvailabilitySlots.delete(s.id)));

    const toCreate = [];
    Object.entries(weeklySlots).forEach(([day, slots]) => {
      slots.forEach(s => {
        toCreate.push({ teacher_email: me.email, day_of_week: Number(day), start_time: s.start_time, end_time: s.end_time, is_recurring: true });
      });
    });
    if (toCreate.length > 0) await base44.entities.AvailabilitySlots.bulkCreate(toCreate);

    // Save timezone to profile
    if (profile?.id) await base44.entities.TeacherProfile.update(profile.id, { timezone: tz });

    setSaving(false);
    setSaveStatus("success");
    setTimeout(() => setSaveStatus(null), 3000);
  };

  // ── Blocked dates ─────────────────────────────────────────────────────────
  const addBlockedDate = async () => {
    if (!newBlockDate) return;
    const me = await base44.auth.me();
    const created = await base44.entities.BlockedDate.create({ teacher_email: me.email, date: newBlockDate, reason: newBlockReason });
    setBlockedDates(prev => [...prev, created]);
    setNewBlockReason("");
  };

  const removeBlockedDate = async (id) => {
    await base44.entities.BlockedDate.delete(id);
    setBlockedDates(prev => prev.filter(b => b.id !== id));
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-6 h-6 animate-spin text-[#1a1b4b]" />
    </div>
  );

  const VISIBLE_START = 0;  // 00:00
  const VISIBLE_END = 24;   // 24:00
  const VISIBLE_HOURS = Array.from({ length: VISIBLE_END - VISIBLE_START }, (_, i) => VISIBLE_START + i);
  const GRID_HEIGHT = 1440; // 1px per minute = full 24h
  const TOTAL_MINS = (VISIBLE_END - VISIBLE_START) * 60;

  const toGridPct = (hhmm) => {
    const min = toMin(hhmm) - VISIBLE_START * 60;
    return Math.max(0, Math.min(100, (min / TOTAL_MINS) * 100));
  };

  const toGridHeight = (startHHMM, endHHMM) =>
    Math.max(1, ((toMin(endHHMM) - toMin(startHHMM)) / TOTAL_MINS) * 100);

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-[#1a1b4b]">Manage Schedule</h1>
          <p className="text-gray-400 mt-1">Drag to set your weekly availability</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-gray-100 px-3 py-2 rounded-xl">
            <Globe className="w-4 h-4 text-gray-500" />
            <select value={tz} onChange={e => setTz(e.target.value)}
              className="bg-transparent text-sm text-gray-700 outline-none max-w-[180px]">
              {[
                "UTC", "America/New_York", "America/Chicago", "America/Denver",
                "America/Los_Angeles", "Europe/London", "Europe/Paris", "Europe/Berlin",
                "Europe/Moscow", "Asia/Dubai", "Asia/Kolkata", "Asia/Singapore",
                "Asia/Tokyo", "Australia/Sydney", "Pacific/Auckland"
              ].map(z => <option key={z} value={z}>{z.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          {view === "weekly" && (
            <Button variant="outline" onClick={clearAll} className="rounded-xl gap-2 text-red-500 border-red-200 hover:bg-red-50">
              <X className="w-4 h-4" /> Clear All
            </Button>
          )}
          <Button onClick={save} disabled={saving} className="bg-[#f97066] hover:bg-[#e8605a] rounded-xl gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Schedule
          </Button>
        </div>
      </div>

      {/* Save status */}
      {saveStatus === "success" && (
        <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-emerald-700 text-sm">
          <CheckCircle className="w-4 h-4" /> Schedule saved successfully!
        </div>
      )}
      {saveStatus?.errors && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          <div className="flex items-center gap-2 mb-1 font-medium"><AlertCircle className="w-4 h-4" /> Fix overlapping slots before saving:</div>
          {saveStatus.errors.map((e, i) => <div key={i} className="ml-6">• {e}</div>)}
        </div>
      )}

      {/* Toggle */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 w-fit">
        {[["weekly", "Weekly Schedule"], ["exceptions", "Calendar Exceptions"]].map(([id, label]) => (
          <button key={id} onClick={() => setView(id)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${view === id ? 'bg-white text-[#1a1b4b] shadow-sm' : 'text-gray-500 hover:text-[#1a1b4b]'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── WEEKLY VIEW ── */}
      {view === "weekly" && (
        <div>
          <p className="text-xs text-gray-400 mb-4">
            Click & drag on any day column to add an availability slot. Times shown in <strong>{tz.replace(/_/g, ' ')}</strong> · stored in UTC.
          </p>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Sticky day headers */}
            <div className="sticky top-0 z-20 bg-white grid border-b border-gray-100" style={{ gridTemplateColumns: "52px repeat(7, 1fr)" }}>
              <div className="p-3" />
              {DAYS.map(d => (
                <div key={d} className="p-3 text-center border-l border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{d}</p>
                </div>
              ))}
            </div>

            {/* Scrollable grid body */}
            <div className="overflow-y-auto" style={{ maxHeight: "600px" }}>
              <div className="grid" style={{ gridTemplateColumns: "52px repeat(7, 1fr)" }}>
                {/* Time labels */}
                <div className="relative" style={{ height: GRID_HEIGHT }}>
                  {VISIBLE_HOURS.map(h => (
                    <div key={h} className="absolute w-full pr-2 text-right" style={{ top: `${((h - VISIBLE_START) / (VISIBLE_END - VISIBLE_START)) * 100}%` }}>
                      <span className="text-xs text-gray-300 -mt-2 block">{String(h).padStart(2, "0")}:00</span>
                    </div>
                  ))}
                </div>

                {/* Day columns */}
                {DAYS.map((d, dayIndex) => {
                  const daySlots = weeklySlots[dayIndex] || [];
                  const isPreviewDay = dragPreview?.day === dayIndex;
                  return (
                    <div key={d} className="relative border-l border-gray-100 cursor-crosshair select-none"
                      style={{ height: GRID_HEIGHT }}
                      ref={el => gridRefs.current[dayIndex] = el}
                      onMouseDown={e => handleMouseDown(e, dayIndex)}>
                      {/* Hour lines */}
                      {VISIBLE_HOURS.map(h => (
                        <div key={h} className="absolute w-full border-t border-gray-50"
                          style={{ top: `${((h - VISIBLE_START) / (VISIBLE_END - VISIBLE_START)) * 100}%` }} />
                      ))}
                      {/* Drag preview */}
                      {isPreviewDay && (
                        <div className="absolute left-1 right-1 bg-blue-400/30 border-2 border-blue-400 rounded-md z-20 pointer-events-none"
                          style={{ top: `${dragPreview.topPct}%`, height: `${dragPreview.heightPct}%` }} />
                      )}
                      {/* Slots */}
                      {daySlots.map((slot, i) => {
                        const displayStart = utcToLocal(slot.start_time, tz);
                        const displayEnd = utcToLocal(slot.end_time, tz);
                        const topPct = toGridPct(displayStart);
                        const heightPct = toGridHeight(displayStart, displayEnd);
                        return (
                          <div key={i}
                            onClick={(e) => { e.stopPropagation(); removeSlot(dayIndex, slot); }}
                            className="absolute left-1 right-1 bg-[#1a1b4b] hover:bg-red-500 rounded-md text-white text-xs px-1.5 py-1 cursor-pointer select-none flex items-center justify-between gap-0.5 z-10 overflow-hidden group transition-colors"
                            style={{ top: `${topPct}%`, height: `${Math.max(heightPct, 2)}%` }}
                            title="Click to remove">
                            <span className="truncate font-medium leading-tight text-[10px]">{displayStart}–{displayEnd}</span>
                            <X className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-300 mt-3 text-center">
            Drag on a column to create continuous availability blocks · Click a slot to remove it
          </p>
        </div>
      )}

      {/* ── EXCEPTIONS VIEW ── */}
      {view === "exceptions" && (
        <div className="max-w-2xl space-y-5">
          <p className="text-sm text-gray-500">Block specific dates (holidays, vacations) — these override your weekly schedule.</p>

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
                <p className="text-gray-400 text-sm">No blocked dates. Add holidays or days off above.</p>
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
                  <Button variant="ghost" size="icon" onClick={() => removeBlockedDate(b.id)} className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl">
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