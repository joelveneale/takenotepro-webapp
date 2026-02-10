// /api/create-checkout-session.js
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body || {};
    const { userId, email, priceId, successUrl, cancelUrl } = body;

    // Log for debugging
    console.log('Checkout request body:', JSON.stringify(body));

    // Validate with specific error messages
    const missing = [];
    if (!userId) missing.push('userId');
    if (!email) missing.push('email');
    if (!priceId) missing.push('priceId');
    
    if (missing.length > 0) {
      console.error('Missing fields:', missing.join(', '));
      return res.status(400).json({ 
        error: `Missing required fields: ${missing.join(', ')}`,
        received: { userId: !!userId, email: !!email, priceId: !!priceId }
      });
    }

    const origin = process.env.FRONTEND_URL || req.headers.origin || req.headers.referer?.replace(/\/$/, '') || 'https://takenotepro.app';

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: email,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      metadata: {
        userId: userId,
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
