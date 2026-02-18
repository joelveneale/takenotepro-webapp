// /api/check-subscription.js
// Web app calls this to check if a user has an active Pro subscription
// This checks RevenueCat (which knows about both Stripe AND App Store subscriptions)

const REVENUECAT_API_KEY = process.env.REVENUECAT_SECRET_KEY;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { userId } = req.body || {};

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' });
    }

    // Check RevenueCat for this user's entitlements
    const response = await fetch(
      `https://api.revenuecat.com/v1/subscribers/${userId}`,
      {
        headers: {
          'Authorization': `Bearer ${REVENUECAT_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      // User not found in RevenueCat — not subscribed
      if (response.status === 404) {
        return res.status(200).json({ isPro: false, source: null });
      }
      throw new Error(`RevenueCat API error: ${response.status}`);
    }

    const data = await response.json();
    const entitlements = data.subscriber?.entitlements || {};
    const proEntitlement = entitlements.pro;

    if (proEntitlement && new Date(proEntitlement.expires_date) > new Date()) {
      return res.status(200).json({
        isPro: true,
        source: proEntitlement.product_identifier,
        expiresDate: proEntitlement.expires_date,
      });
    }

    return res.status(200).json({ isPro: false, source: null });
  } catch (error) {
    console.error('Check subscription error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
