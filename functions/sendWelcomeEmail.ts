import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    const { data } = payload;
    if (!data?.user_email || !data?.full_name) {
      return Response.json({ error: 'Missing student data' }, { status: 400 });
    }

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: data.user_email,
      subject: "Welcome to Fluently Language Studio 🎉",
      body: `Hi ${data.full_name},

Welcome to Fluently Language Studio! We're thrilled to have you on board.

Your account has been successfully created. Here's what you can do next:

1. 📝 Complete your placement test to discover your English level
2. 📚 Browse our lesson library — free lessons are waiting for you
3. 👩‍🏫 Find a verified tutor and book a free 25-minute trial

Get started now: https://app.base44.com

If you have any questions, simply reply to this email.

Happy learning!
The Fluently Team`
    });

    console.log(`[sendWelcomeEmail] Welcome email sent to ${data.user_email}`);
    return Response.json({ success: true });
  } catch (error) {
    console.error('[sendWelcomeEmail] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});