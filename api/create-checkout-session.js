// /api/create-checkout-session.js
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.body || {};
    const { userId, email, priceId, successUrl, cancelUrl } = body;

    const missing = [];
    if (!userId) missing.push('userId');
    if (!email) missing.push('email');
    if (!priceId) missing.push('priceId');
    
    if (missing.length > 0) {
      return res.status(400).json({ 
        error: `Missing required fields: ${missing.join(', ')}`,
      });
    }

    const origin = process.env.FRONTEND_URL || req.headers.origin || 'https://takenotepro.app';

    // Find or create Stripe customer with Firebase UID in metadata
    let customer;
    const existing = await stripe.customers.list({ email, limit: 1 });
    
    if (existing.data.length > 0) {
      customer = existing.data[0];
      // Ensure Firebase UID is in metadata
      if (customer.metadata.firebaseUID !== userId) {
        await stripe.customers.update(customer.id, {
          metadata: { firebaseUID: userId }
        });
      }
    } else {
      customer = await stripe.customers.create({
        email,
        metadata: { firebaseUID: userId }
      });
    }

    // Create Stripe Checkout Session with the customer
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer: customer.id,
      allow_promotion_codes: true,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      metadata: {
        userId: userId,
        firebaseUID: userId,
      },
      subscription_data: {
        metadata: {
          firebaseUID: userId,
        },
      },
      success_url: successUrl || `${origin}/?checkout=success`,
      cancel_url: cancelUrl || `${origin}/?checkout=cancelled`,
    });

    return res.status(200).json({ 
      sessionId: session.id,
      url: session.url 
    });
  } catch (error) {
    console.error('Stripe checkout error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
