import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden - Admin only' }, { status: 403 });
    }

    const { email } = await req.json();
    
    if (!email) {
      return Response.json({ error: 'Email required' }, { status: 400 });
    }

    console.log(`[convertUserToTeacher] Converting ${email} to teacher`);

    // Check if TeacherSignupRequest exists and is approved
    const signupRequests = await base44.asServiceRole.entities.TeacherSignupRequest.filter({ 
      email, 
      status: 'approved' 
    });
    
    if (signupRequests.length === 0) {
      return Response.json({ 
        error: 'No approved TeacherSignupRequest found for this email. Approve through admin first.' 
      }, { status: 404 });
    }

    // Update User entity to teacher
    const users = await base44.asServiceRole.entities.User.filter({ email });
    if (users.length === 0) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    const userId = users[0].id;
    await base44.asServiceRole.entities.User.update(userId, {
      role: 'teacher',
      teacher_status: 'approved'
    });

    console.log(`[convertUserToTeacher] Successfully converted ${email} to teacher role`);

    return Response.json({ 
      success: true, 
      message: `${email} is now a teacher account` 
    });
  } catch (error) {
    console.error('[convertUserToTeacher] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});