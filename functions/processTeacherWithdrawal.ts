import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import Stripe from 'npm:stripe@16.0.0';

const STRIPE_KEY = Deno.env.get('STRIPE_SECRET_KEY');
const stripe = STRIPE_KEY ? new Stripe(STRIPE_KEY) : null;

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

    const { amount, withdrawal_method } = await req.json();

    // Validate amount
    if (!amount || amount <= 0) {
      return Response.json({ error: 'Invalid amount' }, { status: 400 });
    }

    // Get teacher's wallet
    const wallets = await base44.entities.TeacherWallet.filter({
      teacher_email: user.email
    });

    if (wallets.length === 0) {
      return Response.json({ error: 'Wallet not found' }, { status: 404 });
    }

    const wallet = wallets[0];

    // Verify sufficient balance
    if (wallet.balance < amount) {
      return Response.json({ 
        error: 'Insufficient balance',
        available: wallet.balance 
      }, { status: 400 });
    }

    // Get teacher profile for Stripe connect account
    const profiles = await base44.entities.TeacherProfile.filter({
      user_email: user.email
    });

    if (profiles.length === 0) {
      return Response.json({ error: 'Teacher profile not found' }, { status: 404 });
    }

    const profile = profiles[0];
    const stripeAccountId = profile.stripe_connected_account_id;

    if (!stripeAccountId) {
      return Response.json({ 
        error: 'Stripe account not connected. Complete your Stripe Connect setup first.' 
      }, { status: 400 });
    }

    let transferId;

    // Process payout based on withdrawal method
    if (withdrawal_method === 'stripe') {
      if (!stripe) {
        return Response.json({ 
          error: 'Stripe not configured. Admin needs to set STRIPE_SECRET_KEY secret.' 
        }, { status: 503 });
      }

      // Create Stripe transfer to connected account (not payout)
      const transfer = await stripe.transfers.create(
        {
          amount: Math.round(amount * 100), // Convert EUR to cents
          currency: 'eur',
          destination: stripeAccountId,
          description: `Teacher withdrawal for ${user.full_name}`
        }
      );

      transferId = transfer.id;

      console.log(`✅ Stripe payout created: ${transferId} for ${user.email}`);
    } else if (withdrawal_method === 'paypal') {
      // For PayPal, create a pending withdrawal transaction
      // PayPal integration would be handled by admin manually or via their API
      console.log(`📌 PayPal withdrawal requested for ${user.email}: €${amount}`);
    } else if (withdrawal_method === 'wise') {
      // For Wise, create a pending withdrawal transaction
      // Wise integration would be handled via their API or manually
      console.log(`📌 Wise withdrawal requested for ${user.email}: €${amount}`);
    } else if (withdrawal_method === 'bank_transfer') {
      // For bank transfer, create a pending withdrawal transaction
      console.log(`📌 Bank transfer withdrawal requested for ${user.email}: €${amount}`);
    } else {
      return Response.json({ error: 'Invalid withdrawal method' }, { status: 400 });
    }

    // Create withdrawal transaction record
    const transaction = await base44.entities.WalletTransaction.create({
      teacher_email: user.email,
      teacher_name: user.full_name,
      type: 'withdrawal',
      amount,
      currency: 'EUR',
      status: withdrawal_method === 'stripe' ? 'completed' : 'pending',
      withdrawal_method,
      withdrawal_account: profile.withdrawal_account,
      notes: `Withdrawal via ${withdrawal_method}${transferId ? ` (ID: ${transferId})` : ''}`
    });

    // Update wallet: deduct balance and add to withdrawn total
    const newBalance = wallet.balance - amount;
    const newWithdrawn = wallet.total_withdrawn + amount;

    await base44.entities.TeacherWallet.update(wallet.id, {
      balance: newBalance,
      total_withdrawn: newWithdrawn
    });

    console.log(`✅ Withdrawal processed: €${amount} for ${user.email} via ${withdrawal_method}`);

    return Response.json({
      success: true,
      transaction_id: transaction.id,
      transfer_id: transferId,
      amount,
      new_balance: newBalance,
      status: withdrawal_method === 'stripe' ? 'completed' : 'pending',
      message: withdrawal_method === 'stripe' 
        ? 'Funds transferred to your Stripe account'
        : `Withdrawal request submitted. Admin will process within 2-3 business days.`
    }, { status: 200 });

  } catch (error) {
    console.error('Withdrawal processing error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});