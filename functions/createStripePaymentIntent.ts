import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import Stripe from 'npm:stripe@16.0.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

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

    const { teacher_email, amount, package_type, lessons_count, session_duration } = await req.json();

    // Validate amount
    if (!amount || amount <= 0) {
      return Response.json({ error: 'Invalid amount' }, { status: 400 });
    }

    // Create Payment record (pending)
    const payment = await base44.entities.Payment.create({
      student_email: user.email,
      student_name: user.full_name,
      package_type,
      amount,
      currency: 'EUR',
      lessons_count,
      session_duration,
      status: 'pending'
    });

    // Create Stripe PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert EUR to cents
      currency: 'eur',
      payment_method_types: ['card'],
      metadata: {
        payment_id: payment.id,
        student_email: user.email,
        teacher_email,
        package_type,
        lessons_count
      },
      description: `Lesson package (${lessons_count} x ${session_duration}min) - ${user.full_name}`
    });

    // Update Payment with Stripe intent ID
    await base44.entities.Payment.update(payment.id, {
      stripe_payment_intent_id: paymentIntent.id
    });

    console.log(`✅ PaymentIntent created: ${paymentIntent.id} for €${amount}`);

    return Response.json({
      client_secret: paymentIntent.client_secret,
      payment_intent_id: paymentIntent.id,
      payment_id: payment.id,
      amount,
      currency: 'EUR'
    }, { status: 200 });

  } catch (error) {
    console.error('Payment intent creation error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});