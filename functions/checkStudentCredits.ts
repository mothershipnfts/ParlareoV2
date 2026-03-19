import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { lesson_price } = await req.json();

    if (!lesson_price || lesson_price <= 0) {
      return Response.json({ error: 'Invalid lesson price' }, { status: 400 });
    }

    const credits = await base44.asServiceRole.entities.CreditBalance.filter({
      student_email: user.email,
    });

    const now = new Date();
    const validCredits = credits.filter(
      c => c.amount_remaining > 0 && new Date(c.expiration_date) > now
    );
    const totalRemaining = validCredits.reduce((sum, c) => sum + c.amount_remaining, 0);

    const canAfford = totalRemaining >= lesson_price;

    return Response.json({ 
      can_afford: canAfford,
      total_remaining: totalRemaining,
      lesson_price: lesson_price,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});