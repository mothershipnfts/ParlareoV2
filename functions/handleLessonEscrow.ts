import { createClientFromRequest } from "npm:@base44/sdk@0.8.20";

const TEACHER_SHARE = 0.9;
const ADMIN_SHARE = 0.1;

// Get lesson price from booking session_duration and teacher profile
const getLessonPrice = (teacher, sessionDuration) => {
  return sessionDuration === 25
    ? (teacher.lesson_price_25 || 20)
    : (teacher.lesson_price_50 || 35);
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { action, booking_id, teacher_email } = body;

    // Validate action
    if (!["complete", "cancel_early", "cancel_late_or_noshow"].includes(action)) {
      return Response.json({ error: "Invalid action" }, { status: 400 });
    }

    // Load booking
    const bookings = await base44.asServiceRole.entities.Booking.filter({ id: booking_id });
    if (bookings.length === 0) return Response.json({ error: "Booking not found" }, { status: 404 });
    const booking = bookings[0];

    // Load teacher profile
    const teachers = await base44.asServiceRole.entities.TeacherProfile.filter({ user_email: teacher_email });
    if (teachers.length === 0) return Response.json({ error: "Teacher not found" }, { status: 404 });
    const teacher = teachers[0];

    const lessonPrice = getLessonPrice(teacher, booking.session_duration);

    // Load teacher wallet (scoped to this teacher via created_by)
    const wallets = await base44.asServiceRole.entities.TeacherWallet.filter({});
    // Find wallet owned by this teacher
    let wallet = wallets.find(w => w.created_by === teacher_email);

    if (!wallet) {
      wallet = await base44.asServiceRole.entities.TeacherWallet.create({
        balance: 0, total_earned: 0, total_withdrawn: 0, pending_balance: 0,
      });
    }

    if (action === "complete") {
      // ── Release escrow: 90/10 split ──────────────────────────────────────
      const teacherEarns = parseFloat((lessonPrice * TEACHER_SHARE).toFixed(2));
      const adminEarns = parseFloat((lessonPrice * ADMIN_SHARE).toFixed(2));

      await base44.asServiceRole.entities.TeacherWallet.update(wallet.id, {
        balance: (wallet.balance || 0) + teacherEarns,
        total_earned: (wallet.total_earned || 0) + teacherEarns,
        pending_balance: Math.max(0, (wallet.pending_balance || 0) - lessonPrice),
      });

      await base44.asServiceRole.entities.WalletTransaction.create({
        type: "payment_received",
        amount: teacherEarns,
        currency: "USD",
        student_email: booking.student_email,
        student_name: booking.student_name,
        status: "completed",
        notes: `Lesson completed (90% of $${lessonPrice}). Admin kept $${adminEarns}.`,
      });

      await base44.asServiceRole.entities.Booking.update(booking_id, {
        status: "completed",
        change_timestamp: new Date().toISOString(),
      });

      return Response.json({ success: true, teacher_earns: teacherEarns, admin_earns: adminEarns });
    }

    if (action === "cancel_early") {
      // ── Student cancels >12h before: refund lesson credit ────────────────
      // Release from pending (no split), return credit to student
      await base44.asServiceRole.entities.TeacherWallet.update(wallet.id, {
        pending_balance: Math.max(0, (wallet.pending_balance || 0) - lessonPrice),
      });

      // Restore student's lesson credit
      const studentProfiles = await base44.asServiceRole.entities.StudentProfile.filter({
        user_email: booking.student_email,
      });
      if (studentProfiles.length > 0) {
        const sp = studentProfiles[0];
        await base44.asServiceRole.entities.StudentProfile.update(sp.id, {
          lessons_remaining: (sp.lessons_remaining || 0) + 1,
        });
      }

      await base44.asServiceRole.entities.Booking.update(booking_id, {
        status: "canceled",
        change_timestamp: new Date().toISOString(),
      });

      await base44.asServiceRole.entities.WalletTransaction.create({
        type: "refund",
        amount: lessonPrice,
        currency: "USD",
        student_email: booking.student_email,
        student_name: booking.student_name,
        status: "completed",
        notes: "Lesson cancelled >12h before start. Credit returned to student.",
      });

      return Response.json({ success: true, action: "credit_returned" });
    }

    if (action === "cancel_late_or_noshow") {
      // ── Late cancel or no-show: teacher keeps 90%, same as completed ─────
      const teacherEarns = parseFloat((lessonPrice * TEACHER_SHARE).toFixed(2));
      const adminEarns = parseFloat((lessonPrice * ADMIN_SHARE).toFixed(2));

      await base44.asServiceRole.entities.TeacherWallet.update(wallet.id, {
        balance: (wallet.balance || 0) + teacherEarns,
        total_earned: (wallet.total_earned || 0) + teacherEarns,
        pending_balance: Math.max(0, (wallet.pending_balance || 0) - lessonPrice),
      });

      await base44.asServiceRole.entities.Booking.update(booking_id, {
        status: "canceled",
        change_timestamp: new Date().toISOString(),
        notes: (booking.notes || "") + " [Charged: late cancel / no-show]",
      });

      await base44.asServiceRole.entities.WalletTransaction.create({
        type: "payment_received",
        amount: teacherEarns,
        currency: "USD",
        student_email: booking.student_email,
        student_name: booking.student_name,
        status: "completed",
        notes: `Late cancel/no-show — teacher charged 90% ($${teacherEarns}). Admin kept $${adminEarns}.`,
      });

      return Response.json({ success: true, action: "charged", teacher_earns: teacherEarns });
    }

  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});