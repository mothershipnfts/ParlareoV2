import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const ROLE_HOME = {
  admin: "AdminDashboard",
  teacher: "TeacherDashboard",
  student: "StudentDashboard",
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = user.role || 'student';
    const dashboard = ROLE_HOME[role] || 'StudentDashboard';

    return Response.json({ role, dashboard });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});