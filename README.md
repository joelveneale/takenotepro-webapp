# Take Note Pro - Web App

Professional timecode logging app with authentication and Pro subscriptions.

## 🚀 Quick Start

```bash
npm install
npm run dev
```

---

## 🔧 Setup Guide

### 1. Firebase Setup

#### Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" → Name it "takenotepro"
3. Disable Google Analytics (optional)
4. Click "Create project"

#### Enable Authentication
1. In Firebase Console → **Authentication** → **Get Started**
2. Enable **Email/Password** sign-in method
3. Save

#### Create Firestore Database
1. In Firebase Console → **Firestore Database** → **Create database**
2. Start in **Production mode**
3. Choose location (europe-west2 for UK)
4. Click "Enable"

#### Set Firestore Rules
Go to **Firestore → Rules** and paste:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only read/write their own user document
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Users can only read/write their own sessions
    match /sessions/{sessionId} {
      allow read, write: if request.auth != null && resource.data.userId == request.auth.uid;
    }
  }
}
```

#### Get Firebase Config
1. Project Settings (gear icon) → **General**
2. Under "Your apps" → Click **Web** icon (</>)
3. Register app name: "Take Note Pro Web"
4. Copy the `firebaseConfig` object
5. Paste into `src/services/firebase.js`

---

### 2. Stripe Setup

#### Create Stripe Account
1. Go to [Stripe Dashboard](https://dashboard.stripe.com/)
2. Create account or sign in
3. Activate account (may need to verify business details)

#### Create Product & Price
1. **Products** → **Add product**
   - Name: "Take Note Pro - Pro Subscription"
   - Description: "Unlimited sessions, NLE exports, documents"
   - Pricing: **£4.99 / year** (GBP, recurring)
   - Click "Save product"
2. Copy the **Price ID** (starts with `price_...`)

#### Get API Keys
1. **Developers** → **API keys**
2. Copy **Publishable key** (starts with `pk_test_...`)
3. Paste into `src/services/stripe.js`
4. Copy **Secret key** (starts with `sk_test_...`) - Save for backend

#### Create Webhook (for production)
1. **Developers** → **Webhooks** → **Add endpoint**
2. Endpoint URL: `https://YOUR_BACKEND_URL/webhook`
3. Events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copy **Signing secret** (starts with `whsec_...`)

---

### 3. Backend Setup (Serverless Functions)

You'll need a backend to:
- Create Stripe Checkout sessions
- Handle Stripe webhooks
- Update Firestore when subscriptions change

**Recommended: Vercel Serverless Functions**

Create `/api/create-checkout-session.js`:

\`\`\`javascript
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, email, priceId, successUrl, cancelUrl } = req.body;

  try {
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
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    res.status(200).json({ sessionId: session.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
\`\`\`

Create `/api/webhook.js`:

\`\`\`javascript
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).json({ error: \`Webhook Error: \${err.message}\` });
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object;
      const userId = session.metadata.userId;
      
      // Update user to Pro
      await db.collection('users').doc(userId).update({
        subscriptionTier: 'pro',
        subscriptionStatus: 'active',
        stripeCustomerId: session.customer,
        updatedAt: new Date().toISOString(),
      });
      break;

    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      const subscription = event.data.object;
      const customerId = subscription.customer;
      
      // Find user by Stripe customer ID
      const userSnapshot = await db.collection('users')
        .where('stripeCustomerId', '==', customerId)
        .limit(1)
        .get();
      
      if (!userSnapshot.empty) {
        const userDoc = userSnapshot.docs[0];
        await userDoc.ref.update({
          subscriptionStatus: subscription.status,
          subscriptionTier: subscription.status === 'active' ? 'pro' : 'free',
          updatedAt: new Date().toISOString(),
        });
      }
      break;
  }

  res.status(200).json({ received: true });
}
\`\`\`

**Environment Variables (Vercel):**
\`\`\`
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account@...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
\`\`\`

---

### 4. Update Service Files

**src/services/stripe.js:**
- Replace `pk_test_YOUR_PUBLISHABLE_KEY` with your actual Stripe publishable key
- Replace `price_YOUR_PRICE_ID` with your actual Stripe Price ID
- Replace `YOUR_BACKEND_URL` with your Vercel deployment URL

**src/services/firebase.js:**
- Paste your Firebase config object

---

## 📁 Project Structure

\`\`\`
takenotepro-webapp/
├── src/
│   ├── components/
│   │   ├── Auth.jsx              # Sign up / Login
│   │   ├── Auth.css
│   │   ├── Pricing.jsx           # Upgrade to Pro modal
│   │   ├── Pricing.css
│   │   └── TakeNotePro.jsx       # Main app (TO BE ADDED)
│   ├── services/
│   │   ├── firebase.js           # Firebase config & init
│   │   ├── auth.js               # Auth functions
│   │   └── stripe.js             # Stripe checkout
│   ├── hooks/
│   │   └── useAuth.js            # Auth state management
│   ├── App.jsx                   # Root component
│   └── main.jsx                  # Entry point
├── api/                          # Serverless functions
│   ├── create-checkout-session.js
│   └── webhook.js
└── package.json
\`\`\`

---

## 🎯 Features

### Free Tier
- 1 active session
- Up to 20 notes per session
- Basic PDF export
- All timecode formats

### Pro Tier (£4.99/year)
- Unlimited sessions
- Unlimited notes
- Document upload & reference
- NLE marker export (EDL, FCPXML, TSV, ALE)
- Password-protected PDFs
- Priority support

---

## 🚢 Deployment

### Deploy to Vercel

\`\`\`bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Add environment variables in Vercel dashboard
# Then deploy to production
vercel --prod
\`\`\`

### Connect Domain
1. Vercel dashboard → Settings → Domains
2. Add `takenotepro.app`
3. Update DNS at your registrar

---

## 🔐 Security Notes

- Never commit API keys or secrets to git
- Use environment variables for all sensitive data
- Keep Firebase rules restrictive (users can only access their own data)
- Validate Stripe webhooks with signature verification

---

## 📞 Support

- Email: support@takenote.pro
- Issues: GitHub Issues

---

## 🎉 Next Steps

1. Complete Firebase setup
2. Complete Stripe setup
3. Deploy backend functions to Vercel
4. Test subscription flow end-to-end
5. Deploy to production at `takenotepro.app`

Ready to integrate the actual Take Note Pro app next!
