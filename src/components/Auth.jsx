import React, { useState } from 'react';
import { signUp, signIn } from '../services/auth';
import './Auth.css';

const Auth = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isSignUp) {
        await signUp(email, password);
      } else {
        await signIn(email, password);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">
            <div className="logo-icon">⏱️</div>
            <h1>Take Note Pro</h1>
          </div>
          <p className="auth-subtitle">Professional timecode logging for film & TV</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              minLength="6"
            />
            {isSignUp && (
              <span className="form-hint">Minimum 6 characters</span>
            )}
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <button 
            type="submit" 
            className="btn-primary"
            disabled={loading}
          >
            {loading ? 'Please wait...' : (isSignUp ? 'Create Account' : 'Sign In')}
          </button>
        </form>

        <div className="auth-toggle">
          {isSignUp ? (
            <p>
              Already have an account?{' '}
              <button 
                onClick={() => {
                  setIsSignUp(false);
                  setError('');
                }}
                className="link-button"
              >
                Sign in
              </button>
            </p>
          ) : (
            <p>
              Don't have an account?{' '}
              <button 
                onClick={() => {
                  setIsSignUp(true);
                  setError('');
                }}
                className="link-button"
              >
                Create one
              </button>
            </p>
          )}
        </div>

        {!isSignUp && (
          <div className="auth-features">
            <h3>Start for free</h3>
            <ul>
              <li>✓ 1 active session</li>
              <li>✓ Up to 20 notes</li>
              <li>✓ PDF export</li>
              <li>✓ All timecode formats</li>
            </ul>
            <p className="upgrade-hint">
              Upgrade to Pro for £4.99/year for unlimited sessions, NLE exports, and more.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Auth;
