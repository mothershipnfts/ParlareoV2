import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { duration_minutes } = await req.json();

    if (!duration_minutes || ![25, 50].includes(duration_minutes)) {
      return Response.json({ error: 'Invalid duration' }, { status: 400 });
    }

    // Find valid token balances (not expired, quantity > 0)
    const tokenBalances = await base44.asServiceRole.entities.TokenBalance.filter({
      student_email: user.email,
      duration_minutes,
    });

    const now = new Date();
    const validTokens = tokenBalances.filter(
      t => t.quantity_remaining > 0 && new Date(t.expiration_date) > now
    );

    if (validTokens.length === 0) {
      return Response.json({
        has_tokens: false,
        remaining: 0,
      });
    }

    // Return total remaining valid tokens
    const totalRemaining = validTokens.reduce((sum, t) => sum + t.quantity_remaining, 0);

    return Response.json({
      has_tokens: true,
      remaining: totalRemaining,
      token_id: validTokens[0].id, // Use the first valid balance for decrement
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});