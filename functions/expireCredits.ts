import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const allCredits = await base44.asServiceRole.entities.CreditBalance.list();
    const now = new Date();
    let expiredCount = 0;

    for (const credit of allCredits) {
      if (new Date(credit.expiration_date) <= now && credit.amount_remaining > 0) {
        await base44.asServiceRole.entities.CreditBalance.update(credit.id, {
          amount_remaining: 0,
        });
        expiredCount++;
      }
    }

    return Response.json({ expired_count: expiredCount });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});