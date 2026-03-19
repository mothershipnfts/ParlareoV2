import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // CRITICAL: Always fetch fresh user data from DB (not cached)
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get fresh user data including latest role/status changes from DB
    const freshUsers = await base44.asServiceRole.entities.User.filter({ email: user.email });
    if (freshUsers.length === 0) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }
    
    const freshUser = freshUsers[0];
    const role = freshUser.role || 'student';
    const teacherStatus = freshUser.teacher_status;
    const assessmentCompleted = freshUser.english_level_assessment_completed || false;

    console.log(`[onAuthComplete] Fresh user data - Email: ${freshUser.email}, Role: ${role}, Teacher Status: ${teacherStatus}, Assessment: ${assessmentCompleted}`);

    // === APPROVED TEACHER (HIGHEST PRIORITY) ===
    if (role === 'teacher' && teacherStatus === 'approved') {
      console.log(`[onAuthComplete] Approved teacher detected - redirecting to TeacherDashboard`);
      return Response.json({
        allowed: true,
        redirect: '/TeacherDashboard',
        role: 'teacher',
        status: 'approved'
      });
    }

    // === PENDING TEACHER ===
    if (role === 'teacher' && teacherStatus === 'pending_review') {
      console.log(`[onAuthComplete] Pending teacher detected - redirecting to TeacherPendingReview`);
      return Response.json({
        allowed: true,
        redirect: '/TeacherPendingReview',
        role: 'teacher',
        status: 'pending_review'
      });
    }

    // === REJECTED TEACHER ===
    if (role === 'teacher' && teacherStatus === 'rejected') {
      console.log(`[onAuthComplete] Rejected teacher detected - redirecting to TeacherRejected`);
      return Response.json({
        allowed: true,
        redirect: '/TeacherRejected',
        role: 'teacher',
        status: 'rejected'
      });
    }

    // === STUDENT ===
    if (role === 'student') {
      if (!assessmentCompleted) {
        console.log(`[onAuthComplete] Student with incomplete assessment - redirecting to PlacementTest`);
        return Response.json({
          allowed: true,
          redirect: '/PlacementTest',
          role: 'student',
          assessment_completed: false
        });
      }
      console.log(`[onAuthComplete] Student with completed assessment - redirecting to StudentDashboard`);
      return Response.json({
        allowed: true,
        redirect: '/StudentDashboard',
        role: 'student',
        assessment_completed: true
      });
    }

    // === ADMIN ===
    if (role === 'admin') {
      console.log(`[onAuthComplete] Admin detected - redirecting to AdminDashboard`);
      return Response.json({
        allowed: true,
        redirect: '/AdminDashboard',
        role: 'admin'
      });
    }

    console.log(`[onAuthComplete] Unknown role: ${role}`);
    return Response.json({ error: 'Unknown role' }, { status: 400 });
  } catch (error) {
    console.error(`[onAuthComplete] Error:`, error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});