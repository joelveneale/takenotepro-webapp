import { loadStripe } from '@stripe/stripe-js';

// Initialize Stripe - YOU'LL NEED TO REPLACE WITH YOUR PUBLISHABLE KEY
const stripePromise = loadStripe('pk_live_51SxRqvPh0QnpAWgV4U9bHSQpVLmNRYafBuFgkQ6u8fxIDSDXm1JezhDhUe5AVpaGvDmnuoeJb9KYYBWENfST2x9Z00SeJxBh4m');

// Get API base URL (works in dev and production)
const API_BASE = import.meta.env.DEV 
  ? 'http://localhost:5173/api' 
  : '/api';

// Create checkout session for Pro subscription
export const createCheckoutSession = async (userId, email) => {
  try {
    const response = await fetch(`${API_BASE}/create-checkout-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        email,
        priceId: 'price_YOUR_PRICE_ID', // Your Stripe Price ID for £4.99/year
        successUrl: `${window.location.origin}/success`,
        cancelUrl: `${window.location.origin}/pricing`,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to create checkout session');
    }

    const { sessionId } = await response.json();
    
    // Redirect to Stripe Checkout
    const stripe = await stripePromise;
    const { error } = await stripe.redirectToCheckout({ sessionId });
    
    if (error) {
      throw new Error(error.message);
    }
  } catch (error) {
    console.error('Error creating checkout session:', error);
    throw error;
  }
};

// Create customer portal session for managing subscription
export const createPortalSession = async (customerId) => {
  try {
    const response = await fetch(`${API_BASE}/create-portal-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customerId,
        returnUrl: window.location.origin,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to create portal session');
    }

    const { url } = await response.json();
    window.location.href = url;
  } catch (error) {
    console.error('Error creating portal session:', error);
    throw error;
  }
};
