import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import {
  ChevronLeft, ChevronRight, Clock, Loader2, CalendarDays,
  CheckCircle2, AlertCircle, ArrowLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, addDays, startOfWeek, isSameDay, parseISO, isAfter, addMonths } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

// ── helpers ──────────────────────────────────────────────────────────────────
const toMin = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
const fromMin = (min) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

/**
 * Generate valid bookable slots from a list of AvailabilitySlots records
 * for a specific date and duration.
 *
 * Rules:
 *  50-min lessons → start on the hour only (0 min)
 *  25-min lessons → start on hour or half-hour (0 or 30 min)
 */
const generateBookableSlots = (availSlots, date, duration, existingBookings) => {
  const step = duration === 50 ? 60 : 30;
  const dow = date.getDay(); // 0=Sun…6=Sat
  const dateStr = format(date, "yyyy-MM-dd");

  // Collect all availability windows for this day-of-week (recurring)
  const windows = availSlots.filter(s => s.day_of_week === dow);

  const bookedRanges = existingBookings
    .filter(b => b.date === dateStr)
    .map(b => ({ start: toMin(b.start_time), end: toMin(b.end_time) }));

  const slots = [];
  for (const win of windows) {
    const winStart = toMin(win.start_time);
    const winEnd = toMin(win.end_time);

    // Find first valid snap point >= winStart
    let cursor = Math.ceil(winStart / step) * step;

    while (cursor + duration <= winEnd) {
      const slotStart = cursor;
      const slotEnd = cursor + duration;

      // Check against existing bookings
      const overlaps = bookedRanges.some(b => slotStart < b.end && slotEnd > b.start);

      slots.push({
        start_time: fromMin(slotStart),
        end_time: fromMin(slotEnd),
        date: dateStr,
        session_duration: duration,
        availability_slot_id: win.id,
        is_booked: overlaps,
      });
      cursor += step;
    }
  }
  return slots.sort((a, b) => a.start_time.localeCompare(b.start_time));
};

// ── component ─────────────────────────────────────────────────────────────────
export default function BookLessons() {
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);
  const teacherId = params.get("teacherId");
  const isTrial = params.get("trial") === "true";
  const presetDuration = params.get("duration") ? parseInt(params.get("duration")) : null;

  const [teacher, setTeacher] = useState(null);
  const [profile, setProfile] = useState(null);
  const [availSlots, setAvailSlots] = useState([]);   // AvailabilitySlots records
  const [bookings, setBookings] = useState([]);         // existing Bookings for teacher
  const [selectedDate, setSelectedDate] = useState(null);
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [booked, setBooked] = useState(null);
  const [error, setError] = useState(null);
  const [duration, setDuration] = useState(presetDuration || (isTrial ? 25 : 25));

  useEffect(() => { loadData(); }, [teacherId]);

  const loadData = async () => {
    if (!teacherId) { navigate(createPageUrl("BrowseTeachers")); return; }

    const me = await base44.auth.me();
    const [profiles, teacherProfiles] = await Promise.all([
      base44.entities.StudentProfile.filter({ user_email: me.email }),
      base44.entities.TeacherProfile.filter({ id: teacherId }),
    ]);

    if (profiles.length === 0) { navigate(createPageUrl("PlacementTest")); return; }
    if (teacherProfiles.length === 0) { navigate(createPageUrl("BrowseTeachers")); return; }

    setProfile(profiles[0]);
    setTeacher(teacherProfiles[0]);

    const teacherEmail = teacherProfiles[0].user_email;

    // Load this teacher's recurring availability slots + their existing bookings
    const [slots, existingBookings] = await Promise.all([
      base44.entities.AvailabilitySlots.filter({ teacher_email: teacherEmail }),
      base44.entities.Booking.filter({ status: "scheduled" }),
    ]);

    // Only keep bookings that are for this teacher (matched via availability_id)
    const slotIds = new Set(slots.map(s => s.id));
    const teacherBookings = existingBookings.filter(b => slotIds.has(b.availability_id));

    setAvailSlots(slots);
    setBookings(teacherBookings);
    setLoading(false);
  };

  // Days that have at least one valid slot for the chosen duration
  const daysWithSlots = new Set();
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  weekDays.forEach(d => {
    if (generateBookableSlots(availSlots, d, duration, bookings).length > 0) {
      daysWithSlots.add(format(d, "yyyy-MM-dd"));
    }
  });

  const getSlotsForDate = (date) =>
    generateBookableSlots(availSlots, date, duration, bookings);

  const handleBook = async (slot) => {
    if (!isTrial && profile.lessons_remaining <= 0) {
      navigate(createPageUrl("Packages"));
      return;
    }
    setBooking(true);
    setError(null);

    const me = await base44.auth.me();

    // Call backend validation function
    const res = await base44.functions.invoke("validateAndCreateBooking", {
      student_email: me.email,
      student_name: profile.full_name,
      student_level: profile.english_level,
      teacher_id: teacherId,
      teacher_email: teacher.user_email,
      availability_slot_id: slot.availability_slot_id,
      date: slot.date,
      start_time: slot.start_time,
      end_time: slot.end_time,
      session_duration: slot.session_duration,
      is_trial: isTrial,
    });

    if (res.data?.error) {
      setError(res.data.error);
      setBooking(false);
      return;
    }

    // Update student lessons_remaining (not for trial)
    if (!isTrial) {
      await base44.entities.StudentProfile.update(profile.id, {
        lessons_remaining: profile.lessons_remaining - 1,
      });
      setProfile(prev => ({ ...prev, lessons_remaining: prev.lessons_remaining - 1 }));
    } else {
      // Record trial usage
      await base44.entities.TrialUsage.create({
        student_email: me.email,
        teacher_email: teacher.user_email,
        booking_id: res.data?.booking_id,
        used_at: slot.date,
      });
    }

    // Add to local bookings to refresh grid immediately
    setBookings(prev => [...prev, {
      date: slot.date,
      start_time: slot.start_time,
      end_time: slot.end_time,
      availability_id: slot.availability_slot_id,
    }]);

    setBooked(slot);
    setBooking(false);
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-6 h-6 animate-spin text-[#1a1b4b]" />
    </div>
  );

  const today = new Date();
  const minBookableDate = addDays(today, 1); // 24h advance minimum
  const maxBookableDate = addMonths(today, 2); // 2 months max

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate(createPageUrl(`TeacherProfile?id=${teacherId}`))}
          className="flex items-center gap-2 text-gray-400 hover:text-[#1a1b4b] mb-4 transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Back to {teacher?.full_name}
        </button>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#1a1b4b]">
              {isTrial ? "Book Free Trial" : "Book a Lesson"}
            </h1>
            <p className="text-gray-400 mt-1 text-sm">
              with {teacher?.full_name}
              {!isTrial && ` · ${profile.lessons_remaining} lesson${profile.lessons_remaining !== 1 ? "s" : ""} remaining`}
            </p>
          </div>

          {/* Duration selector (hidden for trial) */}
          {!isTrial && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 mr-1">Duration:</span>
              {[25, 50].map(d => (
                <Badge
                  key={d}
                  onClick={() => { setDuration(d); setSelectedDate(null); }}
                  className={`cursor-pointer rounded-full px-4 py-1.5 text-sm ${
                    duration === d
                      ? "bg-[#1a1b4b] text-white"
                      : "bg-white border border-gray-200 text-gray-600 hover:border-[#1a1b4b]/40"
                  }`}
                >
                  {d} min
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Snap rule info banner */}
      <div className="mb-5 px-4 py-3 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-2 text-sm text-blue-700">
        <Clock className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <span>
          {duration === 50
            ? "50-min lessons start on the hour only (e.g. 9:00, 10:00). "
            : "25-min lessons start on the hour or half-hour (e.g. 9:00, 9:30). "}
          Bookings require at least 24 hours notice and can be made up to 2 months in advance.
        </span>
      </div>

      {/* Success toast */}
      <AnimatePresence>
        {booked && (
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="mb-5 bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3"
          >
            <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-emerald-800">
                Lesson booked for {format(parseISO(booked.date), "MMMM d")} at {booked.start_time}!
              </p>
              <button className="text-xs text-emerald-600 underline mt-0.5" onClick={() => setBooked(null)}>
                Dismiss
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error toast */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="mb-5 bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3"
          >
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-800">{error}</p>
              <button className="text-xs text-red-500 underline mt-0.5" onClick={() => setError(null)}>
                Dismiss
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Week navigation */}
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="ghost" size="sm"
          onClick={() => setWeekStart(addDays(weekStart, -7))}
          disabled={!isAfter(weekStart, startOfWeek(today, { weekStartsOn: 1 }))}
          className="rounded-full"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="text-sm font-medium text-gray-500">
          {format(weekStart, "MMM d")} — {format(addDays(weekStart, 6), "MMM d, yyyy")}
        </span>
        <Button
          variant="ghost" size="sm"
          onClick={() => setWeekStart(addDays(weekStart, 7))}
          disabled={isAfter(addDays(weekStart, 7), maxBookableDate)}
          className="rounded-full"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-2 mb-6">
        {weekDays.map((day) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const hasSlots = daysWithSlots.has(dateStr);
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const isPast = day < minBookableDate;
          const isTooFar = isAfter(day, maxBookableDate);
          const isToday = isSameDay(day, today);

          return (
            <button
              key={day.toString()}
              onClick={() => !isPast && !isTooFar && hasSlots && setSelectedDate(day)}
              disabled={isPast || isTooFar || !hasSlots}
              className={`
                p-3 rounded-2xl text-center transition-all border
                ${isPast || isTooFar || !hasSlots ? "opacity-35 cursor-not-allowed border-transparent bg-gray-50" : "cursor-pointer"}
                ${isSelected
                  ? "bg-[#1a1b4b] text-white border-[#1a1b4b]"
                  : isToday && hasSlots
                    ? "border-[#f97066] bg-white"
                    : "border-gray-100 bg-white hover:border-[#1a1b4b]/20"}
              `}
            >
              <p className={`text-xs font-medium ${isSelected ? "text-white/60" : "text-gray-400"}`}>
                {format(day, "EEE")}
              </p>
              <p className={`text-lg font-bold ${isSelected ? "text-white" : "text-[#1a1b4b]"}`}>
                {format(day, "d")}
              </p>
              {hasSlots && (
                <div className={`mt-1 w-1.5 h-1.5 rounded-full mx-auto ${isSelected ? "bg-[#f97066]" : "bg-emerald-400"}`} />
              )}
            </button>
          );
        })}
      </div>

      {/* Slots panel */}
      {selectedDate ? (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h3 className="text-lg font-semibold text-[#1a1b4b] mb-4">
            {format(selectedDate, "EEEE, MMMM d")}
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {getSlotsForDate(selectedDate).map((slot) => {
              const isAlreadyBooked = slot.is_booked;
              return (
                <div
                  key={slot.start_time}
                  className={`rounded-2xl border p-4 transition-all ${
                    isAlreadyBooked
                      ? "bg-gray-50 border-gray-100 opacity-50"
                      : "bg-white border-gray-100 hover:shadow-md hover:border-[#1a1b4b]/20"
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <Clock className={`w-3.5 h-3.5 ${isAlreadyBooked ? "text-gray-300" : "text-gray-400"}`} />
                    <span className={`text-sm font-bold ${isAlreadyBooked ? "text-gray-400" : "text-[#1a1b4b]"}`}>
                      {slot.start_time}
                    </span>
                  </div>
                  <p className={`text-xs mb-3 ${isAlreadyBooked ? "text-gray-300" : "text-gray-400"}`}>
                    until {slot.end_time}
                  </p>
                  {isAlreadyBooked ? (
                    <span className="text-xs text-gray-400 font-medium">Already booked</span>
                  ) : (
                    <Button
                      onClick={() => handleBook(slot)}
                      disabled={booking || (!isTrial && profile.lessons_remaining <= 0)}
                      size="sm"
                      className="w-full bg-[#1a1b4b] hover:bg-[#2a2b5b] rounded-xl text-xs h-8"
                    >
                      {booking ? <Loader2 className="w-3 h-3 animate-spin" /> :
                        !isTrial && profile.lessons_remaining <= 0 ? "Buy Lessons" :
                        isTrial ? "Book Trial" : "Book"}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>
      ) : (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-12 text-center">
            <CalendarDays className="w-12 h-12 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-400">Select a date above to see available times</p>
            <p className="text-xs text-gray-300 mt-2">Green dot = this teacher has availability</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}