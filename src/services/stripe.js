import { loadStripe } from '@stripe/stripe-js';

// Initialize Stripe - YOU'LL NEED TO REPLACE WITH YOUR PUBLISHABLE KEY
const stripePromise = loadStripe('pk_test_51SxRr3PYNFrWcU67K18Hs8ePRdXoX2oAihPXSeDkoLeUJ3eapPIoW9SR46Pwxz3sa1Px2jRTY0mVJPu31OD8vj1J00xLjeHURb');

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
        priceId: 'price_1SxRvePYNFrWcU67UwPjTSkR', // Your Stripe Price ID for £4.99/year
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
