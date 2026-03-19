import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import Stripe from 'npm:stripe@16.0.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));
const APP_URL = Deno.env.get('APP_URL') || 'https://app.base44.app';

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

    const { amount } = await req.json();

    if (!amount || amount <= 0) {
      return Response.json({ error: 'Invalid amount' }, { status: 400 });
    }

    // Create pending payment record
    const payment = await base44.asServiceRole.entities.Payment.create({
      student_email: user.email,
      student_name: user.full_name,
      package_type: `credits_${amount}`,
      amount: amount,
      currency: 'EUR',
      lessons_count: 1,
      session_duration: 50,
      status: 'pending'
    });

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: `€${amount} Lesson Credits`,
              description: 'Lesson credits valid for 30 days with any teacher on Parlareo'
            },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        }
      ],
      success_url: `${APP_URL}/BuyLessonPackage?payment=success&payment_id=${payment.id}`,
      cancel_url: `${APP_URL}/BuyLessonPackage?payment=cancelled`,
      metadata: {
        payment_id: payment.id,
        student_email: user.email,
        credit_amount: String(amount)
      }
    });

    await base44.asServiceRole.entities.Payment.update(payment.id, {
      stripe_payment_intent_id: session.id
    });

    console.log(`Credit purchase session created: ${session.id} for EUR ${amount}`);

    return Response.json({
      session_url: session.url,
      sessionId: session.id,
      payment_id: payment.id
    }, { status: 200 });

  } catch (error) {
    console.error('Purchase error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});