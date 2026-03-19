import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import Stripe from 'npm:stripe@16.0.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

/**
 * Belt-and-suspenders fallback: called from the success page after Stripe redirect.
 * Fetches the session from Stripe, verifies it's paid, and credits the student's balance
 * if the webhook hasn't already done so.
 */
Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { payment_id } = await req.json();
    if (!payment_id) return Response.json({ error: 'payment_id required' }, { status: 400 });

    // Load our Payment record
    const payments = await base44.asServiceRole.entities.Payment.filter({ id: payment_id });
    if (payments.length === 0) return Response.json({ error: 'Payment not found' }, { status: 404 });

    const payment = payments[0];

    // Already processed by webhook — nothing to do
    if (payment.status === 'completed') {
      console.log(`Payment ${payment_id} already completed (webhook handled it).`);
      return Response.json({ status: 'already_completed' });
    }

    // Fetch session from Stripe to verify payment
    const session = await stripe.checkout.sessions.retrieve(payment.stripe_payment_intent_id);

    if (session.payment_status !== 'paid') {
      return Response.json({ error: 'Payment not confirmed by Stripe' }, { status: 402 });
    }

    const teacherEmail = session.metadata?.teacher_email?.trim() || '';
    const eurAdded = payment.amount;

    // Mark payment as completed
    await base44.asServiceRole.entities.Payment.update(payment.id, {
      status: 'completed',
      stripe_charge_id: session.payment_intent || session.id,
    });

    if (!teacherEmail) {
      console.warn(`verifyAndCreditWallet: no teacher_email for payment ${payment_id}`);
      return Response.json({ status: 'completed_no_teacher' });
    }

    // Create or update StudentTeacherSubscription
    const teachers = await base44.asServiceRole.entities.TeacherProfile.filter({ user_email: teacherEmail });
    const teacher = teachers[0] || null;
    const lockedPrice50 = teacher?.lesson_price_50 || 35;
    const lockedPrice25 = teacher?.lesson_price_25 || 20;

    const existingSubs = await base44.asServiceRole.entities.StudentTeacherSubscription.filter({
      student_email: payment.student_email,
      teacher_email: teacherEmail,
    });

    const activeSub = existingSubs.find(s => s.subscription_status === 'active');
    if (activeSub) {
      await base44.asServiceRole.entities.StudentTeacherSubscription.update(activeSub.id, {
        balance_eur: parseFloat(((activeSub.balance_eur || 0) + eurAdded).toFixed(2)),
      });
    } else if (existingSubs.length > 0) {
      await base44.asServiceRole.entities.StudentTeacherSubscription.update(existingSubs[0].id, {
        balance_eur: parseFloat(((existingSubs[0].balance_eur || 0) + eurAdded).toFixed(2)),
        subscription_status: 'active',
      });
    } else {
      await base44.asServiceRole.entities.StudentTeacherSubscription.create({
        student_email: payment.student_email,
        teacher_email: teacherEmail,
        balance_eur: eurAdded,
        held_eur: 0,
        locked_price_50: lockedPrice50,
        locked_price_25: lockedPrice25,
        subscription_status: 'active',
        total_spent: 0,
      });
    }

    // Update teacher wallet pending balance
    const wallets = await base44.asServiceRole.entities.TeacherWallet.filter({ teacher_email: teacherEmail });
    if (wallets.length === 0) {
      await base44.asServiceRole.entities.TeacherWallet.create({
        teacher_email: teacherEmail,
        balance: 0, total_earned: 0, total_withdrawn: 0,
        pending_balance: eurAdded,
        currency: 'EUR',
      });
    } else {
      await base44.asServiceRole.entities.TeacherWallet.update(wallets[0].id, {
        pending_balance: parseFloat(((wallets[0].pending_balance || 0) + eurAdded).toFixed(2)),
      });
    }

    console.log(`verifyAndCreditWallet: credited €${eurAdded} to ${payment.student_email} → ${teacherEmail}`);
    return Response.json({ status: 'credited', amount: eurAdded });

  } catch (error) {
    console.error('verifyAndCreditWallet error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});