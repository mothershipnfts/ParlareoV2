import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { token_balance_id, quantity } = await req.json();

    if (!token_balance_id || !quantity) {
      return Response.json({ error: 'Missing token_balance_id or quantity' }, { status: 400 });
    }

    // Fetch the token balance
    const tokenBalances = await base44.asServiceRole.entities.TokenBalance.filter({
      id: token_balance_id,
    });

    if (tokenBalances.length === 0) {
      return Response.json({ error: 'Token balance not found' }, { status: 404 });
    }

    const tokenBalance = tokenBalances[0];

    // Verify it belongs to the user
    if (tokenBalance.student_email !== user.email) {
      return Response.json({ error: 'Token balance does not belong to this user' }, { status: 403 });
    }

    // Check expiration
    const now = new Date();
    if (new Date(tokenBalance.expiration_date) <= now) {
      return Response.json({ error: 'Token balance has expired' }, { status: 400 });
    }

    // Check sufficient quantity
    if (tokenBalance.quantity_remaining < quantity) {
      return Response.json({ error: 'Insufficient tokens' }, { status: 400 });
    }

    // Decrement
    const newQuantity = tokenBalance.quantity_remaining - quantity;
    await base44.asServiceRole.entities.TokenBalance.update(token_balance_id, {
      quantity_remaining: newQuantity,
    });

    return Response.json({
      success: true,
      new_quantity: newQuantity,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});