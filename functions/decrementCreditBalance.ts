import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
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

    const credits = await base44.asServiceRole.entities.CreditBalance.filter({
      student_email: user.email,
    });

    const now = new Date();
    const validCredits = credits
      .filter(c => c.amount_remaining > 0 && new Date(c.expiration_date) > now)
      .sort((a, b) => new Date(a.expiration_date) - new Date(b.expiration_date));

    let remaining = amount;

    for (const credit of validCredits) {
      if (remaining <= 0) break;

      const deduct = Math.min(remaining, credit.amount_remaining);
      const newAmount = credit.amount_remaining - deduct;

      await base44.asServiceRole.entities.CreditBalance.update(credit.id, {
        amount_remaining: newAmount,
      });

      remaining -= deduct;
    }

    if (remaining > 0) {
      return Response.json({ error: 'Insufficient credits' }, { status: 400 });
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});