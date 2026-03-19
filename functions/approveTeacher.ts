import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { appId, action, rejectionReason } = await req.json();

    // 'sync' action doesn't need a specific app
    if (action === 'sync') {
      const approvedApps = await base44.asServiceRole.entities.TeacherSignupRequest.filter({ status: 'approved' });
      const changes = [];

      for (const a of approvedApps) {
        // Fix User record
        const users = await base44.asServiceRole.entities.User.filter({ email: a.email });
        if (users.length > 0 && (users[0].role !== 'teacher' || users[0].teacher_status !== 'approved')) {
          await base44.asServiceRole.entities.User.update(users[0].id, {
            role: 'teacher',
            teacher_status: 'approved'
          });
          changes.push({ email: a.email, fixed: 'user_role' });
        }

        // Fix TeacherProfile
        const profiles = await base44.asServiceRole.entities.TeacherProfile.filter({ user_email: a.email });
        if (profiles.length > 0 && profiles[0].verification_status !== 'verified') {
          await base44.asServiceRole.entities.TeacherProfile.update(profiles[0].id, {
            verification_status: 'verified',
            is_active: true
          });
          changes.push({ email: a.email, fixed: 'profile_verification' });
        } else if (profiles.length === 0) {
          await base44.asServiceRole.entities.TeacherProfile.create({
            user_email: a.email, full_name: a.full_name, bio: a.bio,
            nationality: a.nationality, years_experience: a.years_experience,
            lesson_types: a.lesson_types || [], specializations: a.specializations || [],
            verification_status: 'verified', is_active: true,
            lesson_price_50: 35, lesson_price_25: 21
          });
          changes.push({ email: a.email, fixed: 'profile_created' });
        }
      }

      return Response.json({ success: true, synced: approvedApps.length, changes });
    }

    const app = await base44.asServiceRole.entities.TeacherSignupRequest.get(appId);
    if (!app) return Response.json({ error: 'Application not found' }, { status: 404 });

    if (action === 'approve') {
      await base44.asServiceRole.entities.TeacherSignupRequest.update(appId, { status: 'approved' });

      // Update user role + teacher_status
      const users = await base44.asServiceRole.entities.User.filter({ email: app.email });
      if (users.length > 0) {
        await base44.asServiceRole.entities.User.update(users[0].id, {
          role: 'teacher',
          teacher_status: 'approved'
        });
      }

      // Create/update TeacherProfile
      const existing = await base44.asServiceRole.entities.TeacherProfile.filter({ user_email: app.email });
      if (existing.length === 0) {
        await base44.asServiceRole.entities.TeacherProfile.create({
          user_email: app.email,
          full_name: app.full_name,
          bio: app.bio,
          nationality: app.nationality,
          years_experience: app.years_experience,
          lesson_types: app.lesson_types || [],
          specializations: app.specializations || [],
          verification_status: 'verified',
          is_active: true,
          lesson_price_50: 35,
          lesson_price_25: 21
        });
      } else {
        await base44.asServiceRole.entities.TeacherProfile.update(existing[0].id, {
          verification_status: 'verified',
          is_active: true
        });
      }

      await base44.asServiceRole.integrations.Core.SendEmail({
        to: app.email,
        subject: '🎉 Congratulations! Your Fluently teacher account is now active',
        body: `Hi ${app.full_name},\n\nGreat news! Your Fluently teacher application has been reviewed and approved.\n\nYou now have full access to your Teacher Dashboard where you can:\n• Set your availability and schedule\n• Manage your profile and pricing\n• Start receiving student bookings\n• Track your earnings in your Wallet\n\nWelcome to the Fluently teaching community!\n\nThe Fluently Team`
      });

      return Response.json({ success: true, action: 'approved' });

    } else if (action === 'reject') {
      if (!rejectionReason) {
        return Response.json({ error: 'Rejection reason is required' }, { status: 400 });
      }

      await base44.asServiceRole.entities.TeacherSignupRequest.update(appId, {
        status: 'rejected',
        rejection_reason: rejectionReason
      });

      const users = await base44.asServiceRole.entities.User.filter({ email: app.email });
      if (users.length > 0) {
        await base44.asServiceRole.entities.User.update(users[0].id, {
          teacher_status: 'rejected'
        });
      }

      await base44.asServiceRole.integrations.Core.SendEmail({
        to: app.email,
        subject: 'Update on your Fluently teacher application',
        body: `Hi ${app.full_name},\n\nThank you for applying to teach on Fluently. After reviewing your application, we are unable to approve it at this time.\n\nReason: ${rejectionReason}\n\nYou may resubmit your application with updated documents by logging into your account.\n\nThe Fluently Team`
      });

      return Response.json({ success: true, action: 'rejected' });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});