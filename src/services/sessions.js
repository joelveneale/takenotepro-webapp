import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  deleteDoc, 
  query, 
  where,
  orderBy 
} from 'firebase/firestore';
import { db } from './firebase';

// Save session to Firestore
export const saveSessionToFirestore = async (userId, sessionData) => {
  try {
    const sessionRef = doc(db, 'sessions', sessionData.id);
    await setDoc(sessionRef, {
      ...sessionData,
      userId,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    return true;
  } catch (error) {
    console.error('Error saving session:', error);
    return false;
  }
};

// Load all user sessions from Firestore
export const loadUserSessions = async (userId) => {
  try {
    const sessionsQuery = query(
      collection(db, 'sessions'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    const querySnapshot = await getDocs(sessionsQuery);
    return querySnapshot.docs.map(doc => doc.data());
  } catch (error) {
    console.error('Error loading sessions:', error);
    return [];
  }
};

// Delete session from Firestore
export const deleteSessionFromFirestore = async (sessionId) => {
  try {
    await deleteDoc(doc(db, 'sessions', sessionId));
    return true;
  } catch (error) {
    console.error('Error deleting session:', error);
    return false;
  }
};

// Get session count for user (for free tier limit check)
export const getUserSessionCount = async (userId) => {
  try {
    const sessionsQuery = query(
      collection(db, 'sessions'),
      where('userId', '==', userId)
    );
    const querySnapshot = await getDocs(sessionsQuery);
    return querySnapshot.size;
  } catch (error) {
    console.error('Error getting session count:', error);
    return 0;
  }
};
