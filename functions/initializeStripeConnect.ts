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

    if (user.role !== 'teacher') {
      return Response.json({ error: 'Only teachers can use Stripe Connect' }, { status: 403 });
    }

    const profiles = await base44.entities.TeacherProfile.filter({ user_email: user.email });

    if (profiles.length === 0) {
      return Response.json({ error: 'Teacher profile not found' }, { status: 404 });
    }

    const profile = profiles[0];
    let stripeAccountId = profile.stripe_connected_account_id;

    if (!stripeAccountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        email: user.email,
        capabilities: {
          transfers: { requested: true }
        },
        business_profile: {
          name: user.full_name || profile.full_name,
        }
      });

      stripeAccountId = account.id;

      await base44.entities.TeacherProfile.update(profile.id, {
        stripe_connected_account_id: stripeAccountId
      });

      console.log(`Stripe Connected Account created: ${stripeAccountId} for ${user.email}`);
    }

    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      type: 'account_onboarding',
      refresh_url: `${APP_URL}/TeacherWallet?stripe_refresh=1`,
      return_url: `${APP_URL}/TeacherWallet?stripe_success=1`
    });

    return Response.json({
      url: accountLink.url,
      account_id: stripeAccountId
    }, { status: 200 });

  } catch (error) {
    console.error('Stripe Connect error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});