// /api/create-portal-session.js
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
    const { email } = req.body || {};

    if (!email) {
      return res.status(400).json({ error: 'Missing required field: email' });
    }

    // Find the Stripe customer by email
    const customers = await stripe.customers.list({ email, limit: 1 });

    if (customers.data.length === 0) {
      return res.status(404).json({ error: 'No subscription found for this email' });
    }

    const customerId = customers.data[0].id;
    const origin = process.env.FRONTEND_URL || req.headers.origin || req.headers.referer?.replace(/\/$/, '') || 'https://takenotepro.app';

    // Create a Stripe Customer Portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: origin,
    });

    return res.status(200).json({ url: portalSession.url });
  } catch (error) {
    console.error('Portal session error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
