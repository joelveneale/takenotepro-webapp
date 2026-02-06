import React, { useState } from 'react';
import { useAuth } from './hooks/useAuth';
import Auth from './components/Auth';
import Pricing from './components/Pricing';
import { createPortalSession } from './services/stripe';
import './App.css';

// TODO: Import TakeNotePro component once we integrate it
// import TakeNotePro from './components/TakeNotePro';

function App() {
  const { user, subscription, isPro, loading } = useAuth();
  const [showPricing, setShowPricing] = useState(false);
  const [managingSubscription, setManagingSubscription] = useState(false);

  const handleManageSubscription = async () => {
    if (!subscription?.stripeCustomerId) {
      alert('No subscription found');
      return;
    }

    setManagingSubscription(true);
    try {
      await createPortalSession(subscription.stripeCustomerId);
    } catch (error) {
      console.error('Error opening portal:', error);
      alert('Failed to open subscription portal. Please try again.');
      setManagingSubscription(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  // Not logged in - show auth
  if (!user) {
    return <Auth />;
  }

  // Logged in - show pricing modal if requested
  return (
    <div className="app-container">
      {/* TODO: Replace this placeholder with actual TakeNotePro component */}
      <div className="app-placeholder">
        <div className="placeholder-content">
          <h1>🎉 You're logged in!</h1>
          <p>Email: {user.email}</p>
          <p>Status: {isPro ? '✓ Pro Member' : 'Free Tier'}</p>
          
          {!isPro && (
            <button 
              onClick={() => setShowPricing(true)}
              className="btn-upgrade"
            >
              Upgrade to Pro - £4.99/year
            </button>
          )}

          {isPro && (
            <button 
              onClick={handleManageSubscription}
              disabled={managingSubscription}
              className="btn-manage"
            >
              {managingSubscription ? 'Opening...' : 'Manage Subscription'}
            </button>
          )}

          <div className="placeholder-note">
            <p><strong>Next step:</strong> Integrate the Take Note Pro app component here.</p>
            <p>The authentication and subscription system is ready!</p>
          </div>

          <button 
            onClick={async () => {
              const { logOut } = await import('./services/auth');
              await logOut();
            }}
            className="btn-logout"
          >
            Sign Out
          </button>
        </div>
      </div>

      {showPricing && (
        <Pricing 
          user={user}
          isPro={isPro}
          onClose={() => setShowPricing(false)}
        />
      )}
    </div>
  );
}

export default App;
