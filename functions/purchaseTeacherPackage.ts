import { createClientFromRequest } from "npm:@base44/sdk@0.8.20";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { teacher_id, teacher_email, package_type, amount, lessons_count, session_duration } = body;

    // Validate teacher exists
    const teachers = await base44.asServiceRole.entities.TeacherProfile.filter({ id: teacher_id });
    if (teachers.length === 0 || teachers[0].user_email !== teacher_email) {
      return Response.json({ error: "Teacher not found" }, { status: 404 });
    }

    // Load student profile
    const studentProfiles = await base44.asServiceRole.entities.StudentProfile.filter({
      user_email: user.email,
    });
    if (studentProfiles.length === 0) {
      return Response.json({ error: "Student profile not found" }, { status: 404 });
    }
    const student = studentProfiles[0];

    // 1. Record payment as "pending" (funds held in escrow)
    const payment = await base44.asServiceRole.entities.Payment.create({
      student_email: user.email,
      student_name: student.full_name || user.full_name,
      package_type,
      amount,
      currency: "USD",
      lessons_count,
      session_duration,
      status: "pending",  // escrow — released per lesson on completion
    });

    // 2. Add funds to teacher's PENDING balance (escrow)
    const wallets = await base44.asServiceRole.entities.TeacherWallet.filter({
      teacher_email: teacher_email
    });
    let wallet = wallets.length > 0 ? wallets[0] : null;

    if (!wallet) {
      wallet = await base44.asServiceRole.entities.TeacherWallet.create({
        teacher_email: teacher_email,
        balance: 0,
        total_earned: 0,
        total_withdrawn: 0,
        pending_balance: amount,
        currency: 'EUR'
      });
    } else {
      await base44.asServiceRole.entities.TeacherWallet.update(wallet.id, {
        pending_balance: (wallet.pending_balance || 0) + amount
      });
    }

    // 3. Record wallet transaction as pending
    await base44.asServiceRole.entities.WalletTransaction.create({
      type: "payment_received",
      amount,
      currency: "USD",
      student_email: user.email,
      student_name: student.full_name || user.full_name,
      package_type,
      lessons_count,
      status: "pending",
      notes: `Package purchased — funds held in escrow until lessons complete.`,
    });

    // 4. Credit lessons to student profile
    await base44.asServiceRole.entities.StudentProfile.update(student.id, {
      lessons_remaining: (student.lessons_remaining || 0) + lessons_count,
    });

    return Response.json({ success: true, payment_id: payment.id });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});