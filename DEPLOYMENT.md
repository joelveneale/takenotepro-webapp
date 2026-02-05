# 🚀 Deployment Guide - Vercel

Complete guide to deploy Take Note Pro to Vercel with backend functions.

---

## Prerequisites

✅ Firebase project set up (see main README.md)
✅ Stripe account created (see main README.md)
✅ Code pushed to GitHub
✅ Vercel account (free tier is fine)

---

## Step 1: Deploy to Vercel

### Option A: Deploy via Vercel Dashboard (Easiest)

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click **"Add New..."** → **"Project"**
3. Import your `takenotepro-webapp` repository
4. Vercel auto-detects Vite settings:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Click **"Deploy"** (don't add env vars yet, we'll do that next)

### Option B: Deploy via CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel

# Deploy to production
vercel --prod
```

---

## Step 2: Get Firebase Service Account Key

You need this for the webhook to update Firestore.

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Click gear icon ⚙️ → **Project Settings**
4. Go to **Service Accounts** tab
5. Click **"Generate New Private Key"**
6. Save the JSON file (keep it secret!)

Open the JSON file and note these values:
- `project_id`
- `client_email`
- `private_key` (the entire key including `-----BEGIN PRIVATE KEY-----`)

---

## Step 3: Add Environment Variables to Vercel

Go to your project in Vercel → **Settings** → **Environment Variables**

Add these **Production** variables:

### Stripe Variables

| Name | Value | Example |
|------|-------|---------|
| `STRIPE_SECRET_KEY` | Your Stripe secret key | `sk_test_51Abc...` or `sk_live_51Abc...` |
| `STRIPE_WEBHOOK_SECRET` | Leave blank for now | We'll add this after creating webhook |

### Firebase Variables

| Name | Value | Example |
|------|-------|---------|
| `FIREBASE_PROJECT_ID` | From service account JSON | `takenotepro-12345` |
| `FIREBASE_CLIENT_EMAIL` | From service account JSON | `firebase-adminsdk-xxxxx@takenotepro.iam.gserviceaccount.com` |
| `FIREBASE_PRIVATE_KEY` | From service account JSON | `-----BEGIN PRIVATE KEY-----\nMIIE...` |

⚠️ **Important for `FIREBASE_PRIVATE_KEY`:**
- Copy the ENTIRE private key including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`
- Make sure newlines (`\n`) are preserved
- Wrap in double quotes in Vercel

### Frontend URL

| Name | Value | Example |
|------|-------|---------|
| `FRONTEND_URL` | Your Vercel deployment URL | `https://takenotepro.vercel.app` |

Click **"Save"** after adding all variables.

---

## Step 4: Redeploy

After adding environment variables, trigger a new deployment:

1. Go to **Deployments** tab
2. Click the three dots **"..."** on the latest deployment
3. Click **"Redeploy"**

Or push a new commit to trigger automatic redeployment.

---

## Step 5: Set Up Stripe Webhook

Now that your backend is deployed, set up the webhook:

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/)
2. Click **Developers** → **Webhooks**
3. Click **"Add endpoint"**
4. Fill in:
   - **Endpoint URL**: `https://YOUR_VERCEL_URL/api/webhook`
     - Example: `https://takenotepro.vercel.app/api/webhook`
   - **Description**: "Production webhook"
   - **Events to send**:
     - `checkout.session.completed`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
5. Click **"Add endpoint"**
6. Copy the **Signing secret** (starts with `whsec_...`)

### Add Webhook Secret to Vercel

1. Go back to Vercel → **Settings** → **Environment Variables**
2. Add:
   - **Name**: `STRIPE_WEBHOOK_SECRET`
   - **Value**: `whsec_...` (the signing secret you just copied)
3. Click **"Save"**
4. Redeploy again (Deployments tab → Redeploy)

---

## Step 6: Update Frontend Config

Update these files with your actual values:

### `src/services/firebase.js`
Replace the `firebaseConfig` object with your Firebase config.

### `src/services/stripe.js`
Replace:
- `pk_test_YOUR_PUBLISHABLE_KEY` → Your Stripe publishable key
- `price_YOUR_PRICE_ID` → Your Stripe Price ID (£4.99/year product)

Push these changes to GitHub → Vercel auto-deploys.

---

## Step 7: Connect Custom Domain

1. In Vercel project → **Settings** → **Domains**
2. Add domain: `takenotepro.app`
3. Add `www.takenotepro.app` (optional, will redirect to non-www)

### Update DNS at Your Domain Registrar

Add these DNS records:

```
Type: A
Name: @
Value: 76.76.21.21

Type: CNAME  
Name: www
Value: cname.vercel-dns.com
```

Wait 5-60 minutes for DNS propagation.

### Update Environment Variable

Once domain is connected, update `FRONTEND_URL`:
1. Vercel → **Settings** → **Environment Variables**
2. Edit `FRONTEND_URL` → Change to `https://takenotepro.app`
3. Redeploy

---

## Step 8: Test Everything

### Test Authentication
1. Go to `https://takenotepro.app`
2. Sign up with test email
3. Check Firebase Console → Users (should see new user)

### Test Stripe Checkout
1. Log in to your app
2. Click "Upgrade to Pro"
3. Use Stripe test card: `4242 4242 4242 4242`
   - Expiry: Any future date
   - CVC: Any 3 digits
   - ZIP: Any 5 digits
4. Complete checkout
5. You should be redirected back and now have Pro status
6. Check Firestore → users → your user doc → should show `subscriptionTier: "pro"`

### Test Webhook (Most Important!)
1. Go to Stripe Dashboard → **Webhooks** → Your webhook
2. Click **"Send test webhook"**
3. Select `checkout.session.completed`
4. Check the webhook logs in Stripe (should show 200 success)
5. Check Vercel logs: Functions → webhook → Should see logs

---

## Troubleshooting

### Webhook Returns 500 Error
- Check Vercel Function logs
- Verify `FIREBASE_PRIVATE_KEY` has proper newlines (`\n`)
- Make sure all Firebase env vars are set correctly

### User Pays But Doesn't Get Pro
- Check Stripe webhook logs for errors
- Check Vercel Function logs for `/api/webhook`
- Verify webhook is sending to correct URL
- Make sure `STRIPE_WEBHOOK_SECRET` matches Stripe dashboard

### Can't Create Checkout Session
- Check browser console for errors
- Verify `STRIPE_SECRET_KEY` is set in Vercel
- Check Vercel Function logs for `/api/create-checkout-session`

### View Logs
- Vercel Dashboard → Your Project → **Functions** tab
- Click on any function to see real-time logs

---

## Production Checklist

Before going live with real payments:

- [ ] Switch Stripe to **Live Mode** (not Test Mode)
- [ ] Update `STRIPE_SECRET_KEY` to live key (`sk_live_...`)
- [ ] Update publishable key in `stripe.js` to live key (`pk_live_...`)
- [ ] Create new webhook endpoint for live mode
- [ ] Update `STRIPE_WEBHOOK_SECRET` with live webhook secret
- [ ] Test with real credit card (your own)
- [ ] Set up Stripe email receipts
- [ ] Configure Firebase security rules for production

---

## Environment Variables Summary

```bash
# Production Environment Variables in Vercel
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
FIREBASE_PROJECT_ID=takenotepro-12345
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"
FRONTEND_URL=https://takenotepro.app
```

---

## You're Live! 🎉

Your app is now deployed with:
- ✅ Authentication
- ✅ Stripe payments
- ✅ Webhook automation
- ✅ Custom domain

Users can sign up, subscribe, and get instant Pro access!
