// This endpoint receives webhooks from Stripe and updates Firestore
import Stripe from 'stripe';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Initialize Firebase Admin (only once)
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // Replace literal \n in the private key with actual newlines
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore();

export const config = {
  api: {
    bodyParser: false, // Stripe needs raw body for signature verification
  },
};

// Helper to get raw body
async function getRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  // Only allow POST requests
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
    // Get raw body for signature verification
    const rawBody = await getRawBody(req);
    
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  console.log(`Received event: ${event.type}`);

  try {
    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata.userId;
        const customerId = session.customer;

        console.log(`Checkout completed for user: ${userId}`);

        // Update user to Pro in Firestore
        await db.collection('users').doc(userId).update({
          subscriptionTier: 'pro',
          subscriptionStatus: 'active',
          stripeCustomerId: customerId,
          updatedAt: new Date().toISOString(),
        });

        console.log(`Updated user ${userId} to Pro`);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        const status = subscription.status;

        console.log(`Subscription updated for customer: ${customerId}, status: ${status}`);

        // Find user by Stripe customer ID
        const userSnapshot = await db.collection('users')
          .where('stripeCustomerId', '==', customerId)
          .limit(1)
          .get();

        if (!userSnapshot.empty) {
          const userDoc = userSnapshot.docs[0];
          const userId = userDoc.id;

          // Determine tier based on status
          // Active statuses keep Pro, anything else reverts to Free
          const tier = ['active', 'trialing'].includes(status) ? 'pro' : 'free';

          // Update subscription status
          await userDoc.ref.update({
            subscriptionStatus: status,
            subscriptionTier: tier,
            updatedAt: new Date().toISOString(),
          });

          console.log(`Updated user ${userId} subscription status to: ${status}, tier: ${tier}`);
        } else {
          console.warn(`No user found with stripeCustomerId: ${customerId}`);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        console.log(`Subscription deleted for customer: ${customerId}`);

        // Find user by Stripe customer ID
        const userSnapshot = await db.collection('users')
          .where('stripeCustomerId', '==', customerId)
          .limit(1)
          .get();

        if (!userSnapshot.empty) {
          const userDoc = userSnapshot.docs[0];
          const userId = userDoc.id;

          // Revert to free tier
          await userDoc.ref.update({
            subscriptionStatus: 'canceled',
            subscriptionTier: 'free',
            updatedAt: new Date().toISOString(),
          });

          console.log(`Reverted user ${userId} to free tier`);
        } else {
          console.warn(`No user found with stripeCustomerId: ${customerId}`);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const customerId = invoice.customer;

        console.log(`Payment failed for customer: ${customerId}`);

        // Find user by Stripe customer ID
        const userSnapshot = await db.collection('users')
          .where('stripeCustomerId', '==', customerId)
          .limit(1)
          .get();

        if (!userSnapshot.empty) {
          const userDoc = userSnapshot.docs[0];
          const userId = userDoc.id;

          // Update status to indicate payment issue
          // Don't immediately downgrade - Stripe will retry
          await userDoc.ref.update({
            subscriptionStatus: 'past_due',
            lastPaymentFailed: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });

          console.log(`Marked user ${userId} subscription as past_due`);
        } else {
          console.warn(`No user found with stripeCustomerId: ${customerId}`);
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        const customerId = invoice.customer;

        console.log(`Payment succeeded for customer: ${customerId}`);

        // Find user by Stripe customer ID
        const userSnapshot = await db.collection('users')
          .where('stripeCustomerId', '==', customerId)
          .limit(1)
          .get();

        if (!userSnapshot.empty) {
          const userDoc = userSnapshot.docs[0];
          const userId = userDoc.id;

          // Ensure they're active Pro
          await userDoc.ref.update({
            subscriptionStatus: 'active',
            subscriptionTier: 'pro',
            lastPaymentSucceeded: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });

          console.log(`Confirmed user ${userId} Pro status after successful payment`);
        } else {
          console.warn(`No user found with stripeCustomerId: ${customerId}`);
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    // Return 200 to acknowledge receipt
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('Error handling webhook:', error);
    return res.status(500).json({ error: error.message });
  }
}
