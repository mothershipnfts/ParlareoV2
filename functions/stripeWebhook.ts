import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import Stripe from 'npm:stripe@16.0.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');
    const base44 = createClientFromRequest(req);

    let event;
    if (webhookSecret && signature) {
      try {
        event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
      } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return Response.json({ error: 'Invalid signature' }, { status: 400 });
      }
    } else {
      event = JSON.parse(body);
      console.log('Webhook received (no sig verification):', event.type);
    }

    // ── checkout.session.completed ─────────────────────────────────────────────
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const paymentId = session.metadata?.payment_id;
      const teacherEmail = session.metadata?.teacher_email;
      const lessonsCount = parseInt(session.metadata?.lessons_count || '1');
      const teacherId = session.metadata?.teacher_id;

      // Try to find payment by payment_id metadata OR by stripe session id as fallback
      let payment = null;
      if (paymentId) {
        const payments = await base44.asServiceRole.entities.Payment.filter({ id: paymentId });
        if (payments.length > 0) payment = payments[0];
      }
      if (!payment) {
        // Fallback: look up by stripe session ID stored in stripe_payment_intent_id
        const bySession = await base44.asServiceRole.entities.Payment.filter({ stripe_payment_intent_id: session.id });
        if (bySession.length > 0) payment = bySession[0];
      }

      if (payment) {
        // Skip if already processed
        if (payment.status === 'completed') {
          console.log(`Payment ${payment.id} already processed, skipping.`);
          return Response.json({ received: true }, { status: 200 });
        }

        // Mark payment completed
        await base44.asServiceRole.entities.Payment.update(payment.id, {
          status: 'completed',
          stripe_charge_id: session.payment_intent || session.id
        });

        // Use teacher_email from metadata OR extract from payment package_type as fallback
        const resolvedTeacherEmail = (teacherEmail && teacherEmail.trim())
          ? teacherEmail.trim()
          : null;

        // If teacher-specific purchase: create/update StudentTeacherSubscription with locked price
        if (resolvedTeacherEmail) {
          const teachers = await base44.asServiceRole.entities.TeacherProfile.filter({ user_email: resolvedTeacherEmail });
          const teacher = teachers.length > 0 ? teachers[0] : null;

          // Locked prices at time of purchase
          const lockedPrice50 = teacher?.lesson_price_50 || 35;
          const lockedPrice25 = teacher?.lesson_price_25 || 20;

          // Check for existing subscription (any status, not just active)
          const existingSubs = await base44.asServiceRole.entities.StudentTeacherSubscription.filter({
            student_email: payment.student_email,
            teacher_email: resolvedTeacherEmail,
          });

          // Calculate EUR balance added based on what was paid
          const eurAdded = payment.amount;

          const activeSub = existingSubs.find(s => s.subscription_status === 'active');
          if (activeSub) {
            // Top up existing subscription balance
            await base44.asServiceRole.entities.StudentTeacherSubscription.update(activeSub.id, {
              balance_eur: parseFloat(((activeSub.balance_eur || 0) + eurAdded).toFixed(2)),
            });
            console.log(`Added €${eurAdded} to existing subscription for ${payment.student_email} with ${resolvedTeacherEmail}`);
          } else if (existingSubs.length > 0) {
            // Reactivate an inactive subscription
            await base44.asServiceRole.entities.StudentTeacherSubscription.update(existingSubs[0].id, {
              balance_eur: parseFloat(((existingSubs[0].balance_eur || 0) + eurAdded).toFixed(2)),
              subscription_status: 'active',
            });
            console.log(`Reactivated subscription for ${payment.student_email} with ${resolvedTeacherEmail}, added €${eurAdded}`);
          } else {
            // New subscription with locked prices and EUR balance
            await base44.asServiceRole.entities.StudentTeacherSubscription.create({
              student_email: payment.student_email,
              teacher_email: resolvedTeacherEmail,
              balance_eur: eurAdded,
              held_eur: 0,
              locked_price_50: lockedPrice50,
              locked_price_25: lockedPrice25,
              subscription_status: 'active',
              total_spent: 0,
            });
            console.log(`New subscription: ${payment.student_email} → ${resolvedTeacherEmail} Balance: €${eurAdded}`);
          }

          // Record pending transaction for teacher visibility
          await base44.asServiceRole.entities.WalletTransaction.create({
            teacher_email: resolvedTeacherEmail,
            teacher_name: teacher?.full_name || '',
            type: 'payment_received',
            amount: 0,
            currency: 'EUR',
            student_email: payment.student_email,
            student_name: payment.student_name || '',
            package_type: payment.package_type || '',
            lessons_count: payment.lessons_count || 1,
            status: 'pending',
            notes: `Student purchased €${eurAdded.toFixed(2)} in credits. Earnings released on lesson completion.`,
          });

          // Ensure teacher wallet exists and update pending balance
          const wallets = await base44.asServiceRole.entities.TeacherWallet.filter({ teacher_email: resolvedTeacherEmail });
          if (wallets.length === 0) {
            await base44.asServiceRole.entities.TeacherWallet.create({
              teacher_email: resolvedTeacherEmail,
              balance: 0, total_earned: 0, total_withdrawn: 0,
              pending_balance: eurAdded,
              currency: 'EUR',
            });
          } else {
            await base44.asServiceRole.entities.TeacherWallet.update(wallets[0].id, {
              pending_balance: parseFloat(((wallets[0].pending_balance || 0) + eurAdded).toFixed(2)),
            });
          }
        } else {
          console.warn(`Payment ${payment.id} completed but no teacher_email found. Student: ${payment.student_email}`);
        }

        console.log(`Payment ${payment.id} completed - ${lessonsCount} lessons to ${payment.student_email}`);
      }
    }

    // ── checkout.session.expired ──────────────────────────────────────────────
    if (event.type === 'checkout.session.expired') {
      const session = event.data.object;
      const paymentId = session.metadata?.payment_id;
      if (paymentId) {
        const payments = await base44.asServiceRole.entities.Payment.filter({ id: paymentId });
        if (payments.length > 0) {
          await base44.asServiceRole.entities.Payment.update(payments[0].id, { status: 'failed' });
        }
      }
    }

    // ── payment_intent.payment_failed (declined card) ─────────────────────────
    if (event.type === 'payment_intent.payment_failed') {
      const paymentIntent = event.data.object;
      // Find our Payment record by the Stripe session/intent ID
      const allPayments = await base44.asServiceRole.entities.Payment.filter({
        stripe_payment_intent_id: paymentIntent.id
      });
      if (allPayments.length > 0) {
        await base44.asServiceRole.entities.Payment.update(allPayments[0].id, { status: 'failed' });
        console.log(`Payment ${allPayments[0].id} marked as failed (card declined)`);
      }
    }

    // ── checkout.session.async_payment_failed ─────────────────────────────────
    if (event.type === 'checkout.session.async_payment_failed') {
      const session = event.data.object;
      const paymentId = session.metadata?.payment_id;
      if (paymentId) {
        const payments = await base44.asServiceRole.entities.Payment.filter({ id: paymentId });
        if (payments.length > 0) {
          await base44.asServiceRole.entities.Payment.update(payments[0].id, { status: 'failed' });
        }
      }
    }

    return Response.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error('Webhook error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});