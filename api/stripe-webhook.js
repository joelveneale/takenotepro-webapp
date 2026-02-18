// /api/stripe-webhook.js
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const REVENUECAT_API_KEY = process.env.REVENUECAT_SECRET_KEY; // RevenueCat secret API key (sk_xxx)
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

async function linkStripeToRevenueCat(firebaseUID, stripeCustomerId) {
  // Tell RevenueCat that this Firebase user has a Stripe subscription
  // This uses RevenueCat's REST API to set the Stripe customer ID as an alias
  try {
    const response = await fetch(
      `https://api.revenuecat.com/v1/subscribers/${firebaseUID}/attributes`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${REVENUECAT_API_KEY}`,
          'X-Platform': 'stripe',
        },
        body: JSON.stringify({
          attributes: {
            '$stripeCustomerId': {
              value: stripeCustomerId,
            },
          },
        }),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      console.error('RevenueCat API error:', response.status, text);
      return false;
    }

    console.log(`Linked Firebase UID ${firebaseUID} to Stripe customer ${stripeCustomerId} in RevenueCat`);
    return true;
  } catch (err) {
    console.error('Error linking to RevenueCat:', err);
    return false;
  }
}

export const config = {
  api: {
    bodyParser: false, // Need raw body for Stripe signature verification
  },
};

// Read raw body for signature verification
async function getRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let event;

  try {
    const rawBody = await getRawBody(req);

    // Verify webhook signature if secret is configured
    if (STRIPE_WEBHOOK_SECRET) {
      const sig = req.headers['stripe-signature'];
      event = stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET);
    } else {
      event = JSON.parse(rawBody.toString());
    }
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: 'Webhook signature verification failed' });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const firebaseUID = session.metadata?.firebaseUID || session.metadata?.userId;
        const stripeCustomerId = session.customer;

        if (firebaseUID && stripeCustomerId) {
          await linkStripeToRevenueCat(firebaseUID, stripeCustomerId);
        } else {
          console.warn('Missing firebaseUID or stripeCustomerId in checkout session');
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const firebaseUID = subscription.metadata?.firebaseUID;
        const stripeCustomerId = subscription.customer;

        if (firebaseUID && stripeCustomerId) {
          await linkStripeToRevenueCat(firebaseUID, stripeCustomerId);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        // RevenueCat handles this automatically via its own Stripe webhook
        // No action needed here
        console.log('Subscription cancelled:', event.data.object.id);
        break;
      }
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook handler error:', err);
    return res.status(500).json({ error: 'Webhook handler failed' });
  }
}
