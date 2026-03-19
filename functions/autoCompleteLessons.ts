import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Runs every 5 minutes to auto-complete lessons whose end_time has passed
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Use service role since this is a system task
    const nowUTC = new Date();
    const todayStr = nowUTC.toISOString().split('T')[0];
    const currentTimeStr = nowUTC.toISOString().substring(11, 16); // HH:MM in UTC

    // Get all scheduled bookings for today or earlier
    const scheduledBookings = await base44.asServiceRole.entities.Booking.filter({
      status: 'scheduled',
    });

    const overdue = scheduledBookings.filter(b => {
      if (b.date < todayStr) return true; // past date
      if (b.date === todayStr && b.end_time <= currentTimeStr) return true; // today, past end time
      return false;
    });

    if (overdue.length === 0) {
      return Response.json({ success: true, completed: 0, message: 'No overdue lessons' });
    }

    const results = [];

    for (const booking of overdue) {
      // Skip trial lessons (unpaid)
      if (booking.payment_status === 'unpaid') {
        // Just mark as completed, no payment flow
        await base44.asServiceRole.entities.Booking.update(booking.id, {
          status: 'completed',
          change_timestamp: new Date().toISOString(),
        });
        results.push({ booking_id: booking.id, outcome: 'completed_trial' });
        continue;
      }

      // Get held payment
      const payments = await base44.asServiceRole.entities.LessonPayment.filter({
        booking_id: booking.id,
        status: 'held',
      });

      if (payments.length === 0) {
        // Check for legacy 'pending' status
        const legacyPayments = await base44.asServiceRole.entities.LessonPayment.filter({
          booking_id: booking.id,
          status: 'pending',
        });

        if (legacyPayments.length === 0) {
          // No payment record — just complete the booking
          await base44.asServiceRole.entities.Booking.update(booking.id, {
            status: 'completed',
            change_timestamp: new Date().toISOString(),
          });
          results.push({ booking_id: booking.id, outcome: 'completed_no_payment' });
          continue;
        }

        // Treat legacy pending as held
        payments.push(...legacyPayments);
      }

      const payment = payments[0];

      // Get teacher profile
      const teachers = await base44.asServiceRole.entities.TeacherProfile.filter({
        user_email: booking.teacher_email,
      });
      if (teachers.length === 0) {
        results.push({ booking_id: booking.id, outcome: 'error_no_teacher' });
        continue;
      }
      const teacher = teachers[0];

      // Tiered commission
      const completedLessons = teacher.total_completed_lessons || 0;
      const reductions = Math.min(Math.floor(completedLessons / 100), 5);
      const commissionRate = (15 - reductions) / 100;
      const grossAmount = payment.amount;
      const commissionAmount = parseFloat((grossAmount * commissionRate).toFixed(2));
      const teacherNet = parseFloat((grossAmount - commissionAmount).toFixed(2));

      // Mark booking completed
      await base44.asServiceRole.entities.Booking.update(booking.id, {
        status: 'completed',
        change_timestamp: new Date().toISOString(),
      });

      // Mark payment completed
      await base44.asServiceRole.entities.LessonPayment.update(payment.id, { status: 'completed' });

      // Release held EUR from subscription escrow (if subscription exists)
      const subs = await base44.asServiceRole.entities.StudentTeacherSubscription.filter({
        student_email: booking.student_email,
        teacher_email: booking.teacher_email,
      });
      if (subs.length > 0) {
        const sub = subs[0];
        await base44.asServiceRole.entities.StudentTeacherSubscription.update(sub.id, {
          held_eur: parseFloat(Math.max(0, (sub.held_eur || 0) - grossAmount).toFixed(2)),
          total_spent: parseFloat(((sub.total_spent || 0) + grossAmount).toFixed(2)),
        });
      }

      // Update teacher profile stats
      await base44.asServiceRole.entities.TeacherProfile.update(teacher.id, {
        total_completed_lessons: completedLessons + 1,
        total_lessons_taught: (teacher.total_lessons_taught || 0) + 1,
      });

      // Credit teacher wallet
      const wallets = await base44.asServiceRole.entities.TeacherWallet.filter({
        teacher_email: booking.teacher_email,
      });
      if (wallets.length > 0) {
        const wallet = wallets[0];
        await base44.asServiceRole.entities.TeacherWallet.update(wallet.id, {
          balance: parseFloat(((wallet.balance || 0) + teacherNet).toFixed(2)),
          total_earned: parseFloat(((wallet.total_earned || 0) + teacherNet).toFixed(2)),
        });
      } else {
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
        notes: `Auto-completed lesson. Gross: €${grossAmount} | Commission (${Math.round(commissionRate * 100)}%): €${commissionAmount} | Net: €${teacherNet}`,
      });

      // Record admin commission
      await base44.asServiceRole.entities.AdminCommission.create({
        booking_id: booking.id,
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
        teacher_total_lessons_at_time: completedLessons + 1,
        currency: 'EUR',
      });

      results.push({ booking_id: booking.id, outcome: 'completed_paid', teacher_net: teacherNet });
    }

    return Response.json({ success: true, completed: results.length, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});