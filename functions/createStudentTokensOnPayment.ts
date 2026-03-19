import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Creates TokenBalances when student payment is completed
 * Called from Stripe webhook after payment_intent.succeeded
 * Generates lesson credits (tokens) that student can use to book lessons
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { payment_id } = await req.json();

    if (!payment_id) {
      return Response.json({ error: 'payment_id required' }, { status: 400 });
    }

    // Fetch payment record
    const payments = await base44.asServiceRole.entities.Payment.filter({
      id: payment_id
    });

    if (!payments || payments.length === 0) {
      return Response.json({ error: 'Payment not found' }, { status: 404 });
    }

    const payment = payments[0];

    // Only create tokens if payment is completed
    if (payment.status !== 'completed') {
      return Response.json({ 
        error: 'Payment not completed yet',
        status: payment.status 
      }, { status: 400 });
    }

    // Calculate expiration date (6 months from now)
    const expirationDate = new Date();
    expirationDate.setMonth(expirationDate.getMonth() + 6);

    // Create TokenBalances record
    const tokenBalance = await base44.asServiceRole.entities.TokenBalances.create({
      student_email: payment.student_email,
      package_duration: payment.session_duration,
      quantity_remaining: payment.lessons_count,
      quantity_purchased: payment.lessons_count,
      expiration_date: expirationDate.toISOString().split('T')[0],
      package_type: payment.package_type,
      payment_id: payment.id,
      status: 'active'
    });

    console.log(`✅ TokenBalances created: ${tokenBalance.id} for ${payment.student_email} (${payment.lessons_count} x ${payment.session_duration}min)`);

    return Response.json({
      success: true,
      token_balance_id: tokenBalance.id,
      lessons_count: payment.lessons_count,
      session_duration: payment.session_duration,
      expires: expirationDate.toISOString().split('T')[0]
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});