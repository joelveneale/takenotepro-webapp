// This endpoint creates a Stripe Checkout session for Pro subscription
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, email, priceId, successUrl, cancelUrl } = req.body;

  // Validate required fields
  if (!userId || !email || !priceId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
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
      // Store userId in metadata so we can identify the user in webhook
      metadata: {
        userId: userId,
      },
      success_url: successUrl || `${process.env.FRONTEND_URL}/success`,
      cancel_url: cancelUrl || `${process.env.FRONTEND_URL}/pricing`,
    });

    return res.status(200).json({ sessionId: session.id });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return res.status(500).json({ error: error.message });
  }
}
