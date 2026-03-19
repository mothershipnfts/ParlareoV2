import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, display_name, account_identifier, method_type } = await req.json();

    if (!action || !display_name || !account_identifier || !method_type) {
      return Response.json({ 
        error: 'Missing required fields: action, display_name, account_identifier, method_type' 
      }, { status: 400 });
    }

    if (action === 'save_method') {
      // Get existing methods to check if this should be default
      const existing = await base44.entities.StudentPaymentMethod.filter({
        student_email: user.email
      });

      await base44.entities.StudentPaymentMethod.create({
        student_email: user.email,
        method_type,
        display_name,
        account_identifier,
        is_default: existing.length === 0
      });

      return Response.json({
        success: true,
        message: 'Payment method saved'
      }, { status: 200 });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Payment method error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});