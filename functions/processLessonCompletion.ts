import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { booking_id } = await req.json();

    if (!booking_id) {
      return Response.json({ error: 'booking_id required' }, { status: 400 });
    }

    // Fetch booking
    const bookings = await base44.asServiceRole.entities.Booking.filter({
      id: booking_id
    });

    if (!bookings || bookings.length === 0) {
      return Response.json({ error: 'Booking not found' }, { status: 404 });
    }

    const booking = bookings[0];

    // Get teacher profile
    const teachers = await base44.asServiceRole.entities.TeacherProfile.filter({
      user_email: booking.teacher_email
    });

    if (!teachers || teachers.length === 0) {
      return Response.json({ error: 'Teacher not found' }, { status: 404 });
    }

    const teacher = teachers[0];

    // Increment total_completed_lessons
    const updatedCompleted = (teacher.total_completed_lessons || 0) + 1;
    await base44.asServiceRole.entities.TeacherProfile.update(teacher.id, {
      total_completed_lessons: updatedCompleted
    });

    // Get commission rate based on new total
    const rateResponse = await base44.asServiceRole.functions.invoke('getTeacherCommissionRate', {
      teacher_email: booking.teacher_email
    });

    const commissionRate = rateResponse.data.commission_rate;
    const teacherNetRate = rateResponse.data.teacher_net_rate;

    // Calculate amounts (assuming lesson_price_25 or lesson_price_50 based on session_duration)
    const lessonPrice = booking.session_duration === 25 ? teacher.lesson_price_25 : teacher.lesson_price_50;
    const adminCommission = lessonPrice * commissionRate;
    const teacherEarning = lessonPrice * teacherNetRate;

    // Create admin commission record
    await base44.asServiceRole.entities.AdminCommission.create({
      booking_id: booking.id,
      teacher_email: booking.teacher_email,
      teacher_name: teacher.full_name,
      student_email: booking.student_email,
      student_name: booking.student_name,
      gross_amount: lessonPrice,
      commission_rate: commissionRate,
      commission_amount: adminCommission,
      teacher_net: teacherEarning,
      session_duration: booking.session_duration,
      lesson_date: booking.date,
      teacher_total_lessons_at_time: updatedCompleted,
      currency: 'EUR'
    });

    // Create wallet transaction
    await base44.asServiceRole.entities.WalletTransaction.create({
      teacher_email: booking.teacher_email,
      teacher_name: teacher.full_name,
      type: 'payment_received',
      amount: teacherEarning,
      currency: 'EUR',
      student_email: booking.student_email,
      student_name: booking.student_name,
      lessons_count: 1,
      status: 'completed',
      notes: `Payment for ${booking.session_duration}min lesson on ${booking.date}`
    });

    // Update or create teacher wallet
    const wallets = await base44.asServiceRole.entities.TeacherWallet.filter({
      teacher_email: booking.teacher_email
    });

    if (wallets && wallets.length > 0) {
      const wallet = wallets[0];
      await base44.asServiceRole.entities.TeacherWallet.update(wallet.id, {
        balance: (wallet.balance || 0) + teacherEarning,
        total_earned: (wallet.total_earned || 0) + teacherEarning
      });
    } else {
      // Create wallet if it doesn't exist
      await base44.asServiceRole.entities.TeacherWallet.create({
        teacher_email: booking.teacher_email,
        balance: teacherEarning,
        total_earned: teacherEarning,
        total_withdrawn: 0,
        pending_balance: 0,
        currency: 'EUR'
      });
    }

    return Response.json({
      success: true,
      lesson_price: lessonPrice,
      commission_rate: commissionRate,
      teacher_earning: teacherEarning,
      admin_commission: adminCommission,
      new_tier: rateResponse.data.tier_name,
      lessons_to_next_tier: rateResponse.data.lessons_to_next_tier
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});