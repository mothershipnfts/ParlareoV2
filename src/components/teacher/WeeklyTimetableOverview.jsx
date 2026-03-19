import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { format, startOfWeek, addDays, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_INDICES = [1, 2, 3, 4, 5, 6, 0]; // 1=Mon, 0=Sun (ISO standard)
const VISIBLE_START = 8; // 8 AM
const VISIBLE_END = 22; // 10 PM
const TOTAL_HOURS = VISIBLE_END - VISIBLE_START;
const GRID_HEIGHT = 840; // pixels (matches Manage Schedule)

const timeToMinutes = (timeStr) => {
  const parts = timeStr.split(':').map(Number);
  return parts[0] * 60 + parts[1];
};

const getGridPosition = (timeStr) => {
  const minutes = timeToMinutes(timeStr);
  const startMinutes = VISIBLE_START * 60;
  const totalMinutes = TOTAL_HOURS * 60;
  return Math.max(0, Math.min(100, ((minutes - startMinutes) / totalMinutes) * 100));
};

const getGridHeight = (startTimeStr, endTimeStr) => {
  const startMin = timeToMinutes(startTimeStr);
  const endMin = timeToMinutes(endTimeStr);
  const totalMinutes = TOTAL_HOURS * 60;
  return Math.max(1, ((endMin - startMin) / totalMinutes) * 100);
};

export default function WeeklyTimetableOverview({ teacherEmail }) {
  const [weekStart, setWeekStart] = useState(() => {
    const today = new Date();
    return startOfWeek(today, { weekStartsOn: 1 }); // Start on Monday
  });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWeeklyData();
  }, [weekStart]);

  const loadWeeklyData = async () => {
    setLoading(true);
    try {
      const response = await base44.functions.invoke('getTeacherWeeklyOverview', {
        teacher_email: teacherEmail,
        week_start_date: format(weekStart, 'yyyy-MM-dd'),
      });
      setData(response.data);
    } catch (error) {
      console.error('Failed to load weekly overview:', error);
    }
    setLoading(false);
  };

  const handlePreviousWeek = () => {
    setWeekStart(prev => addDays(prev, -7));
  };

  const handleNextWeek = () => {
    setWeekStart(prev => addDays(prev, 7));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-6 h-6 animate-spin text-[#1a1b4b]" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 text-center text-gray-400">
        <p>Unable to load weekly overview</p>
      </div>
    );
  }

  // Create availability map: day_of_week -> availability block
  const availabilityMap = {};
  data.availability.forEach(slot => {
    availabilityMap[slot.day_of_week] = slot;
  });

  // Create bookings map: date -> array of bookings
  const bookingsMap = {};
  data.bookings.forEach(booking => {
    if (!bookingsMap[booking.date]) bookingsMap[booking.date] = [];
    bookingsMap[booking.date].push(booking);
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-[#1a1b4b]">Weekly Timetable Overview</h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handlePreviousWeek}
            className="rounded-lg"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="text-sm font-medium text-gray-600 min-w-[200px] text-center">
            {format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d, yyyy')}
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={handleNextWeek}
            className="rounded-lg"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Sticky day headers */}
        <div className="sticky top-0 z-20 bg-white grid border-b border-gray-100" style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}>
          <div className="p-3" />
          {DAYS.map((day, idx) => {
            const dayDate = addDays(weekStart, idx);
            return (
              <div key={day} className="p-3 text-center border-l border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{day.slice(0, 3)}</p>
                <p className="text-sm font-bold text-[#1a1b4b] mt-1">{format(dayDate, 'd')}</p>
              </div>
            );
          })}
        </div>

        {/* Scrollable grid body */}
        <div className="overflow-y-auto" style={{ maxHeight: '600px' }}>
          <div className="grid" style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}>
            {/* Time labels */}
            <div className="relative bg-gray-50" style={{ height: GRID_HEIGHT }}>
              {Array.from({ length: TOTAL_HOURS }, (_, i) => {
                const hour = VISIBLE_START + i;
                return (
                  <div key={hour} className="absolute w-full pr-2 text-right" style={{ top: `${((i) / TOTAL_HOURS) * 100}%` }}>
                    <span className="text-xs text-gray-400">{String(hour).padStart(2, '0')}:00</span>
                  </div>
                );
              })}
            </div>

            {/* Day columns */}
            {DAYS.map((day, dayIdx) => {
              const dayOfWeek = DAY_INDICES[dayIdx];
              const currentDate = addDays(weekStart, dayIdx);
              const dateStr = format(currentDate, 'yyyy-MM-dd');
              const availability = availabilityMap[dayOfWeek];
              const dayBookings = bookingsMap[dateStr] || [];

              return (
                <div
                  key={day}
                  className="relative border-l border-gray-100"
                  style={{ height: GRID_HEIGHT }}
                >
                  {/* Hour lines */}
                  {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                    <div
                      key={i}
                      className="absolute w-full border-t border-gray-50"
                      style={{ top: `${((i) / TOTAL_HOURS) * 100}%` }}
                    />
                  ))}

                  {/* Availability block (background) */}
                  {availability && (
                    <div
                      className="absolute left-1 right-1 bg-emerald-100 rounded-md opacity-60"
                      style={{
                        top: `${getGridPosition(availability.start_time)}%`,
                        height: `${getGridHeight(availability.start_time, availability.end_time)}%`,
                      }}
                    />
                  )}

                  {/* Bookings (foreground overlays) */}
                  {dayBookings.map((booking, idx) => (
                    <div
                      key={idx}
                      className="absolute left-1 right-1 bg-[#1a1b4b] rounded-md text-white text-xs px-2 py-1 flex flex-col items-center justify-center z-10 overflow-hidden"
                      style={{
                        top: `${getGridPosition(booking.start_time)}%`,
                        height: `${getGridHeight(booking.start_time, booking.end_time)}%`,
                        minHeight: '24px',
                      }}
                      title={`${booking.student_name} • ${booking.start_time.slice(0, 5)}-${booking.end_time.slice(0, 5)}`}
                    >
                      <span className="font-semibold truncate">{booking.student_name}</span>
                      <span className="text-[10px] text-white/80">
                        {booking.start_time.slice(0, 5)} – {booking.end_time.slice(0, 5)}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-400 text-center">
        Green = Available · Dark blue = Booked lesson
      </p>
    </div>
  );
}