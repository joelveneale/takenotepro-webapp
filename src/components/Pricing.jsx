import React, { useState } from 'react';
import { createCheckoutSession } from '../services/stripe';
import { Check, X } from 'lucide-react';
import './Pricing.css';

const Pricing = ({ user, isPro, onClose }) => {
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      await createCheckoutSession(user.uid, user.email);
    } catch (error) {
      console.error('Error upgrading:', error);
      alert('Failed to start checkout. Please try again.');
      setLoading(false);
    }
  };

  if (isPro) {
    return (
      <div className="pricing-modal">
        <div className="pricing-card">
          <button className="close-btn" onClick={onClose}>×</button>
          <div className="pro-badge">✓ Pro Member</div>
          <h2>You're all set!</h2>
          <p>You have access to all Pro features.</p>
          <button onClick={onClose} className="btn-secondary">
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pricing-modal">
      <div className="pricing-content">
        <button className="close-btn" onClick={onClose}>×</button>
        
        <div className="pricing-header">
          <h2>Upgrade to Pro</h2>
          <p>Unlock unlimited sessions, NLE exports, and more</p>
        </div>

        <div className="pricing-comparison">
          {/* Free Plan */}
          <div className="plan-card">
            <h3>Free</h3>
            <div className="price">£0</div>
            <p className="price-period">Forever</p>
            <ul className="feature-list">
              <li><Check size={18} /> 1 active session</li>
              <li><Check size={18} /> Up to 20 notes</li>
              <li><Check size={18} /> Basic PDF export</li>
              <li><X size={18} className="disabled" /> Document upload</li>
              <li><X size={18} className="disabled" /> NLE marker export</li>
              <li><X size={18} className="disabled" /> Password-protected PDFs</li>
            </ul>
          </div>

          {/* Pro Plan */}
          <div className="plan-card featured">
            <div className="popular-badge">Best Value</div>
            <h3>Pro</h3>
            <div className="price">£4.99</div>
            <p className="price-period">per year</p>
            <ul className="feature-list">
              <li><Check size={18} /> <strong>Unlimited sessions</strong></li>
              <li><Check size={18} /> <strong>Unlimited notes</strong></li>
              <li><Check size={18} /> <strong>Document upload & reference</strong></li>
              <li><Check size={18} /> <strong>NLE marker export</strong></li>
              <li><Check size={18} /> <strong>Password-protected PDFs</strong></li>
              <li><Check size={18} /> Priority support</li>
            </ul>
            <button 
              onClick={handleUpgrade}
              disabled={loading}
              className="btn-primary"
            >
              {loading ? 'Processing...' : 'Upgrade Now'}
            </button>
            <p className="money-back">7-day money-back guarantee</p>
          </div>
        </div>

        <div className="pricing-footer">
          <p>Questions? Email <a href="mailto:support@takenote.pro">support@takenote.pro</a></p>
        </div>
      </div>
    </div>
  );
};

export default Pricing;
