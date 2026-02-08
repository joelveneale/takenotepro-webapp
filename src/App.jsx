import React, { useState } from 'react';
import { useAuth } from './hooks/useAuth';
import TakeNotePro from './components/TakeNotePro';

// ─── AUTH SCREEN ──────────────────────────────────────────────────────────────

const AuthScreen = ({ onLogin, onSignup, error, loading }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e?.preventDefault?.();
    if (isLogin) onLogin(email, password);
    else onSignup(email, password);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #0a0a0b 0%, #121214 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
      padding: '20px'
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&display=swap" rel="stylesheet" />

      <div style={{ maxWidth: '380px', width: '100%' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '12px', margin: '0 auto 16px',
            background: 'linear-gradient(145deg, #00ff88, #00cc6a)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '20px', fontWeight: '700', color: '#000'
          }}>TN</div>
          <h1 style={{
            fontSize: '22px', fontWeight: '700', fontFamily: "'Outfit', sans-serif",
            color: '#fff', margin: '0 0 4px 0', letterSpacing: '-0.02em'
          }}>
            Take Note <span style={{ color: '#00ff88' }}>Pro</span>
          </h1>
          <p style={{ fontSize: '12px', color: '#666', margin: 0 }}>
            Professional timecode logging for film &amp; TV
          </p>
        </div>

        {/* Auth form */}
        <div style={{
          background: '#1a1a1e', border: '1px solid #2a2a2e', borderRadius: '12px', padding: '24px'
        }}>
          <div style={{
            display: 'flex', gap: '2px', marginBottom: '20px',
            background: '#141416', padding: '3px', borderRadius: '6px'
          }}>
            {['Login', 'Sign Up'].map((label, i) => (
              <button key={label} onClick={() => setIsLogin(i === 0)} style={{
                flex: 1, padding: '10px', fontSize: '12px', fontWeight: '600',
                fontFamily: 'inherit', border: 'none', borderRadius: '4px', cursor: 'pointer',
                background: (i === 0 ? isLogin : !isLogin) ? '#2a2a2e' : 'transparent',
                color: (i === 0 ? isLogin : !isLogin) ? '#fff' : '#666'
              }}>{label}</button>
            ))}
          </div>

          {error && (
            <div style={{
              background: 'rgba(255,68,68,0.1)', border: '1px solid #ff4444',
              borderRadius: '6px', padding: '10px 12px', marginBottom: '16px',
              fontSize: '12px', color: '#ff6666', textAlign: 'center'
            }}>{error}</div>
          )}

          <div>
            <label style={{
              display: 'block', fontSize: '10px', fontWeight: '600', letterSpacing: '0.15em',
              textTransform: 'uppercase', color: '#666', marginBottom: '6px'
            }}>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com" style={{
                width: '100%', padding: '12px', fontSize: '14px', fontFamily: 'inherit',
                background: '#141416', border: '1px solid #333', borderRadius: '6px',
                color: '#e8e8e8', outline: 'none', boxSizing: 'border-box', marginBottom: '12px'
              }} />

            <label style={{
              display: 'block', fontSize: '10px', fontWeight: '600', letterSpacing: '0.15em',
              textTransform: 'uppercase', color: '#666', marginBottom: '6px'
            }}>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(e); }}
              style={{
                width: '100%', padding: '12px', fontSize: '14px', fontFamily: 'inherit',
                background: '#141416', border: '1px solid #333', borderRadius: '6px',
                color: '#e8e8e8', outline: 'none', boxSizing: 'border-box', marginBottom: '20px'
              }} />

            <button onClick={handleSubmit} disabled={loading || !email || !password} style={{
              width: '100%', padding: '14px', fontSize: '13px', fontWeight: '600',
              letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'inherit',
              background: loading ? '#333' : 'linear-gradient(180deg, #00ff88 0%, #00cc6a 100%)',
              color: '#000', border: 'none', borderRadius: '6px',
              cursor: loading ? 'wait' : 'pointer', opacity: (!email || !password) ? 0.5 : 1
            }}>
              {loading ? 'Please wait...' : isLogin ? 'Login' : 'Create Account'}
            </button>
          </div>
        </div>

        <p style={{ textAlign: 'center', fontSize: '11px', color: '#444', marginTop: '16px' }}>
          Free tier: 1 session, 20 notes • Pro: £4.99/year unlimited
        </p>
      </div>
    </div>
  );
};

// ─── PRICING MODAL ────────────────────────────────────────────────────────────

const PricingModal = ({ onClose, onCheckout, loading }) => (
  <div style={{
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center',
    justifyContent: 'center', padding: '20px', zIndex: 3000,
    fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace"
  }}>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&display=swap" rel="stylesheet" />
    <div style={{
      background: '#1a1a1e', border: '1px solid #333', borderRadius: '16px',
      padding: '32px', maxWidth: '420px', width: '100%'
    }}>
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '700', fontFamily: "'Outfit', sans-serif", color: '#fff', margin: '0 0 8px 0' }}>
          Upgrade to <span style={{ color: '#00ff88' }}>Pro</span>
        </h2>
        <p style={{ fontSize: '12px', color: '#888', margin: 0 }}>Unlock the full power of Take Note Pro</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
        {[
          { feature: 'Sessions', free: '1', pro: 'Unlimited' },
          { feature: 'Notes per session', free: '20', pro: 'Unlimited' },
          { feature: 'Mic list & metadata', free: '✓', pro: '✓' },
          { feature: 'CSV export', free: '✓', pro: '✓' },
          { feature: 'NLE exports', free: '✗', pro: '✓' },
          { feature: 'Document uploads', free: '✗', pro: '✓' },
          { feature: 'Cloud sync', free: '✗', pro: '✓' },
        ].map(row => (
          <div key={row.feature} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '6px 0', borderBottom: '1px solid #2a2a2e'
          }}>
            <span style={{ fontSize: '12px', color: '#ccc' }}>{row.feature}</span>
            <div style={{ display: 'flex', gap: '20px' }}>
              <span style={{ fontSize: '11px', color: '#666', width: '55px', textAlign: 'center' }}>{row.free}</span>
              <span style={{ fontSize: '11px', color: '#00ff88', width: '55px', textAlign: 'center', fontWeight: '600' }}>{row.pro}</span>
            </div>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '20px', padding: '4px 0' }}>
          <span style={{ fontSize: '9px', color: '#555', width: '55px', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Free</span>
          <span style={{ fontSize: '9px', color: '#00ff88', width: '55px', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Pro</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <button onClick={onCheckout} disabled={loading} style={{
          width: '100%', padding: '16px', fontSize: '14px', fontWeight: '700',
          fontFamily: "'Outfit', sans-serif", border: 'none', borderRadius: '8px',
          background: loading ? '#333' : 'linear-gradient(180deg, #00ff88 0%, #00cc6a 100%)',
          color: '#000', cursor: loading ? 'wait' : 'pointer'
        }}>
          {loading ? 'Redirecting to checkout...' : 'Upgrade — £4.99/year'}
        </button>
        <button onClick={onClose} style={{
          width: '100%', padding: '12px', fontSize: '12px', fontWeight: '600',
          fontFamily: 'inherit', background: 'transparent', color: '#888',
          border: '1px solid #444', borderRadius: '6px', cursor: 'pointer'
        }}>Maybe Later</button>
      </div>
    </div>
  </div>
);

// ─── MAIN APP ─────────────────────────────────────────────────────────────────

const App = () => {
  const { user, isPro, loading, error, login, signup, logout } = useAuth();
  const [showPricing, setShowPricing] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const handleCheckout = async () => {
    if (!user) return;
    setCheckoutLoading(true);
    try {
      // Call your backend API to create a Stripe Checkout session
      // Replace this URL with your actual deployed backend endpoint
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          email: user.email,
          priceId: price_1SxRvePYNFrWcU67UwPjTSkR
        })
      });
      const data = await response.json();

      if (data.url) {
        // Redirect to Stripe Checkout
        window.location.href = data.url;
      } else {
        alert('Error creating checkout session. Please try again.');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      alert('Error connecting to payment service. Please try again.');
    } finally {
      setCheckoutLoading(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(180deg, #0a0a0b 0%, #121214 100%)', color: '#00ff88',
        fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace"
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '28px', marginBottom: '12px' }}>⏱</div>
          <div style={{ fontSize: '14px' }}>Loading...</div>
        </div>
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return <AuthScreen onLogin={login} onSignup={signup} error={error} loading={loading} />;
  }

  // Logged in — show the app
  return (
    <>
      <TakeNotePro
        user={user}
        isPro={isPro}
        onShowPricing={() => setShowPricing(true)}
        onLogout={logout}
      />
      {showPricing && (
        <PricingModal
          onClose={() => setShowPricing(false)}
          onCheckout={handleCheckout}
          loading={checkoutLoading}
        />
      )}
    </>
  );
};

export default App;
