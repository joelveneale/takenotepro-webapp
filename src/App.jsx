import React, { useState } from 'react';
import { useAuth } from './hooks/useAuth';
import Auth from './components/Auth';
import Pricing from './components/Pricing';
import TakeNotePro from './components/TakeNotePro';
import { createPortalSession } from './services/stripe';
import './App.css';

function App() {
  const { user, subscription, isPro, loading } = useAuth();
  const [showPricing, setShowPricing] = useState(false);

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

  // Logged in - show the app
  return (
    <div className="app-container">
      <TakeNotePro 
        user={user}
        isPro={isPro}
        onShowPricing={() => setShowPricing(true)}
      />

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
