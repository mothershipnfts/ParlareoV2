import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json();
    const teacher_email = body.teacher_email;

    if (!teacher_email) {
      return Response.json({ error: 'teacher_email required' }, { status: 400 });
    }

    const teachers = await base44.asServiceRole.entities.TeacherProfile.filter({
      user_email: teacher_email
    });

    if (!teachers || teachers.length === 0) {
      return Response.json({ error: 'Teacher not found' }, { status: 404 });
    }

    const teacher = teachers[0];
    const completedLessons = teacher.total_completed_lessons || 0;

    // Commission starts at 15%, drops 1% per 100 lessons completed, floors at 10% (at 500 lessons)
    const reductions = Math.min(Math.floor(completedLessons / 100), 5);
    const commissionRate = (15 - reductions) / 100;
    const teacherNetRate = 1 - commissionRate;

    const tierNames = ["Starter", "Rising", "Skilled", "Experienced", "Senior", "Expert"];
    const tierName = tierNames[reductions] + " (" + Math.round(commissionRate * 100) + "% platform fee)";

    const atCap = reductions >= 5;
    const lessonsToNextTier = atCap ? 0 : ((reductions + 1) * 100) - completedLessons;

    return Response.json({
      commission_rate: commissionRate,
      teacher_net_rate: teacherNetRate,
      tier_name: tierName,
      completed_lessons: completedLessons,
      at_permanent_cap: atCap,
      lessons_to_next_tier: lessonsToNextTier,
      next_tier_commission_rate: atCap ? commissionRate : commissionRate - 0.01
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});