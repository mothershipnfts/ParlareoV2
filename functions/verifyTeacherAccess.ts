import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Verify that the authenticated user is the teacher they claim to be
 * Prevents teachers from accessing other teachers' data
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { target_teacher_email } = await req.json();

    if (!target_teacher_email) {
      return Response.json({ error: 'target_teacher_email required' }, { status: 400 });
    }

    // Verify logged-in user is the target teacher
    if (user.email !== target_teacher_email) {
      return Response.json(
        { error: 'You cannot access other teachers\' data' },
        { status: 403 }
      );
    }

    return Response.json({ authorized: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});