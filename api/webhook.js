// /api/webhook.js
// Combined webhook: updates Firestore (for web Pro status) AND links to RevenueCat (for mobile Pro status)
import Stripe from 'stripe';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const REVENUECAT_API_KEY = process.env.REVENUECAT_SECRET_KEY;

// Initialize Firebase Admin (only once)
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore();

// Link Stripe customer to RevenueCat using Firebase UID
async function linkStripeToRevenueCat(firebaseUID, stripeCustomerId) {
  if (!process.env.REVENUECAT_STRIPE_PUBLIC_KEY) {
    console.warn('REVENUECAT_STRIPE_PUBLIC_KEY not configured, skipping RevenueCat link');
    return false;
  }

  try {
    // Post the Stripe receipt/token to RevenueCat so it knows this user has a Stripe subscription
    // The receipts endpoint requires a public API key, not secret
    const response = await fetch(
      `https://api.revenuecat.com/v1/receipts`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.REVENUECAT_STRIPE_PUBLIC_KEY}`,
        },
        body: JSON.stringify({
          app_user_id: firebaseUID,
          fetch_token: stripeCustomerId,
        }),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      console.error('RevenueCat receipts API error:', response.status, text);
      return false;
    }

    console.log(`Posted Stripe receipt for Firebase UID ${firebaseUID} (Stripe customer ${stripeCustomerId}) to RevenueCat`);
    return true;
  } catch (err) {
    console.error('Error posting receipt to RevenueCat:', err);
    return false;
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};

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

  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('Missing STRIPE_WEBHOOK_SECRET');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  let event;

  try {
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  console.log(`Received event: ${event.type}`);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.firebaseUID || session.metadata?.userId;
        const customerId = session.customer;

        console.log(`Checkout completed for user: ${userId}`);

        // 1. Update Firestore (web Pro status)
        if (userId) {
          await db.collection('users').doc(userId).set({
            subscriptionTier: 'pro',
            subscriptionStatus: 'active',
            stripeCustomerId: customerId,
            updatedAt: new Date().toISOString(),
          }, { merge: true });
          console.log(`Updated user ${userId} to Pro in Firestore`);
        }

        // 2. Link to RevenueCat (mobile Pro status)
        if (userId && customerId) {
          await linkStripeToRevenueCat(userId, customerId);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        const status = subscription.status;
        const firebaseUID = subscription.metadata?.firebaseUID;

        console.log(`Subscription updated for customer: ${customerId}, status: ${status}`);

        // Find user by Stripe customer ID
        const userSnapshot = await db.collection('users')
          .where('stripeCustomerId', '==', customerId)
          .limit(1)
          .get();

        if (!userSnapshot.empty) {
          const userDoc = userSnapshot.docs[0];
          const userId = userDoc.id;
          const tier = ['active', 'trialing'].includes(status) ? 'pro' : 'free';

          await userDoc.ref.update({
            subscriptionStatus: status,
            subscriptionTier: tier,
            updatedAt: new Date().toISOString(),
          });
          console.log(`Updated user ${userId} subscription status to: ${status}, tier: ${tier}`);
        }

        // Also update RevenueCat link if we have the UID
        if (firebaseUID && customerId) {
          await linkStripeToRevenueCat(firebaseUID, customerId);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        console.log(`Subscription deleted for customer: ${customerId}`);

        const userSnapshot = await db.collection('users')
          .where('stripeCustomerId', '==', customerId)
          .limit(1)
          .get();

        if (!userSnapshot.empty) {
          const userDoc = userSnapshot.docs[0];
          const userId = userDoc.id;

          await userDoc.ref.update({
            subscriptionStatus: 'canceled',
            subscriptionTier: 'free',
            updatedAt: new Date().toISOString(),
          });
          console.log(`Reverted user ${userId} to free tier`);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const customerId = invoice.customer;

        console.log(`Payment failed for customer: ${customerId}`);

        const userSnapshot = await db.collection('users')
          .where('stripeCustomerId', '==', customerId)
          .limit(1)
          .get();

        if (!userSnapshot.empty) {
          const userDoc = userSnapshot.docs[0];
          await userDoc.ref.update({
            subscriptionStatus: 'past_due',
            lastPaymentFailed: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          console.log(`Marked user ${userDoc.id} subscription as past_due`);
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        const customerId = invoice.customer;

        console.log(`Payment succeeded for customer: ${customerId}`);

        const userSnapshot = await db.collection('users')
          .where('stripeCustomerId', '==', customerId)
          .limit(1)
          .get();

        if (!userSnapshot.empty) {
          const userDoc = userSnapshot.docs[0];
          await userDoc.ref.update({
            subscriptionStatus: 'active',
            subscriptionTier: 'pro',
            lastPaymentSucceeded: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          console.log(`Confirmed user ${userDoc.id} Pro status after successful payment`);
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('Error handling webhook:', error);
    return res.status(500).json({ error: error.message });
  }
}
