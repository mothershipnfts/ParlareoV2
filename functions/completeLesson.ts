import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { booking_id } = await req.json();
    if (!booking_id) return Response.json({ error: 'Missing booking_id' }, { status: 400 });

    // Get the booking
    const bookings = await base44.asServiceRole.entities.Booking.filter({ id: booking_id });
    if (bookings.length === 0) return Response.json({ error: 'Booking not found' }, { status: 404 });
    const booking = bookings[0];

    // Only the assigned teacher can complete the lesson
    if (user.email !== booking.teacher_email) {
      return Response.json({ error: 'Forbidden: Only the assigned teacher can complete this lesson' }, { status: 403 });
    }

    if (booking.status === 'completed') {
      return Response.json({ error: 'Lesson already completed' }, { status: 400 });
    }

    // Get the held lesson payment
    const payments = await base44.asServiceRole.entities.LessonPayment.filter({
      booking_id, status: 'held'
    });
    if (payments.length === 0) {
      return Response.json({ error: 'No held payment found for this lesson' }, { status: 404 });
    }
    const payment = payments[0];

    // Get teacher profile for commission calculation
    const teachers = await base44.asServiceRole.entities.TeacherProfile.filter({ user_email: booking.teacher_email });
    if (teachers.length === 0) return Response.json({ error: 'Teacher profile not found' }, { status: 404 });
    const teacher = teachers[0];

    // Tiered commission calculation
    const completedLessons = teacher.total_completed_lessons || 0;
    const reductions = Math.min(Math.floor(completedLessons / 100), 5);
    const commissionRate = (15 - reductions) / 100;

    const grossAmount = payment.amount; // locked EUR price from when student purchased
    const commissionAmount = parseFloat((grossAmount * commissionRate).toFixed(2));
    const teacherNet = parseFloat((grossAmount - commissionAmount).toFixed(2));

    // Mark booking completed
    await base44.asServiceRole.entities.Booking.update(booking_id, {
      status: 'completed',
      change_timestamp: new Date().toISOString(),
    });

    // Release held payment → completed
    await base44.asServiceRole.entities.LessonPayment.update(payment.id, { status: 'completed' });

    // Release held EUR from subscription escrow
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

    // Increment teacher's completed lessons count
    await base44.asServiceRole.entities.TeacherProfile.update(teacher.id, {
      total_completed_lessons: completedLessons + 1,
      total_lessons_taught: (teacher.total_lessons_taught || 0) + 1,
    });

    // Release funds to teacher wallet
    const wallets = await base44.asServiceRole.entities.TeacherWallet.filter({ teacher_email: booking.teacher_email });
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

    // Record teacher wallet transaction
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
      notes: `Lesson completed. Gross: €${grossAmount} | Commission (${Math.round(commissionRate * 100)}%): €${commissionAmount} | Net: €${teacherNet}`,
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
      teacher_total_lessons_at_time: completedLessons + 1,
      currency: 'EUR',
    });

    return Response.json({
      success: true,
      gross_amount: grossAmount,
      commission_rate: commissionRate,
      commission_amount: commissionAmount,
      teacher_net: teacherNet,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});