import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCT1tugf0ALJg41Cw8GgD5VYHuFJ0IgCD4",
  authDomain: "take-note-pro.firebaseapp.com",
  projectId: "take-note-pro",
  storageBucket: "take-note-pro.firebasestorage.app",
  messagingSenderId: "429731771427",
  appId: "1:429731771427:web:fac8ca8fcbe4e1af3c6d96",
  measurementId: "G-WD8P9CBS45"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;

// Enable offline persistence — Firestore caches data locally in IndexedDB
// and syncs automatically when connection is restored
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    // Multiple tabs open — persistence can only be enabled in one tab at a time
    console.warn('Firestore persistence unavailable: multiple tabs open');
  } else if (err.code === 'unimplemented') {
    // Browser doesn't support IndexedDB persistence
    console.warn('Firestore persistence unavailable: browser not supported');
  }
});
