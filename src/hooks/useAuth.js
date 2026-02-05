import { useState, useEffect } from 'react';
import { onAuthChange, getUserSubscription } from '../services/auth';

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        
        // Fetch subscription data
        const subData = await getUserSubscription(firebaseUser.uid);
        setSubscription(subData);
      } else {
        setUser(null);
        setSubscription(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const isPro = subscription?.subscriptionTier === 'pro' && 
                subscription?.subscriptionStatus === 'active';

  return { user, subscription, isPro, loading };
};
