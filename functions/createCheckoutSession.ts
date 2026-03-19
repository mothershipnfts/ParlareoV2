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

    const { amount, lessons_count, teacher_id, teacher_email, student_email, student_name, session_duration } = await req.json();

    if (!amount || amount <= 0) {
      return Response.json({ error: 'Invalid amount' }, { status: 400 });
    }

    // Create Payment record (pending)
    const payment = await base44.asServiceRole.entities.Payment.create({
      student_email: student_email || user.email,
      student_name: student_name || user.full_name,
      package_type: teacher_id ? `teacher_${teacher_id}_x${lessons_count}` : `credits_${amount}`,
      amount: amount / 100,
      currency: 'EUR',
      lessons_count: lessons_count || 1,
      session_duration: session_duration || 50,
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
              name: lessons_count
                ? `${lessons_count} Lesson${lessons_count > 1 ? 's' : ''} Package`
                : `Lesson Credits (€${(amount / 100).toFixed(2)})`,
              description: teacher_email ? `Lessons with teacher` : 'Lesson credits for any teacher'
            },
            unit_amount: amount,
          },
          quantity: 1,
        }
      ],
      success_url: `${APP_URL}/StudentDashboard?payment=success&payment_id=${payment.id}&teacher_id=${teacher_id || ''}&tab=tutors`,
      cancel_url: `${APP_URL}/StudentDashboard?tab=tutors&teacher_id=${teacher_id || ''}`,
      metadata: {
        payment_id: payment.id,
        student_email: student_email || user.email,
        teacher_email: teacher_email || '',
        lessons_count: String(lessons_count || 1),
        teacher_id: teacher_id || ''
      }
    });

    // Update Payment with Stripe session ID
    await base44.asServiceRole.entities.Payment.update(payment.id, {
      stripe_payment_intent_id: session.id
    });

    console.log(`Checkout Session created: ${session.id} for EUR ${amount / 100}`);

    return Response.json({
      sessionId: session.id,
      session_url: session.url,
      payment_id: payment.id,
      amount,
      currency: 'EUR'
    }, { status: 200 });

  } catch (error) {
    console.error('Checkout session creation error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});