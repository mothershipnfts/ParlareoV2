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

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin only' }, { status: 403 });
    }

    const { amount, withdrawal_method, withdrawal_account } = await req.json();

    if (!amount || amount <= 0) {
      return Response.json({ error: 'Invalid amount' }, { status: 400 });
    }

    // Sum up admin commissions to verify available balance
    const commissions = await base44.asServiceRole.entities.AdminCommission.list();
    const totalEarned = commissions.reduce((s, c) => s + (c.commission_amount || 0), 0);

    // Get total already withdrawn by admin
    const withdrawals = await base44.asServiceRole.entities.WalletTransaction.filter({ type: 'admin_withdrawal' });
    const totalWithdrawn = withdrawals
      .filter(w => w.status === 'completed')
      .reduce((s, w) => s + (w.amount || 0), 0);

    const available = parseFloat((totalEarned - totalWithdrawn).toFixed(2));

    if (amount > available) {
      return Response.json({ error: `Insufficient admin balance. Available: €${available.toFixed(2)}` }, { status: 400 });
    }

    let transferNote = '';

    // For Stripe payouts to admin's own bank account via Stripe payout API
    if (withdrawal_method === 'stripe') {
      const payout = await stripe.payouts.create({
        amount: Math.round(amount * 100),
        currency: 'eur',
        description: `Admin withdrawal by ${user.email}`,
      });
      transferNote = ` (Stripe payout ID: ${payout.id})`;
      console.log(`Admin Stripe payout created: ${payout.id}`);
    }

    // Record the withdrawal
    await base44.asServiceRole.entities.WalletTransaction.create({
      teacher_email: user.email,
      teacher_name: user.full_name || 'Admin',
      type: 'admin_withdrawal',
      amount,
      currency: 'EUR',
      status: withdrawal_method === 'stripe' ? 'completed' : 'pending',
      withdrawal_method,
      withdrawal_account: withdrawal_account || '',
      notes: `Admin withdrawal via ${withdrawal_method}${transferNote}`,
    });

    return Response.json({
      success: true,
      amount,
      new_available: parseFloat((available - amount).toFixed(2)),
      status: withdrawal_method === 'stripe' ? 'completed' : 'pending',
      message: withdrawal_method === 'stripe'
        ? 'Funds transferred to your Stripe account'
        : 'Withdrawal request recorded. Process manually.',
    });
  } catch (error) {
    console.error('Admin withdrawal error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});