import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // This is a scheduled function - verify admin or service role
    if (user && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Fetch all token balances
    const allTokens = await base44.asServiceRole.entities.TokenBalance.list();

    const now = new Date();
    const expiredTokens = allTokens.filter(
      t => new Date(t.expiration_date) <= now && t.quantity_remaining > 0
    );

    // Set expired tokens to 0
    for (const token of expiredTokens) {
      await base44.asServiceRole.entities.TokenBalance.update(token.id, {
        quantity_remaining: 0,
      });
    }

    return Response.json({
      success: true,
      expired_count: expiredTokens.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});