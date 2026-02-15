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

// Fetch a single session from Firestore
export const fetchSessionFromFirestore = async (sessionId) => {
  try {
    const sessionRef = doc(db, 'sessions', sessionId);
    const snapshot = await getDoc(sessionRef);
    if (snapshot.exists()) return snapshot.data();
    return null;
  } catch (error) {
    console.error('Error fetching session:', error);
    return null;
  }
};

// Merge local session data with remote — notes are unioned, rest uses latest updatedAt
export const mergeSessionData = (local, remote) => {
  if (!remote) return local;
  if (!local) return remote;

  const localTime = new Date(local.updatedAt || 0).getTime();
  const remoteTime = new Date(remote.updatedAt || 0).getTime();

  // Merge notes: union by ID, keep all unique notes from both
  const localNotes = local.notes || [];
  const remoteNotes = remote.notes || [];
  const noteMap = new Map();
  // Remote notes first (base), then local notes override if same ID
  remoteNotes.forEach(n => noteMap.set(n.id, n));
  localNotes.forEach(n => noteMap.set(n.id, n));
  const mergedNotes = Array.from(noteMap.values());
  // Sort by timecode string for consistent ordering
  mergedNotes.sort((a, b) => (a.timecode || '').localeCompare(b.timecode || ''));

  // For mics, metadata, fps, tcOffset — most recent updatedAt wins
  const useRemote = remoteTime > localTime;

  return {
    ...local,
    notes: mergedNotes,
    mics: useRemote ? (remote.mics || local.mics) : (local.mics || remote.mics),
    metadata: useRemote ? (remote.metadata || local.metadata) : (local.metadata || remote.metadata),
    fps: useRemote ? (remote.fps || local.fps) : (local.fps || remote.fps),
    tcOffset: useRemote ? (remote.tcOffset ?? local.tcOffset) : (local.tcOffset ?? remote.tcOffset),
    updatedAt: new Date().toISOString()
  };
};

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
