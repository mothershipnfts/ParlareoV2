import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { recipient_email, recipient_name, content } = await req.json();

    if (!recipient_email || !content) {
      return Response.json({ error: 'recipient_email and content required' }, { status: 400 });
    }

    // Create message record
    const message = await base44.entities.Messages.create({
      sender_email: user.email,
      sender_name: user.full_name || 'Unknown',
      recipient_email: recipient_email,
      recipient_name: recipient_name || recipient_email,
      content: content,
      is_read: false
    });

    return Response.json({
      success: true,
      message_id: message.id,
      created_at: message.created_date
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});