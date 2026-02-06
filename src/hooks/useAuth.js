import { useState, useEffect } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../services/firebase';

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [isPro, setIsPro] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Listen to auth state changes
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        // Subscribe to user document for real-time Pro status
        const userDocRef = doc(db, 'users', firebaseUser.uid);

        // Create user document if it doesn't exist
        const userDoc = await getDoc(userDocRef);
        if (!userDoc.exists()) {
          await setDoc(userDocRef, {
            email: firebaseUser.email,
            createdAt: new Date().toISOString(),
            tier: 'free',
            stripeCustomerId: null,
            subscriptionId: null,
            subscriptionStatus: null
          });
        }

        // Real-time listener for subscription changes (webhook updates this)
        const unsubSnapshot = onSnapshot(userDocRef, (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            setIsPro(
              data.tier === 'pro' ||
              data.subscriptionStatus === 'active' ||
              data.subscriptionStatus === 'trialing'
            );
          }
        });

        setLoading(false);
        return () => unsubSnapshot();
      } else {
        setUser(null);
        setIsPro(false);
        setLoading(false);
      }
    });

    return () => unsubAuth();
  }, []);

  const login = async (email, password) => {
    setError(null);
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError(formatAuthError(err.code));
      setLoading(false);
    }
  };

  const signup = async (email, password) => {
    setError(null);
    setLoading(true);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError(formatAuthError(err.code));
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  return { user, isPro, loading, error, login, signup, logout };
};

// User-friendly error messages
function formatAuthError(code) {
  switch (code) {
    case 'auth/email-already-in-use': return 'This email is already registered. Try logging in instead.';
    case 'auth/invalid-email': return 'Please enter a valid email address.';
    case 'auth/weak-password': return 'Password must be at least 6 characters.';
    case 'auth/user-not-found': return 'No account found with this email.';
    case 'auth/wrong-password': return 'Incorrect password. Please try again.';
    case 'auth/invalid-credential': return 'Invalid email or password.';
    case 'auth/too-many-requests': return 'Too many attempts. Please wait a moment.';
    default: return 'Something went wrong. Please try again.';
  }
}
