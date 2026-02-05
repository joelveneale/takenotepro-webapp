// This endpoint creates a Stripe Customer Portal session
// Users can manage their subscription (cancel, update payment method, etc.)
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { customerId, returnUrl } = req.body;

  // Validate required fields
  if (!customerId) {
    return res.status(400).json({ error: 'Missing customer ID' });
  }

  try {
    // Create Customer Portal Session
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl || process.env.FRONTEND_URL,
    });

    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('Error creating portal session:', error);
    return res.status(500).json({ error: error.message });
  }
}
