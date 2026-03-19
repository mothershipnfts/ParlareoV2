import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { booking_id, reason } = await req.json();
    if (!booking_id) return Response.json({ error: 'Missing booking_id' }, { status: 400 });

    // Get the booking
    const bookings = await base44.asServiceRole.entities.Booking.filter({ id: booking_id });
    if (bookings.length === 0) return Response.json({ error: 'Booking not found' }, { status: 404 });
    const booking = bookings[0];

    // Only student can cancel via this endpoint
    if (user.email !== booking.student_email) {
      return Response.json({ error: 'Forbidden: Only the student can cancel their lesson' }, { status: 403 });
    }

    if (booking.status === 'completed') {
      return Response.json({ error: 'Cannot cancel a completed lesson' }, { status: 400 });
    }
    if (booking.status === 'canceled' || booking.status === 'cancelled') {
      return Response.json({ error: 'Lesson is already cancelled' }, { status: 400 });
    }

    // Determine if within 12-hour cutoff
    const lessonStart = new Date(`${booking.date}T${booking.start_time}`);
    const now = new Date();
    const hoursUntilLesson = (lessonStart - now) / (1000 * 60 * 60);
    const isWithinCutoff = hoursUntilLesson < 12;

    // Get held payment record
    const payments = await base44.asServiceRole.entities.LessonPayment.filter({
      booking_id, status: 'held'
    });
    const payment = payments.length > 0 ? payments[0] : null;

    // Update booking to cancelled
    await base44.asServiceRole.entities.Booking.update(booking_id, {
      status: 'canceled',
      change_timestamp: now.toISOString(),
      notes: reason || 'Cancelled by student',
    });

    if (payment) {
      if (!isWithinCutoff) {
        // ✅ REFUND: More than 12 hours notice — return EUR to available balance
        await base44.asServiceRole.entities.LessonPayment.update(payment.id, {
          status: 'refunded',
          cancellation_reason: reason || 'Cancelled by student',
          cancelled_at: now.toISOString(),
        });

        // Restore held EUR back to available balance on subscription
        const subs = await base44.asServiceRole.entities.StudentTeacherSubscription.filter({
          student_email: booking.student_email,
          teacher_email: booking.teacher_email,
        });
        if (subs.length > 0) {
          const sub = subs[0];
          await base44.asServiceRole.entities.StudentTeacherSubscription.update(sub.id, {
            balance_eur: parseFloat(((sub.balance_eur || 0) + payment.amount).toFixed(2)),
            held_eur: parseFloat(Math.max(0, (sub.held_eur || 0) - payment.amount).toFixed(2)),
          });
        }

        return Response.json({
          success: true,
          outcome: 'refunded',
          amount_refunded: payment.amount,
          message: `€${payment.amount.toFixed(2)} has been returned to your balance.`
        });

      } else {
        // ❌ CHARGED: Less than 12 hours notice — funds go to teacher
        await base44.asServiceRole.entities.LessonPayment.update(payment.id, {
          status: 'charged_late_cancel',
          cancellation_reason: reason || 'Late cancellation',
          cancelled_at: now.toISOString(),
        });

        // Deduct from held balance (funds are forfeited, not refunded)
        const subs = await base44.asServiceRole.entities.StudentTeacherSubscription.filter({
          student_email: booking.student_email,
          teacher_email: booking.teacher_email,
        });
        if (subs.length > 0) {
          const sub = subs[0];
          await base44.asServiceRole.entities.StudentTeacherSubscription.update(sub.id, {
            held_eur: parseFloat(Math.max(0, (sub.held_eur || 0) - payment.amount).toFixed(2)),
          });
        }

        // Calculate commission and release to teacher wallet
        const teachers = await base44.asServiceRole.entities.TeacherProfile.filter({ user_email: booking.teacher_email });
        const teacher = teachers.length > 0 ? teachers[0] : null;
        const completedLessons = teacher?.total_completed_lessons || 0;
        const reductions = Math.min(Math.floor(completedLessons / 100), 5);
        const commissionRate = (15 - reductions) / 100;
        const grossAmount = payment.amount;
        const commissionAmount = parseFloat((grossAmount * commissionRate).toFixed(2));
        const teacherNet = parseFloat((grossAmount - commissionAmount).toFixed(2));

        // Credit teacher wallet
        const wallets = await base44.asServiceRole.entities.TeacherWallet.filter({ teacher_email: booking.teacher_email });
        if (wallets.length > 0) {
          const wallet = wallets[0];
          await base44.asServiceRole.entities.TeacherWallet.update(wallet.id, {
            balance: parseFloat(((wallet.balance || 0) + teacherNet).toFixed(2)),
            total_earned: parseFloat(((wallet.total_earned || 0) + teacherNet).toFixed(2)),
          });
        } else if (teacher) {
          await base44.asServiceRole.entities.TeacherWallet.create({
            teacher_email: booking.teacher_email,
            balance: teacherNet,
            total_earned: teacherNet,
            total_withdrawn: 0,
            pending_balance: 0,
            currency: 'EUR',
          });
        }

        // Record wallet transaction
        if (teacher) {
          await base44.asServiceRole.entities.WalletTransaction.create({
            teacher_email: booking.teacher_email,
            teacher_name: teacher.full_name,
            type: 'payment_received',
            amount: teacherNet,
            currency: 'EUR',
            student_email: booking.student_email,
            student_name: booking.student_name,
            lessons_count: 1,
            status: 'completed',
            notes: `Late cancellation charge. Gross: €${grossAmount} | Commission (${Math.round(commissionRate * 100)}%): €${commissionAmount} | Net: €${teacherNet}`,
          });

          // Record admin commission
          await base44.asServiceRole.entities.AdminCommission.create({
            booking_id,
            teacher_email: booking.teacher_email,
            teacher_name: teacher.full_name,
            student_email: booking.student_email,
            student_name: booking.student_name,
            gross_amount: grossAmount,
            commission_rate: commissionRate,
            commission_amount: commissionAmount,
            teacher_net: teacherNet,
            session_duration: booking.session_duration,
            lesson_date: booking.date,
            teacher_total_lessons_at_time: completedLessons,
            currency: 'EUR',
          });
        }

        return Response.json({
          success: true,
          outcome: 'charged',
          amount_charged: payment.amount,
          message: `This lesson was cancelled within 12 hours of the start time. €${payment.amount.toFixed(2)} has been charged and cannot be refunded.`
        });
      }
    }

    // No payment record (e.g. trial)
    return Response.json({ success: true, outcome: 'cancelled', message: 'Lesson cancelled.' });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});