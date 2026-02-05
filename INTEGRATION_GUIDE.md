# 🔗 Integrating Take Note Pro App - Complete Guide

This guide explains how to integrate the full Take Note Pro timecode logger into the authentication shell.

---

## 📊 Current Status

**✅ Complete:**
- Firebase Authentication
- Stripe subscription system
- Backend serverless functions
- User tier detection (Free vs Pro)

**🔄 Needs Integration:**
- The actual Take Note Pro app component
- Firestore session sync
- Free tier enforcement (1 session, 20 notes)
- Pro feature gates

---

## 🎯 What Needs to Happen

### 1. Create TakeNotePro Component

Copy the existing Take Note Pro app and modify it to:
- Accept `user` and `isPro` props
- Sync sessions to Firestore (not just localStorage)
- Enforce free tier limits
- Gate Pro features

### 2. Add Firestore Session Management

Create `/src/services/sessions.js` to handle:
- Save session to Firestore
- Load user's sessions from Firestore
- Delete sessions
- Real-time sync (optional)

### 3. Implement Tier Enforcement

**Free Tier Limits:**
- Maximum 1 active session
- Maximum 20 notes per session
- Show upgrade prompts when limits hit

**Pro Tier Features:**
- Unlimited sessions
- Unlimited notes
- Document upload (enable UI)
- NLE exports (enable export buttons)

### 4. Update App.jsx

Replace the placeholder with the actual TakeNotePro component.

---

## 📝 Step-by-Step Integration

### Step 1: Create Firestore Sessions Service

Create `/src/services/sessions.js`:

\`\`\`javascript
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
export const saveSession = async (userId, sessionData) => {
  try {
    const sessionRef = doc(db, 'sessions', sessionData.id);
    await setDoc(sessionRef, {
      ...sessionData,
      userId,
      updatedAt: new Date().toISOString(),
    });
    return true;
  } catch (error) {
    console.error('Error saving session:', error);
    return false;
  }
};

// Load all user sessions
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

// Delete session
export const deleteSession = async (sessionId) => {
  try {
    await deleteDoc(doc(db, 'sessions', sessionId));
    return true;
  } catch (error) {
    console.error('Error deleting session:', error);
    return false;
  }
};

// Get session count for user (for free tier limit)
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
\`\`\`

---

### Step 2: Create the TakeNotePro Component

This is the main app component. I'll provide the structure with key modifications:

\`\`\`javascript
import React, { useState, useEffect, useRef } from 'react';
import { saveSession, loadUserSessions, deleteSession, getUserSessionCount } from '../services/sessions';
import './TakeNotePro.css';

const TakeNotePro = ({ user, isPro, onShowPricing }) => {
  // ==================== STATE ====================
  
  // Sessions
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [sessionCount, setSessionCount] = useState(0);
  
  // Timecode
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [frames, setFrames] = useState(0);
  const [fps, setFps] = useState(25);
  const [isRunning, setIsRunning] = useState(false);
  
  // Notes
  const [notes, setNotes] = useState([]);
  const [quickNote, setQuickNote] = useState('');
  
  // Metadata
  const [metadataFields, setMetadataFields] = useState([
    { id: 'production', label: 'Production', value: '', placeholder: 'e.g., Documentary 2025' },
    { id: 'scene', label: 'Scene', value: '', placeholder: 'e.g., INT. OFFICE - DAY' },
    // ... rest of metadata fields
  ]);
  
  // Mics
  const [mics, setMics] = useState([
    { id: 1, number: 1, assignments: [{ name: '', timecode: null, image: null }], frequency: '' },
    // ... rest of mics
  ]);
  
  // UI State
  const [activeTab, setActiveTab] = useState('sessions'); // sessions, notes, mics, documents
  
  // ==================== LOAD SESSIONS ON MOUNT ====================
  
  useEffect(() => {
    loadSessions();
  }, [user.uid]);
  
  const loadSessions = async () => {
    const userSessions = await loadUserSessions(user.uid);
    setSessions(userSessions);
    setSessionCount(userSessions.length);
    
    // Load the most recent session
    if (userSessions.length > 0) {
      loadSession(userSessions[0].id);
    }
  };
  
  // ==================== SESSION MANAGEMENT ====================
  
  const createNewSession = async () => {
    // FREE TIER LIMIT: Check if user can create more sessions
    if (!isPro && sessionCount >= 1) {
      // Show upgrade modal
      onShowPricing();
      return;
    }
    
    const newSession = {
      id: \`session_\${Date.now()}\`,
      name: \`Session \${sessions.length + 1}\`,
      createdAt: new Date().toISOString(),
      notes: [],
      mics: [...initialMics],
      metadata: [...initialMetadata],
    };
    
    // Save to Firestore
    const saved = await saveSession(user.uid, newSession);
    if (saved) {
      setSessions([newSession, ...sessions]);
      setSessionCount(sessionCount + 1);
      setCurrentSessionId(newSession.id);
      loadSession(newSession.id);
    }
  };
  
  const loadSession = (sessionId) => {
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      setCurrentSessionId(sessionId);
      setNotes(session.notes || []);
      setMics(session.mics || []);
      setMetadataFields(session.metadata || []);
    }
  };
  
  const saveCurrentSession = async () => {
    if (!currentSessionId) return;
    
    const session = sessions.find(s => s.id === currentSessionId);
    if (session) {
      const updatedSession = {
        ...session,
        notes,
        mics,
        metadata: metadataFields,
      };
      
      await saveSession(user.uid, updatedSession);
      
      // Update local state
      setSessions(sessions.map(s => 
        s.id === currentSessionId ? updatedSession : s
      ));
    }
  };
  
  // Auto-save session when data changes
  useEffect(() => {
    if (currentSessionId) {
      const timeout = setTimeout(() => {
        saveCurrentSession();
      }, 2000); // Debounce 2 seconds
      
      return () => clearTimeout(timeout);
    }
  }, [notes, mics, metadataFields]);
  
  // ==================== NOTE MANAGEMENT ====================
  
  const addQuickNote = () => {
    // FREE TIER LIMIT: Check note count
    if (!isPro && notes.length >= 20) {
      alert('Free tier limited to 20 notes. Upgrade to Pro for unlimited notes!');
      onShowPricing();
      return;
    }
    
    if (!quickNote.trim()) return;
    
    const newNote = {
      id: Date.now(),
      timecode: getCurrentTimecode(),
      text: quickNote.trim(),
      timestamp: new Date().toISOString(),
    };
    
    setNotes([...notes, newNote]);
    setQuickNote('');
  };
  
  // ==================== EXPORT FUNCTIONS ====================
  
  const exportToNLE = (format) => {
    // PRO FEATURE GATE
    if (!isPro) {
      alert('NLE exports are a Pro feature. Upgrade to access EDL, FCPXML, TSV, and ALE exports!');
      onShowPricing();
      return;
    }
    
    // ... export logic
  };
  
  const exportPDF = () => {
    // Available to all tiers (basic PDF for free, password-protected for Pro)
    // ... PDF export logic
  };
  
  // ==================== RENDER ====================
  
  return (
    <div className="takenote-app">
      {/* Header with user info and upgrade button */}
      <header className="app-header">
        <div className="header-left">
          <h1>Take Note Pro</h1>
          {!isPro && (
            <button onClick={onShowPricing} className="btn-upgrade-header">
              Upgrade to Pro
            </button>
          )}
        </div>
        <div className="header-right">
          <span>{user.email}</span>
          {isPro && <span className="pro-badge">✓ Pro</span>}
        </div>
      </header>
      
      {/* Tab navigation */}
      <nav className="tab-nav">
        <button 
          className={activeTab === 'sessions' ? 'active' : ''}
          onClick={() => setActiveTab('sessions')}
        >
          Sessions
        </button>
        <button 
          className={activeTab === 'notes' ? 'active' : ''}
          onClick={() => setActiveTab('notes')}
        >
          Notes
        </button>
        <button 
          className={activeTab === 'mics' ? 'active' : ''}
          onClick={() => setActiveTab('mics')}
        >
          Mics
        </button>
        <button 
          className={activeTab === 'documents' ? 'active' : ''}
          onClick={() => setActiveTab('documents')}
          disabled={!isPro}
        >
          Documents {!isPro && '🔒'}
        </button>
      </nav>
      
      {/* Main content area */}
      <main className="app-main">
        {activeTab === 'sessions' && (
          <SessionsPanel 
            sessions={sessions}
            currentSessionId={currentSessionId}
            isPro={isPro}
            sessionCount={sessionCount}
            onCreateNew={createNewSession}
            onLoadSession={loadSession}
            onShowPricing={onShowPricing}
          />
        )}
        
        {activeTab === 'notes' && (
          <NotesPanel
            notes={notes}
            isPro={isPro}
            quickNote={quickNote}
            setQuickNote={setQuickNote}
            onAddNote={addQuickNote}
            onShowPricing={onShowPricing}
          />
        )}
        
        {/* ... other panels */}
      </main>
      
      {/* Footer with export buttons */}
      <footer className="app-footer">
        <button onClick={exportPDF}>Export PDF</button>
        <button onClick={() => exportToNLE('edl')} disabled={!isPro}>
          Export EDL {!isPro && '🔒'}
        </button>
        <button onClick={() => exportToNLE('fcpxml')} disabled={!isPro}>
          Export FCPXML {!isPro && '🔒'}
        </button>
      </footer>
    </div>
  );
};

export default TakeNotePro;
\`\`\`

---

### Step 3: Update Main App.jsx

Replace the placeholder with:

\`\`\`javascript
import TakeNotePro from './components/TakeNotePro';

function App() {
  const { user, isPro, loading } = useAuth();
  const [showPricing, setShowPricing] = useState(false);

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Auth />;
  }

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
\`\`\`

---

### Step 4: Update Firestore Security Rules

Add rules for sessions collection:

\`\`\`javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Sessions collection - NEW
    match /sessions/{sessionId} {
      allow read, write: if request.auth != null && 
                            request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && 
                      request.auth.uid == request.resource.data.userId;
    }
  }
}
\`\`\`

---

## 🎨 Key Features to Implement

### Free Tier Enforcement

\`\`\`javascript
// Before creating session
if (!isPro && sessionCount >= 1) {
  onShowPricing();
  return;
}

// Before adding note
if (!isPro && notes.length >= 20) {
  onShowPricing();
  return;
}
\`\`\`

### Pro Feature Gates

\`\`\`javascript
// Documents tab
{activeTab === 'documents' && isPro && (
  <DocumentsPanel />
)}

{activeTab === 'documents' && !isPro && (
  <UpgradePrompt feature="Documents" />
)}

// NLE Export buttons
<button 
  onClick={() => exportNLE('edl')} 
  disabled={!isPro}
  title={!isPro ? 'Upgrade to Pro for NLE exports' : ''}
>
  Export EDL {!isPro && '🔒'}
</button>
\`\`\`

### Upgrade Prompts

Show contextual upgrade messages:
- "Create unlimited sessions with Pro - £4.99/year"
- "Add unlimited notes with Pro"
- "Export to Avid, Premiere, Resolve with Pro"

---

## 📦 Files You'll Need

1. `/src/components/TakeNotePro.jsx` - Main app (large file)
2. `/src/components/TakeNotePro.css` - Styling
3. `/src/services/sessions.js` - Firestore session management
4. Update `/src/App.jsx` - Replace placeholder

---

## 🚀 Testing Checklist

### Free Tier Testing
- [ ] Can create 1 session
- [ ] Blocked from creating 2nd session
- [ ] Upgrade prompt shows
- [ ] Can add up to 20 notes
- [ ] Blocked from adding 21st note
- [ ] Documents tab is locked
- [ ] NLE export buttons are disabled

### Pro Tier Testing
- [ ] Can create unlimited sessions
- [ ] Can add unlimited notes
- [ ] Documents tab unlocked
- [ ] NLE exports work
- [ ] Sessions sync to Firestore
- [ ] Auto-save works

---

## ⚡ Quick Win Option

**Instead of integrating everything at once**, you could:

1. **Phase 1** (Now): Get the basic app working with localStorage
2. **Phase 2** (Next): Add Firestore sync
3. **Phase 3** (Last): Implement tier enforcement

This way you can test the deployment and payment flow first, then add features incrementally.

---

## 🤔 Need Help?

I can:
1. **Create the full TakeNotePro.jsx component** (it's ~2000 lines)
2. **Create just the sessions service** to get started
3. **Walk through one feature at a time**

What would be most helpful?
