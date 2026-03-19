import { createClientFromRequest } from "npm:@base44/sdk@0.8.20";

const toMin = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

const isValidSnap = (start_time, duration) => {
  const [, mm] = start_time.split(":").map(Number);
  if (duration === 50) return mm === 0;
  if (duration === 25) return mm === 0 || mm === 30;
  return false;
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const {
      student_email, student_name, student_level,
      teacher_id, teacher_email,
      availability_slot_id, date, start_time, end_time,
      session_duration, is_trial,
    } = body;

    // 1. Snap validation
    if (!isValidSnap(start_time, session_duration)) {
      return Response.json({
        error: `Invalid lesson time. ${session_duration === 50
          ? "50-min lessons must start on the hour (e.g. 9:00)."
          : "25-min lessons must start on the hour or half-hour (e.g. 9:00, 9:30)."}`
      });
    }

    // 2. Verify teacher exists
    const teachers = await base44.asServiceRole.entities.TeacherProfile.filter({ id: teacher_id });
    if (teachers.length === 0 || teachers[0].user_email !== teacher_email) {
      return Response.json({ error: "Teacher not found." });
    }
    const teacher = teachers[0];

    // 3. Verify availability slot belongs to teacher
    const slots = await base44.asServiceRole.entities.AvailabilitySlots.filter({ id: availability_slot_id });
    if (slots.length === 0 || slots[0].teacher_email !== teacher_email) {
      return Response.json({ error: "Invalid availability slot." });
    }
    const slot = slots[0];

    // 4. Verify time falls inside the window
    const reqStart = toMin(start_time);
    const reqEnd = toMin(end_time);
    const winStart = toMin(slot.start_time);
    const winEnd = toMin(slot.end_time);
    if (reqStart < winStart || reqEnd > winEnd) {
      return Response.json({ error: "Lesson time is outside availability window." });
    }

    // 5. Check for collision with existing bookings
    const existingBookings = await base44.asServiceRole.entities.Booking.filter({
      date, teacher_email, status: "scheduled",
    });
    const collision = existingBookings.some(
      b => reqStart < toMin(b.end_time) && reqEnd > toMin(b.start_time)
    );
    if (collision) {
      return Response.json({ error: "This time slot has already been booked. Please choose another." });
    }

    // 6. Trial check
    if (is_trial) {
      const trials = await base44.asServiceRole.entities.TrialUsage.filter({ student_email, teacher_email });
      if (trials.length > 0) {
        return Response.json({ error: "You have already used your free trial with this teacher." });
      }
    } else {
      // 6b. Check subscription has enough EUR balance
      const subs = await base44.asServiceRole.entities.StudentTeacherSubscription.filter({
        student_email, teacher_email, subscription_status: "active"
      });

      const lessonPrice = session_duration === 50
        ? (subs[0]?.locked_price_50 || teacher.lesson_price_50 || 35)
        : (subs[0]?.locked_price_25 || teacher.lesson_price_25 || 20);

      const activeSub = subs.find(s => (s.balance_eur || 0) >= lessonPrice);
      if (!activeSub) {
        const anyBalance = subs.reduce((sum, s) => sum + (s.balance_eur || 0), 0);
        return Response.json({
          error: anyBalance > 0
            ? `Insufficient balance. You have €${anyBalance.toFixed(2)} but this lesson costs €${lessonPrice.toFixed(2)}. Please top up.`
            : `You have no lesson balance with ${teacher.full_name}. Purchase a package from their profile first.`
        });
      }
    }

    // 7. Create booking
    const booking = await base44.asServiceRole.entities.Booking.create({
      student_email, student_name, student_level, teacher_email,
      availability_id: availability_slot_id,
      date, start_time, end_time, session_duration,
      status: "scheduled",
      payment_status: is_trial ? "unpaid" : "held",
      change_timestamp: new Date().toISOString(),
    });

    // 8. For non-trial: hold EUR amount from subscription balance
    if (!is_trial) {
      const subs = await base44.asServiceRole.entities.StudentTeacherSubscription.filter({
        student_email, teacher_email, subscription_status: "active"
      });

      const lessonPrice = session_duration === 50
        ? (subs[0]?.locked_price_50 || teacher.lesson_price_50 || 35)
        : (subs[0]?.locked_price_25 || teacher.lesson_price_25 || 20);

      const activeSub = subs.find(s => (s.balance_eur || 0) >= lessonPrice);

      // Move EUR from available balance to held
      await base44.asServiceRole.entities.StudentTeacherSubscription.update(activeSub.id, {
        balance_eur: parseFloat(((activeSub.balance_eur || 0) - lessonPrice).toFixed(2)),
        held_eur: parseFloat(((activeSub.held_eur || 0) + lessonPrice).toFixed(2)),
      });

      // Record lesson payment as held (in escrow)
      await base44.asServiceRole.entities.LessonPayment.create({
        booking_id: booking.id,
        student_email, teacher_email,
        amount: lessonPrice,
        currency: "EUR",
        status: "held",
        lesson_date: date,
        session_duration,
      });
    }

    return Response.json({ success: true, booking_id: booking.id });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});