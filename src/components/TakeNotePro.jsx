import React, { useState, useEffect, useRef, useCallback } from 'react';
import { jsPDF } from 'jspdf';
import { saveSessionToFirestore, loadUserSessions, deleteSessionFromFirestore, fetchSessionFromFirestore, mergeSessionData } from '../services/sessions';
import { getAuth, deleteUser } from 'firebase/auth';
import { getFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore';

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const FREE_MAX_SESSIONS = Infinity;
const FREE_MAX_NOTES = Infinity;

const DEFAULT_MICS = () => [
  { id: 1, number: 1, assignments: [{ name: '', timecode: null, image: null }], frequency: '' },
  { id: 2, number: 2, assignments: [{ name: '', timecode: null, image: null }], frequency: '' },
  { id: 3, number: 3, assignments: [{ name: '', timecode: null, image: null }], frequency: '' },
  { id: 4, number: 4, assignments: [{ name: '', timecode: null, image: null }], frequency: '' },
  { id: 5, number: 5, assignments: [{ name: '', timecode: null, image: null }], frequency: '' },
  { id: 6, number: 6, assignments: [{ name: '', timecode: null, image: null }], frequency: '' },
  { id: 7, number: 7, assignments: [{ name: '', timecode: null, image: null }], frequency: '' },
  { id: 8, number: 8, assignments: [{ name: '', timecode: null, image: null }], frequency: '' },
];

const DEFAULT_METADATA = () => [
  { id: 'production', label: 'Production', value: '', placeholder: 'e.g., Documentary 2025' },
  { id: 'scene', label: 'Scene', value: '', placeholder: 'e.g., INT. OFFICE - DAY' },
  { id: 'take', label: 'Take', value: '', placeholder: 'e.g., 3' },
  { id: 'cameraName', label: 'Camera Name', value: '', placeholder: 'e.g., A-Cam' },
  { id: 'soundRoll', label: 'Sound Roll', value: '', placeholder: 'e.g., SR001' },
  { id: 'recordist', label: 'Recordist', value: '', placeholder: 'Your name' }
];

const FPS_OPTIONS = [
  { value: 23.976, label: '23.976' },
  { value: 24, label: '24' },
  { value: 25, label: '25' },
  { value: 29.97, label: '29.97 DF' },
  { value: 30, label: '30' },
  { value: 50, label: '50' },
  { value: 59.94, label: '59.94' },
  { value: 60, label: '60' },
];

// ─── PDF VIEWER COMPONENT ────────────────────────────────────────────────────

const PdfViewer = ({ document: doc, onClose }) => {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [pdfPassword, setPdfPassword] = useState('');
  const [pdfError, setPdfError] = useState(null);
  const [pdfPages, setPdfPages] = useState([]);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [renderProgress, setRenderProgress] = useState('');

  const zoomIn = () => setZoomLevel(prev => Math.min(prev + 0.25, 3));
  const zoomOut = () => setZoomLevel(prev => Math.max(prev - 0.25, 0.5));
  const resetZoom = () => setZoomLevel(1);

  // Load PDF with pdf.js (for password support)
  const loadWithPdfJs = async (password = null) => {
    setPdfLoading(true);
    setPdfError(null);
    setPdfPages([]);
    setRenderProgress('Loading library...');

    try {
      const pdfjsLib = window.pdfjsLib;
      if (!pdfjsLib) throw new Error('PDF.js library not loaded. Please refresh the page.');

      setRenderProgress('Decoding PDF...');
      const base64 = doc.data.split(',')[1];
      if (!base64) throw new Error('Invalid PDF data');

      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      setRenderProgress('Opening PDF...');
      const loadingTask = pdfjsLib.getDocument({ data: bytes, password: password });
      const pdf = await loadingTask.promise;

      const pages = [];
      const containerWidth = Math.min(window.innerWidth - 40, 800);
      const dpr = window.devicePixelRatio || 1;

        for (let i = 1; i <= pdf.numPages; i++) {
        setRenderProgress(`Rendering page ${i} of ${pdf.numPages}...`);
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1 });
        const scale = Math.min(containerWidth / viewport.width, 3);
        const renderScale = scale * dpr;
        const scaledViewport = page.getViewport({ scale: renderScale });

        const canvas = window.document.createElement('canvas');
        canvas.width = scaledViewport.width;
        canvas.height = scaledViewport.height;
        const ctx = canvas.getContext('2d');

        const renderTask = page.render({ canvasContext: ctx, viewport: scaledViewport });
        // pdf.js v5 render() returns a promise directly; v3 returns { promise }
        if (renderTask.promise) {
          await renderTask.promise;
        } else {
          await renderTask;
        }

        pages.push(canvas.toDataURL('image/jpeg', 0.85));
      }

      setPdfPages(pages);
      setNeedsPassword(false);
    } catch (err) {
      console.error('PDF load error:', err);
      if (err.name === 'PasswordException' || (err.message && err.message.includes('password'))) {
        setNeedsPassword(true);
        setPdfError(password ? 'Incorrect password. Please try again.' : null);
      } else {
        setPdfError(`Failed to load PDF: ${err.message || 'Unknown error'}`);
      }
    } finally {
      setPdfLoading(false);
      setRenderProgress('');
    }
  };

  const handlePasswordSubmit = (e) => {
    e?.preventDefault?.();
    if (pdfPassword) loadWithPdfJs(pdfPassword);
  };

  if (!doc) return null;

  const isPdf = doc.type?.includes('pdf');

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.95)', zIndex: 2000,
      display: 'flex', flexDirection: 'column'
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px', background: '#1a1a1e',
        borderBottom: '1px solid #333',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px'
      }}>
        <div style={{
          fontSize: '14px', fontWeight: '600', color: '#fff',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1
        }}>
          {doc.name}
        </div>
        <button onClick={() => {
          const link = window.document.createElement('a');
          link.href = doc.data; link.download = doc.name;
          window.document.body.appendChild(link); link.click();
          window.document.body.removeChild(link);
        }} style={{
          padding: '8px 12px', fontSize: '11px', fontWeight: '600',
          background: '#3366ff', color: '#fff', border: 'none',
          borderRadius: '6px', cursor: 'pointer', whiteSpace: 'nowrap'
        }}>
          Download
        </button>
        <button onClick={onClose} style={{
          padding: '8px 16px', fontSize: '12px', fontWeight: '600',
          background: '#333', color: '#fff', border: 'none',
          borderRadius: '6px', cursor: 'pointer'
        }}>
          Close
        </button>
      </div>

      {/* Password prompt — positioned at top, below header */}
      {needsPassword && (
        <div style={{
          padding: '20px', background: '#141416', borderBottom: '1px solid #333'
        }}>
          <div style={{ maxWidth: '320px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '24px' }}>🔒</span>
              <div style={{ color: '#fff', fontWeight: '600', fontSize: '14px', marginTop: '4px' }}>Password Protected</div>
            </div>
            {pdfError && (
              <div style={{ color: '#ff4444', fontSize: '12px', textAlign: 'center', marginBottom: '8px' }}>{pdfError}</div>
            )}
            <form onSubmit={handlePasswordSubmit} style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                inputMode="text"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
                value={pdfPassword}
                onChange={(e) => setPdfPassword(e.target.value)}
                placeholder="Enter password"
                autoFocus
                style={{
                  flex: 1, padding: '12px', fontSize: '16px',
                  background: '#0a0a0b', border: '1px solid #444', borderRadius: '6px',
                  color: '#fff', boxSizing: 'border-box',
                  outline: 'none', WebkitAppearance: 'none'
                }}
              />
              <button type="submit" disabled={!pdfPassword || pdfLoading} style={{
                padding: '12px 20px', fontSize: '13px', fontWeight: '600',
                background: pdfPassword ? 'linear-gradient(180deg, #00ff88, #00cc6a)' : '#333',
                color: pdfPassword ? '#000' : '#666',
                border: 'none', borderRadius: '6px',
                cursor: pdfPassword ? 'pointer' : 'not-allowed',
                whiteSpace: 'nowrap'
              }}>
                {pdfLoading ? '...' : 'Unlock'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Zoom controls */}
      {!needsPassword && (
        <div style={{
          display: 'flex', justifyContent: 'center', gap: '8px', padding: '8px',
          background: '#1a1a1e', borderBottom: '1px solid #333'
        }}>
          <button onClick={zoomOut} style={{ padding: '8px 14px', background: '#333', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '18px', cursor: 'pointer' }}>−</button>
          <button onClick={resetZoom} style={{ padding: '8px 14px', background: '#333', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '12px', minWidth: '60px', cursor: 'pointer' }}>{Math.round(zoomLevel * 100)}%</button>
          <button onClick={zoomIn} style={{ padding: '8px 14px', background: '#333', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '18px', cursor: 'pointer' }}>+</button>
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0', background: '#525659' }}>
        {/* Loading */}
        {pdfLoading && !needsPassword && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#fff' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '28px', marginBottom: '12px', animation: 'pulse 1s infinite' }}>⏳</div>
              <div style={{ fontSize: '14px' }}>{renderProgress || 'Rendering PDF...'}</div>
            </div>
          </div>
        )}

        {/* Rendered PDF pages from pdf.js */}
        {pdfPages.length > 0 && (
          <div style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top center' }}>
            {pdfPages.map((page, i) => (
              <img key={i} src={page} alt={`Page ${i + 1}`} style={{ width: '100%', display: 'block', marginBottom: '4px' }} />
            ))}
          </div>
        )}

        {/* Native PDF / image viewer (non-password PDFs) */}
        {!needsPassword && !pdfLoading && pdfPages.length === 0 && (
          isPdf ? (
            <div>
              <div style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top center', minHeight: '100%' }}>
                <object data={doc.data} type="application/pdf" style={{
                  width: '100%', minHeight: '800px', border: 'none', background: '#fff'
                }}>
                  <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', minHeight: '400px', color: '#fff',
                    padding: '20px', textAlign: 'center', background: '#525659'
                  }}>
                    <div style={{ fontSize: '32px', marginBottom: '12px' }}>📄</div>
                    <div style={{ marginBottom: '16px' }}>PDF preview not available in your browser</div>
                    <button onClick={() => loadWithPdfJs()} style={{
                      padding: '12px 24px', fontSize: '12px', fontWeight: '600',
                      background: '#3366ff', color: '#fff', border: 'none',
                      borderRadius: '6px', cursor: 'pointer', marginBottom: '8px'
                    }}>
                      Try Alternative Viewer
                    </button>
                    <div style={{ color: '#888', fontSize: '11px' }}>Use the Download button to open in another app</div>
                  </div>
                </object>
              </div>
              {/* Password Protected button */}
              <div style={{ textAlign: 'center', padding: '12px' }}>
                <button onClick={() => loadWithPdfJs()} style={{
                  padding: '10px 20px', fontSize: '11px', fontWeight: '600',
                  background: '#2a2a2e', color: '#ccc', border: '1px solid #444',
                  borderRadius: '6px', cursor: 'pointer', letterSpacing: '0.05em'
                }}>
                  🔒 Password Protected? Tap here
                </button>
              </div>
            </div>
          ) : (
            <div style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top center' }}>
              <img src={doc.data} alt={doc.name} style={{ width: '100%', height: 'auto', display: 'block' }} />
            </div>
          )
        )}

        {/* Error */}
        {pdfError && !needsPassword && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '20px' }}>
            <div style={{ textAlign: 'center', color: '#ff4444' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>⚠️</div>
              <div style={{ fontSize: '14px', marginBottom: '12px' }}>{pdfError}</div>
              <button onClick={() => loadWithPdfJs()} style={{
                padding: '10px 20px', fontSize: '12px', fontWeight: '600',
                background: '#3366ff', color: '#fff', border: 'none',
                borderRadius: '6px', cursor: 'pointer'
              }}>Try Again</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── UPGRADE PROMPT COMPONENT ────────────────────────────────────────────────

const UpgradePrompt = ({ feature, onUpgrade }) => (
  <div style={{
    textAlign: 'center', padding: '40px 20px',
    background: 'linear-gradient(145deg, rgba(0,255,136,0.05), rgba(0,255,136,0.02))',
    border: '1px dashed #00ff8844', borderRadius: '12px'
  }}>
    <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔒</div>
    <div style={{ fontSize: '14px', fontWeight: '600', color: '#fff', marginBottom: '8px', fontFamily: "'Outfit', sans-serif" }}>
      {feature} is a Pro Feature
    </div>
    <div style={{ fontSize: '12px', color: '#888', marginBottom: '20px' }}>
      Upgrade to Pro to unlock {feature.toLowerCase()} and more
    </div>
    <button onClick={onUpgrade} style={{
      padding: '12px 32px', fontSize: '13px', fontWeight: '600',
      background: 'linear-gradient(180deg, #00ff88 0%, #00cc6a 100%)',
      color: '#000', border: 'none', borderRadius: '8px', cursor: 'pointer',
      fontFamily: "'Outfit', sans-serif", letterSpacing: '0.05em'
    }}>
      Upgrade — £4.99/year
    </button>
  </div>
);

// ─── MAIN APP COMPONENT ──────────────────────────────────────────────────────

const TakeNotePro = ({ user, isPro, onShowPricing, onLogout }) => {
  // Sessions state
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [showSessionsPanel, setShowSessionsPanel] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);

  // Timecode state
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [frames, setFrames] = useState(0);
  const [fps, setFps] = useState(25);
  const [isRunning, setIsRunning] = useState(false);
  const [isEditing, setIsEditing] = useState(true);

  // TC field editing
  const [editingField, setEditingField] = useState(null);
  const [editingValue, setEditingValue] = useState('');

  // Metadata state
  const [metadataFields, setMetadataFields] = useState(DEFAULT_METADATA());
  const [newFieldName, setNewFieldName] = useState('');
  const [editingLabelId, setEditingLabelId] = useState(null);
  const [editingLabelValue, setEditingLabelValue] = useState('');

  // Mic list state
  const [mics, setMics] = useState(DEFAULT_MICS());

  // Documents state — persist in localStorage
  const [documents, setDocuments] = useState(() => {
    try {
      const cached = localStorage.getItem('tnp_documents');
      if (cached) return JSON.parse(cached);
    } catch (e) {}
    return [];
  });
  const [viewingDocument, setViewingDocument] = useState(null);

  // Save documents to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('tnp_documents', JSON.stringify(documents));
    } catch (e) {
      // localStorage might be full — docs with base64 data can be large
      console.warn('Could not cache documents to localStorage:', e.message);
    }
  }, [documents]);

  // Notes state
  const [notes, setNotes] = useState([]);
  const [deletedNoteIds, setDeletedNoteIds] = useState(new Set());
  const [quickNote, setQuickNote] = useState('');
  const [longNote, setLongNote] = useState('');
  const [longNoteStartTC, setLongNoteStartTC] = useState(null);
  const [isLongNoteMode, setIsLongNoteMode] = useState(false);

  // UI state
  const [activeTab, setActiveTab] = useState('timecode');
  const [showExportModal, setShowExportModal] = useState(false);
  const [csvContent, setCsvContent] = useState('');
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [showMicExport, setShowMicExport] = useState(false);

  // Custom note state
  const [showCustomNote, setShowCustomNote] = useState(false);
  const [customNoteTC, setCustomNoteTC] = useState({ h: 0, m: 0, s: 0, f: 0 });
  const [customNoteText, setCustomNoteText] = useState('');

  // Saving indicator
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Delete account handler
  const handleDeleteAccount = async () => {
    if (!user) return;
    setIsDeleting(true);
    try {
      const uid = user.uid;
      const firestore = getFirestore();
      // Delete all user sessions from Firestore
      const sessionsRef = collection(firestore, 'users', uid, 'sessions');
      const sessionsSnap = await getDocs(sessionsRef);
      for (const sessionDoc of sessionsSnap.docs) {
        await deleteDoc(sessionDoc.ref);
      }
      // Delete user document
      await deleteDoc(doc(firestore, 'users', uid));
      // Delete Firebase Auth account
      const authInstance = getAuth();
      await deleteUser(authInstance.currentUser);
      // Clear local storage
      localStorage.clear();
      setShowDeleteConfirm(false);
    } catch (err) {
      console.error('Error deleting account:', err);
      if (err.code === 'auth/requires-recent-login') {
        alert('For security, please sign out and sign back in, then try deleting your account again.');
      } else {
        alert('Failed to delete account: ' + (err.message || 'Please try again.'));
      }
    } finally {
      setIsDeleting(false);
    }
  };

  // Online/offline tracking
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const goOnline = () => {
      setIsOnline(true);
      // Reconnect sync: pull latest from Firestore and merge
      if (currentSessionId && user) {
        fetchSessionFromFirestore(currentSessionId).then(remote => {
          if (remote) {
            const localSession = {
              id: currentSessionId, notes, mics, metadata: metadataFields, fps,
              tcOffset: tcOffsetRef.current, updatedAt: new Date().toISOString()
            };
            const merged = mergeSessionData(localSession, remote);
            if (merged.notes.length > notes.length) setNotes(merged.notes);
            // Trigger a save to push local offline changes up
            setTimeout(() => saveCurrentSession(), 500);
          }
        }).catch(() => {});
      }
    };
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [currentSessionId, user, notes, mics, metadataFields, fps]);

  const intervalRef = useRef(null);
  const quickNoteRef = useRef(null);
  const tcOffsetRef = useRef(0);
  const saveTimeoutRef = useRef(null);

  // ─── TIMECODE ────────────────────────────────────────────────────────────

  const formatTC = useCallback((h, m, s, f) => {
    const pad = (n) => String(Math.floor(n)).padStart(2, '0');
    const separator = fps === 29.97 || fps === 59.94 ? ';' : ':';
    return `${pad(h)}:${pad(m)}:${pad(s)}${separator}${pad(f)}`;
  }, [fps]);

  const currentTC = formatTC(hours, minutes, seconds, frames);

  const calculateTCFromTime = useCallback(() => {
    const now = Date.now();
    const tcMillis = now + tcOffsetRef.current;
    const tcDate = new Date(tcMillis);
    return {
      h: tcDate.getHours(),
      m: tcDate.getMinutes(),
      s: tcDate.getSeconds(),
      f: Math.floor((tcDate.getMilliseconds() / 1000) * fps)
    };
  }, [fps]);

  const updateTCOffset = useCallback(() => {
    const now = Date.now();
    const tcDate = new Date();
    tcDate.setHours(hours, minutes, seconds, Math.floor((frames / fps) * 1000));
    tcOffsetRef.current = tcDate.getTime() - now;
    try { localStorage.setItem('tnp_tc_offset', String(tcOffsetRef.current)); } catch (e) {}
  }, [hours, minutes, seconds, frames, fps]);

  // Auto-set to current time on mount (restore offset from cache if available)
  useEffect(() => {
    let savedOffset = 0;
    try {
      const cached = localStorage.getItem('tnp_tc_offset');
      if (cached !== null) savedOffset = parseFloat(cached) || 0;
    } catch (e) {}
    tcOffsetRef.current = savedOffset;
    const tc = new Date(Date.now() + savedOffset);
    setHours(tc.getHours());
    setMinutes(tc.getMinutes());
    setSeconds(tc.getSeconds());
    setFrames(Math.floor((tc.getMilliseconds() / 1000) * fps));
    setIsEditing(false);
    setIsRunning(true);
  }, []);

  // TC update loop
  useEffect(() => {
    if (isRunning) {
      const frameTime = 1000 / fps;
      const updateTC = () => {
        const tc = calculateTCFromTime();
        setHours(tc.h);
        setMinutes(tc.m);
        setSeconds(tc.s);
        setFrames(tc.f);
      };
      updateTC();
      intervalRef.current = setInterval(updateTC, frameTime);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRunning, fps, calculateTCFromTime]);

  // Resync on visibility change
  useEffect(() => {
    const handleVisibility = () => {
      if (window.document.visibilityState === 'visible' && isRunning) {
        const tc = calculateTCFromTime();
        setHours(tc.h); setMinutes(tc.m); setSeconds(tc.s); setFrames(tc.f);
      }
    };
    window.document.addEventListener('visibilitychange', handleVisibility);
    return () => window.document.removeEventListener('visibilitychange', handleVisibility);
  }, [isRunning, calculateTCFromTime]);

  // ─── SESSION MANAGEMENT ──────────────────────────────────────────────────

  // Load sessions from Firestore on mount
  useEffect(() => {
    if (!user) return;
    const loadSessions = async () => {
      try {
        const firestoreSessions = await loadUserSessions(user.uid);
        if (firestoreSessions.length > 0) {
          setSessions(firestoreSessions);
          setCurrentSessionId(firestoreSessions[0].id);
          // Load first session data
          const first = firestoreSessions[0];
          setNotes(first.notes || []);
          setMics(first.mics || DEFAULT_MICS());
          setMetadataFields(first.metadata || DEFAULT_METADATA());
          if (first.fps) setFps(first.fps);
          // Restore TC offset from session (Firestore takes priority over localStorage)
          if (first.tcOffset !== undefined && first.tcOffset !== null) {
            tcOffsetRef.current = first.tcOffset;
            try { localStorage.setItem('tnp_tc_offset', String(first.tcOffset)); } catch (e) {}
            const tc = new Date(Date.now() + first.tcOffset);
            setHours(tc.getHours());
            setMinutes(tc.getMinutes());
            setSeconds(tc.getSeconds());
            setFrames(Math.floor((tc.getMilliseconds() / 1000) * (first.fps || 25)));
          }
        } else {
          // Create initial session
          createNewSession(true);
        }
      } catch (err) {
        console.error('Error loading sessions:', err);
        createNewSession(true);
      }
      setSessionsLoaded(true);
    };
    loadSessions();
  }, [user]);

  const createNewSession = (isFirst = false) => {
    // Free tier check
    if (!isFirst && !isPro && sessions.length >= FREE_MAX_SESSIONS) {
      onShowPricing();
      return;
    }

    // Save current session before creating new one
    if (currentSessionId && !isFirst) {
      saveCurrentSession();
    }

    const today = new Date();
    const defaultName = newSessionName.trim() || `Day ${sessions.length + 1} - ${today.toLocaleDateString()}`;

    const newSession = {
      id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: defaultName,
      createdAt: today.toISOString(),
      userId: user?.uid || null,
      notes: [],
      mics: DEFAULT_MICS(),
      metadata: isFirst ? DEFAULT_METADATA() : metadataFields.map(f => ({
        ...f,
        value: f.id === 'production' ? f.value : ''
      })),
      fps: fps,
      tcOffset: tcOffsetRef.current
    };

    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
    setNotes([]);
    setMics(newSession.mics);
    if (isFirst) setMetadataFields(newSession.metadata);
    setNewSessionName('');
    setShowSessionsPanel(false);

    // Save to Firestore
    if (user) {
      saveSessionToFirestore(user.uid, newSession);
    }
  };

  const saveCurrentSession = useCallback(async () => {
    if (!currentSessionId) return;

    // Filter out soft-deleted notes before saving
    const activeNotes = notes.filter(n => !n.deleted && !deletedNoteIds.has(n.id));

    const localSession = {
      id: currentSessionId,
      notes: activeNotes, mics, metadata: metadataFields, fps,
      tcOffset: tcOffsetRef.current,
      updatedAt: new Date().toISOString()
    };

    // If online, fetch remote version and merge before saving
    if (user && navigator.onLine) {
      setIsSaving(true);
      try {
        const remote = await fetchSessionFromFirestore(currentSessionId);
        const merged = mergeSessionData(localSession, remote);

        // Filter out any deleted notes that merge may have reinstated
        merged.notes = merged.notes.filter(n => !n.deleted && !deletedNoteIds.has(n.id));

        // If remote had new notes we didn't have, update local state
        if (remote && merged.notes.length > activeNotes.length) {
          setNotes(merged.notes);
        }

        // Update local sessions list
        setSessions(prev => prev.map(s =>
          s.id === currentSessionId ? { ...s, ...merged } : s
        ));

        // Save merged result to Firestore
        await saveSessionToFirestore(user.uid, {
          ...sessions.find(s => s.id === currentSessionId),
          ...merged,
          userId: user.uid
        });
        setLastSaved(new Date());
      } catch (err) {
        console.error('Merge-save error:', err);
      } finally {
        setIsSaving(false);
      }
    } else {
      // Offline: save locally, Firestore persistence will queue it
      setSessions(prev => prev.map(s =>
        s.id === currentSessionId ? { ...s, ...localSession } : s
      ));
      if (user) {
        setIsSaving(true);
        saveSessionToFirestore(user.uid, {
          ...sessions.find(s => s.id === currentSessionId),
          ...localSession,
          userId: user.uid
        }).then(() => {
          setIsSaving(false);
          setLastSaved(new Date());
        }).catch(() => setIsSaving(false));
      }
    }
  }, [currentSessionId, notes, mics, metadataFields, fps, user, sessions, deletedNoteIds]);

  // Auto-save debounced
  useEffect(() => {
    if (!currentSessionId || !sessionsLoaded) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveCurrentSession();
    }, 2000); // Save 2 seconds after last change
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [notes, mics, metadataFields, fps, currentSessionId, sessionsLoaded]);

  // Save immediately when user leaves or switches tab
  useEffect(() => {
    const handleBeforeUnload = () => { if (currentSessionId && sessionsLoaded) saveCurrentSession(); };
    const handleVisibilityChange = () => {
      if (window.document.visibilityState === 'hidden' && currentSessionId && sessionsLoaded) {
        saveCurrentSession();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentSessionId, sessionsLoaded, saveCurrentSession]);

  const loadSession = (sessionId) => {
    if (currentSessionId) saveCurrentSession();
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      setNotes(session.notes || []);
      setMics(session.mics || DEFAULT_MICS());
      setMetadataFields(session.metadata || DEFAULT_METADATA());
      if (session.fps) setFps(session.fps);
      // Restore TC offset from session
      if (session.tcOffset !== undefined && session.tcOffset !== null) {
        tcOffsetRef.current = session.tcOffset;
        try { localStorage.setItem('tnp_tc_offset', String(session.tcOffset)); } catch (e) {}
        const tc = new Date(Date.now() + session.tcOffset);
        setHours(tc.getHours());
        setMinutes(tc.getMinutes());
        setSeconds(tc.getSeconds());
        setFrames(Math.floor((tc.getMilliseconds() / 1000) * (session.fps || fps)));
        setIsEditing(false);
        setIsRunning(true);
      }
      setCurrentSessionId(sessionId);
    }
    setShowSessionsPanel(false);
  };

  const deleteSession = async (sessionId) => {
    if (sessions.length <= 1) return;
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    if (user) deleteSessionFromFirestore(sessionId);
    if (sessionId === currentSessionId) {
      const remaining = sessions.filter(s => s.id !== sessionId);
      if (remaining.length > 0) loadSession(remaining[0].id);
    }
  };

  const renameSession = (sessionId, newName) => {
    setSessions(prev => prev.map(s =>
      s.id === sessionId ? { ...s, name: newName } : s
    ));
    // Will be saved on next auto-save
  };

  const getCurrentSessionName = () => {
    return sessions.find(s => s.id === currentSessionId)?.name || 'Unsaved Session';
  };

  // ─── MIC MANAGEMENT ─────────────────────────────────────────────────────

  const updateMicField = (micId, field, value) => {
    setMics(prev => prev.map(mic => mic.id === micId ? { ...mic, [field]: value } : mic));
  };

  const updateMicAssignment = (micId, index, name) => {
    setMics(prev => prev.map(mic => {
      if (mic.id === micId) {
        const a = [...mic.assignments];
        a[index] = { ...a[index], name };
        return { ...mic, assignments: a };
      }
      return mic;
    }));
  };

  const addPersonChange = (micId) => {
    setMics(prev => prev.map(mic => {
      if (mic.id === micId) {
        return { ...mic, assignments: [...mic.assignments, { name: '', timecode: currentTC, image: null }] };
      }
      return mic;
    }));
  };

  const removeAssignment = (micId, index) => {
    setMics(prev => prev.map(mic => {
      if (mic.id === micId && mic.assignments.length > 1) {
        return { ...mic, assignments: mic.assignments.filter((_, i) => i !== index) };
      }
      return mic;
    }));
  };

  const addMic = () => {
    const maxNumber = Math.max(...mics.map(m => m.number), 0);
    setMics(prev => [...prev, { id: Date.now(), number: maxNumber + 1, assignments: [{ name: '', timecode: null, image: null }], frequency: '' }]);
  };

  const removeMic = (micId) => { setMics(prev => prev.filter(m => m.id !== micId)); };

  const handleMicImageUpload = (micId, assignmentIndex, e) => {
    const file = e.target.files[0];
    if (!file) return;
    const img = new Image();
    const reader = new FileReader();
    reader.onloadend = () => {
      img.onload = () => {
        try {
          const canvas = window.document.createElement('canvas');
          const maxSize = 600;
          let w = img.width, h = img.height;
          if (w > h && w > maxSize) { h = (h * maxSize) / w; w = maxSize; }
          else if (h > maxSize) { w = (w * maxSize) / h; h = maxSize; }
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          const compressed = canvas.toDataURL('image/jpeg', 0.7);
          setMics(prev => prev.map(mic => {
            if (mic.id === micId) {
              const a = [...mic.assignments];
              a[assignmentIndex] = { ...a[assignmentIndex], image: compressed };
              return { ...mic, assignments: a };
            }
            return mic;
          }));
        } catch (err) { alert('Error processing image. Please try a smaller image.'); }
      };
      img.onerror = () => alert('Error loading image.');
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
    if (e.target) e.target.value = '';
  };

  // ─── METADATA MANAGEMENT ────────────────────────────────────────────────

  const updateMetadataValue = (id, value) => {
    setMetadataFields(prev => prev.map(f => f.id === id ? { ...f, value } : f));
  };

  const updateMetadataLabel = (id, label) => {
    setMetadataFields(prev => prev.map(f => f.id === id ? { ...f, label } : f));
  };

  const removeMetadataField = (id) => {
    setMetadataFields(prev => prev.filter(f => f.id !== id));
  };

  const addMetadataField = () => {
    if (newFieldName.trim()) {
      setMetadataFields(prev => [...prev, {
        id: `custom_${Date.now()}`, label: newFieldName.trim(),
        value: '', placeholder: `Enter ${newFieldName.trim().toLowerCase()}...`
      }]);
      setNewFieldName('');
    }
  };

  // ─── NOTES ──────────────────────────────────────────────────────────────

  const handleQuickNote = () => {
    if (!quickNote.trim()) return;
    // Free tier check
    if (!isPro && notes.length >= FREE_MAX_NOTES) {
      onShowPricing();
      return;
    }
    setNotes(prev => [...prev, {
      id: Date.now(), timecodeIn: currentTC, timecodeOut: currentTC,
      note: quickNote.trim(), type: 'quick', timestamp: new Date().toISOString()
    }]);
    setQuickNote('');
  };

  const startLongNote = () => { setIsLongNoteMode(true); setLongNoteStartTC(currentTC); };

  const saveLongNote = () => {
    if (longNote.trim() && longNoteStartTC) {
      if (!isPro && notes.length >= FREE_MAX_NOTES) { onShowPricing(); return; }
      setNotes(prev => [...prev, {
        id: Date.now(), timecodeIn: longNoteStartTC, timecodeOut: currentTC,
        note: longNote.trim(), type: 'long', timestamp: new Date().toISOString()
      }]);
    }
    setLongNote(''); setLongNoteStartTC(null); setIsLongNoteMode(false);
  };

  const cancelLongNote = () => { setLongNote(''); setLongNoteStartTC(null); setIsLongNoteMode(false); };

  const deleteNote = (id) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, deleted: true } : n));
    setDeletedNoteIds(prev => new Set([...prev, id]));
  };

  const tcToNumber = (tc) => {
    const parts = tc.replace(';', ':').split(':').map(Number);
    return parts[0] * 3600000 + parts[1] * 60000 + parts[2] * 1000 + parts[3];
  };

  const addCustomNote = () => {
    if (!customNoteText.trim()) return;
    if (!isPro && notes.length >= FREE_MAX_NOTES) { onShowPricing(); return; }
    const sep = fps === 29.97 || fps === 59.94 ? ';' : ':';
    const tc = `${String(customNoteTC.h).padStart(2, '0')}:${String(customNoteTC.m).padStart(2, '0')}:${String(customNoteTC.s).padStart(2, '0')}${sep}${String(customNoteTC.f).padStart(2, '0')}`;
    setNotes(prev => {
      const updated = [...prev, {
        id: Date.now(), timecodeIn: tc, timecodeOut: tc,
        note: customNoteText.trim(), type: 'custom', timestamp: new Date().toISOString()
      }];
      return updated.sort((a, b) => tcToNumber(a.timecodeIn) - tcToNumber(b.timecodeIn));
    });
    setCustomNoteText(''); setCustomNoteTC({ h: 0, m: 0, s: 0, f: 0 }); setShowCustomNote(false);
  };

  // ─── EXPORT FUNCTIONS ───────────────────────────────────────────────────

  const generateCSV = () => {
    const headers = ['Timecode In', 'Timecode Out', 'Note', 'Type', ...metadataFields.map(f => f.label), 'FPS', 'Timestamp'];
    const rows = notes.map(note => [
      note.timecodeIn, note.timecodeOut,
      `"${note.note.replace(/"/g, '""')}"`, note.type,
      ...metadataFields.map(f => `"${f.value.replace(/"/g, '""')}"`),
      fps, note.timestamp
    ]);
    setCsvContent([headers.join(','), ...rows.map(r => r.join(','))].join('\n'));
    setShowExportModal(true);
  };

  const generateEDL = () => {
    const prod = metadataFields.find(f => f.id === 'production')?.value || 'Untitled';
    let edl = `TITLE: ${prod}\nFCM: ${fps === 29.97 || fps === 59.94 ? 'DROP FRAME' : 'NON-DROP FRAME'}\n\n`;
    notes.forEach((note, i) => {
      const num = String(i + 1).padStart(3, '0');
      edl += `${num}  AX       V     C        ${note.timecodeIn} ${note.timecodeOut} ${note.timecodeIn} ${note.timecodeOut}\n`;
      edl += `* FROM CLIP NAME: ${note.note.substring(0, 50)}\n* COMMENT: ${note.note}\n\n`;
    });
    return edl;
  };

  const generateFCPXML = () => {
    const prod = metadataFields.find(f => f.id === 'production')?.value || 'Untitled';
    const fpsNum = fps === 29.97 ? 30000 : fps === 23.976 ? 24000 : fps === 59.94 ? 60000 : Math.round(fps) * 1000;
    const fpsDen = (fps === 29.97 || fps === 23.976 || fps === 59.94) ? 1001 : 1000;
    const tcToFrames = (tc) => {
      const [h, m, s, f] = tc.replace(';', ':').split(':').map(Number);
      return Math.round((h * 3600 + m * 60 + s) * fps) + f;
    };
    const toRat = (f) => `${f * fpsDen}/${fpsNum}s`;

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE fcpxml>\n<fcpxml version="1.10">\n  <resources>\n    <format id="r1" name="FFVideoFormat${Math.round(fps)}p" frameDuration="${fpsDen}/${fpsNum}s"/>\n  </resources>\n  <library>\n    <event name="${prod} Markers">\n      <project name="${prod} Notes">\n        <sequence format="r1">\n          <spine>\n`;
    notes.forEach(note => {
      const sf = tcToFrames(note.timecodeIn);
      const ef = tcToFrames(note.timecodeOut);
      const dur = Math.max(ef - sf, 1);
      xml += `            <marker start="${toRat(sf)}" duration="${toRat(dur)}" value="${note.note.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')}"/>\n`;
    });
    xml += `          </spine>\n        </sequence>\n      </project>\n    </event>\n  </library>\n</fcpxml>`;
    return xml;
  };

  const generatePremiereMarkers = () => {
    let csv = `Marker Name\tDescription\tIn\tOut\tDuration\tMarker Type\n`;
    notes.forEach(note => {
      csv += `${note.note.substring(0, 50).replace(/\t/g, ' ')}\t${note.note.replace(/\t/g, ' ').replace(/\n/g, ' ')}\t${note.timecodeIn}\t${note.timecodeOut}\t00:00:00:01\tComment\n`;
    });
    return csv;
  };

  const generateALE = () => {
    const prod = metadataFields.find(f => f.id === 'production')?.value || 'Untitled';
    let ale = `Heading\nFIELD_DELIM\tTABS\nVIDEO_FORMAT\t${Math.round(fps)}p\nTAPE\t${prod}\nFPS\t${fps}\n\nColumn\nName\tStart\tEnd\tComments\tMark Type\n\nData\n`;
    notes.forEach((note, i) => {
      ale += `Marker_${String(i + 1).padStart(3, '0')}\t${note.timecodeIn}\t${note.timecodeOut}\t${note.note.replace(/\t/g, ' ').replace(/\n/g, ' ')}\t${note.type}\n`;
    });
    return ale;
  };

  // Web-native file download helper
  // Share or download file — uses native share sheet on mobile, falls back to download
 // Share (mobile) or download (desktop)
  const shareFile = async (content, filename, mimeType) => {
    const blob = new Blob([content], { type: mimeType });

    // Only try share sheet on mobile/tablet (touch devices with narrow screens)
    const isMobile = 'ontouchstart' in window && window.innerWidth < 1024;

    if (isMobile && navigator.share && navigator.canShare) {
      const file = new File([blob], filename, { type: mimeType });
      if (navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: filename });
          return;
        } catch (err) {
          if (err.name === 'AbortError') return;
        }
      }
    }

    // Desktop: straight to downloads
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement('a');
    link.href = url;
    link.download = filename;
    window.document.body.appendChild(link);
    link.click();
    window.document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(csvContent);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2500);
    } catch (err) {
      const textArea = window.document.getElementById('csv-preview');
      if (textArea) { textArea.select(); window.document.execCommand('copy'); }
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2500);
    }
  };

  // ─── TC INPUT HANDLERS ──────────────────────────────────────────────────

  const handleTCFocus = (fieldName) => { setEditingField(fieldName); setEditingValue(''); };

  const handleTCBlur = (setter, max) => {
    if (editingValue !== '') { setter(Math.min(parseInt(editingValue, 10) || 0, max)); }
    setEditingField(null); setEditingValue('');
  };

  const handleTCChange = (e, setter, max) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    setEditingValue(value);
    if (value.length >= 2) { setter(Math.min(parseInt(value.slice(0, 2), 10) || 0, max)); }
  };

  const syncToNow = () => {
    const now = new Date();
    setHours(now.getHours()); setMinutes(now.getMinutes()); setSeconds(now.getSeconds()); setFrames(0);
    tcOffsetRef.current = 0;
    try { localStorage.setItem('tnp_tc_offset', '0'); } catch (e) {}
    setIsEditing(false);
    setIsRunning(true);
    setTimeout(() => saveCurrentSession(), 100);
  };

  // ─── SHARED STYLES ─────────────────────────────────────────────────────

  const S = {
    btn: { fontFamily: 'inherit', cursor: 'pointer', border: 'none' },
    input: {
      width: '100%', padding: '10px', fontSize: '14px', fontFamily: 'inherit',
      background: '#141416', border: '1px solid #333', borderRadius: '4px',
      color: '#e8e8e8', outline: 'none', boxSizing: 'border-box'
    },
    label: {
      fontSize: '10px', fontWeight: '600', letterSpacing: '0.15em',
      textTransform: 'uppercase', color: '#666'
    },
    card: {
      background: '#1a1a1e', border: '1px solid #2a2a2e', borderRadius: '6px', padding: '12px'
    }
  };

  // ─── LOADING STATE ──────────────────────────────────────────────────────

  if (!sessionsLoaded) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(180deg, #0a0a0b 0%, #121214 100%)', color: '#00ff88'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '28px', marginBottom: '12px', animation: 'pulse 1s infinite' }}>⏱</div>
          <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: '14px' }}>Loading sessions...</div>
        </div>
        <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
      </div>
    );
  }

  // ─── RENDER ─────────────────────────────────────────────────────────────

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #0a0a0b 0%, #121214 100%)',
      color: '#e8e8e8',
      fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
      padding: '16px',
      paddingTop: '20px',
      paddingBottom: '24px',
      maxWidth: '1200px',
      margin: '0 auto',
      overflowX: 'hidden'
    }}>
      {/* Google Font */}
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&display=swap" rel="stylesheet" />

      {/* ─── HEADER ────────────────────────────────────────────────── */}
      <header style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '12px', borderBottom: '1px solid #2a2a2e', paddingBottom: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '10px', height: '10px', borderRadius: '50%',
            background: isRunning ? '#00ff88' : '#ff4444',
            boxShadow: isRunning ? '0 0 12px #00ff88' : '0 0 12px #ff4444',
            animation: isRunning ? 'pulse 1s infinite' : 'none'
          }} />
          <h1 style={{
            fontSize: '18px', fontWeight: '700', fontFamily: "'Outfit', sans-serif",
            color: '#fff', margin: 0, letterSpacing: '-0.02em'
          }}>
            Take Note <span style={{ color: '#00ff88', fontWeight: '600' }}>Pro</span>
          </h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Tier badge */}
          <span style={{
            fontSize: '9px', fontWeight: '700', letterSpacing: '0.1em',
            textTransform: 'uppercase', padding: '4px 8px', borderRadius: '4px',
            background: isPro ? '#00ff88' : '#333',
            color: isPro ? '#000' : '#888'
          }}>
            {isPro ? 'PRO' : 'FREE'}
          </span>
          {/* Status indicator */}
          {!isOnline ? (
            <span style={{
              fontSize: '9px', letterSpacing: '0.1em', padding: '3px 8px',
              background: 'rgba(255, 68, 68, 0.15)', color: '#ff6666',
              borderRadius: '4px', fontWeight: '600'
            }}>
              OFFLINE
            </span>
          ) : isSaving ? (
            <span style={{ fontSize: '9px', color: '#ffaa00', letterSpacing: '0.1em' }}>Saving...</span>
          ) : null}
          <div style={{ fontSize: '11px', color: '#666', letterSpacing: '0.1em', fontFamily: "'SF Mono', 'Fira Code', monospace" }}>
            {fps} FPS
          </div>
          {/* User menu */}
          {isPro && (
            <button onClick={async () => {
              try {
                const res = await fetch('/api/create-portal-session', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ email: user?.email })
                });
                const data = await res.json();
                if (data.url) window.location.href = data.url;
                else alert('Unable to open subscription management. Please try again.');
              } catch (err) {
                alert('Unable to open subscription management. Please check your connection.');
              }
            }} style={{
              ...S.btn, background: 'transparent', color: '#00ff88', fontSize: '10px',
              padding: '4px 8px', border: '1px solid #00ff88', borderRadius: '4px'
            }}>
              Manage Plan
            </button>
          )}
          {!isPro && (
            <button onClick={onShowPricing} style={{
              ...S.btn, background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
              color: '#000', fontSize: '10px', fontWeight: '700',
              padding: '4px 10px', borderRadius: '4px', letterSpacing: '0.05em'
            }}>
              ⚡ Upgrade
            </button>
          )}
          <button onClick={onLogout} style={{
            ...S.btn, background: 'transparent', color: '#666', fontSize: '10px',
            padding: '4px 8px', border: '1px solid #333', borderRadius: '4px'
          }}>
            Logout
          </button>
        </div>
      </header>

      {/* ─── OFFLINE BANNER ─────────────────────────────────────────── */}
      {!isOnline && (
        <div style={{
          background: 'rgba(255, 68, 68, 0.1)', border: '1px solid rgba(255, 68, 68, 0.3)',
          borderRadius: '6px', padding: '8px 12px', marginBottom: '12px',
          display: 'flex', alignItems: 'center', gap: '8px'
        }}>
          <span style={{ fontSize: '12px' }}>📡</span>
          <span style={{ fontSize: '11px', color: '#ff8888' }}>
            You're offline — notes are saved locally and will sync when you reconnect
          </span>
        </div>
      )}

      {/* ─── SESSION BAR ───────────────────────────────────────────── */}
      <div onClick={() => setShowSessionsPanel(true)} style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: '#1a1a1e', border: '1px solid #2a2a2e', borderRadius: '6px',
        padding: '10px 14px', marginBottom: '16px', cursor: 'pointer'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '14px' }}>📁</span>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '600', color: '#fff', fontFamily: "'Outfit', sans-serif" }}>
              {currentSessionId ? getCurrentSessionName() : 'No Session'}
            </div>
            <div style={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>
              {notes.filter(n => !n.deleted && !deletedNoteIds.has(n.id)).length} notes • Tap to manage sessions
            </div>
          </div>
        </div>
        <div style={{ fontSize: '18px', color: '#666' }}>›</div>
      </div>

      {/* ─── TIMECODE DISPLAY ──────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(145deg, #0d0d0f 0%, #18181c 100%)',
        border: '1px solid #2a2a2e', borderRadius: '8px', padding: '24px 16px',
        marginBottom: '16px', position: 'relative', overflow: 'hidden'
      }}>
        {/* Scan line effect */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)',
          pointerEvents: 'none'
        }} />

        {isEditing ? (
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px', marginBottom: '16px' }}>
              {[
                { value: hours, setter: setHours, max: 23, name: 'hours' },
                { value: minutes, setter: setMinutes, max: 59, name: 'minutes' },
                { value: seconds, setter: setSeconds, max: 59, name: 'seconds' },
                { value: frames, setter: setFrames, max: Math.ceil(fps) - 1, name: 'frames' }
              ].map((field, i) => (
                <React.Fragment key={i}>
                  {i > 0 && (
                    <span style={{ fontSize: '36px', fontWeight: '200', color: i === 3 && (fps === 29.97 || fps === 59.94) ? '#00ff88' : '#444' }}>
                      {i === 3 ? (fps === 29.97 || fps === 59.94 ? ';' : ':') : ':'}
                    </span>
                  )}
                  <input
                    type="text" inputMode="numeric" pattern="[0-9]*"
                    value={editingField === field.name ? editingValue : String(field.value).padStart(2, '0')}
                    onChange={(e) => handleTCChange(e, field.setter, field.max)}
                    onFocus={() => handleTCFocus(field.name)}
                    onBlur={() => handleTCBlur(field.setter, field.max)}
                    style={{
                      width: '60px', fontSize: '36px', fontWeight: '300',
                      fontFamily: "'SF Mono', 'Fira Code', monospace",
                      background: '#1a1a1e', border: `1px solid ${editingField === field.name ? '#00ff88' : '#333'}`,
                      borderRadius: '4px', color: '#00ff88', textAlign: 'center',
                      padding: '4px', outline: 'none', caretColor: '#00ff88'
                    }}
                    maxLength={2} aria-label={field.name}
                  />
                </React.Fragment>
              ))}
            </div>

            {/* FPS Selector */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
              {FPS_OPTIONS.map(option => (
                <button key={option.value} onClick={() => setFps(option.value)} style={{
                  ...S.btn, padding: '6px 12px', fontSize: '11px', fontFamily: 'inherit',
                  background: fps === option.value ? '#00ff88' : 'transparent',
                  color: fps === option.value ? '#000' : '#666',
                  border: `1px solid ${fps === option.value ? '#00ff88' : '#333'}`,
                  borderRadius: '4px', transition: 'all 0.15s ease'
                }}>
                  {option.label}
                </button>
              ))}
            </div>

            <button onClick={syncToNow} style={{
              ...S.btn, width: '100%', padding: '10px', fontSize: '11px', fontWeight: '600',
              letterSpacing: '0.1em', textTransform: 'uppercase',
              background: 'transparent', color: '#888', border: '1px dashed #444',
              borderRadius: '6px', marginBottom: '12px'
            }}>
              ⟳ Sync to Current Time
            </button>

            <button onClick={() => { updateTCOffset(); setIsEditing(false); setIsRunning(true); setTimeout(() => saveCurrentSession(), 100); }} style={{
              ...S.btn, width: '100%', padding: '14px', fontSize: '13px', fontWeight: '600',
              letterSpacing: '0.1em', textTransform: 'uppercase',
              background: 'linear-gradient(180deg, #00ff88 0%, #00cc6a 100%)',
              color: '#000', borderRadius: '6px'
            }}>
              Start Timecode
            </button>
          </div>
        ) : (
          <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
            <div style={{
              fontSize: '42px', fontWeight: '300', letterSpacing: '0.05em', color: '#00ff88',
              textShadow: '0 0 30px rgba(0, 255, 136, 0.3)', marginBottom: '16px'
            }}>
              {currentTC}
            </div>
            <button onClick={() => { setIsRunning(false); setIsEditing(true); }} style={{
              ...S.btn, padding: '10px 24px', fontSize: '12px', fontWeight: '600',
              letterSpacing: '0.1em', textTransform: 'uppercase',
              background: 'transparent', color: '#888', border: '1px solid #444', borderRadius: '4px'
            }}>
              Edit TC
            </button>
          </div>
        )}
      </div>

      {/* ─── TAB NAVIGATION ────────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: '2px', marginBottom: '16px',
        background: '#1a1a1e', padding: '4px', borderRadius: '6px'
      }}>
        {[
          { id: 'timecode', label: 'Notes' },
          { id: 'metadata', label: 'Metadata' },
          { id: 'miclist', label: 'Mic List' },
          { id: 'docs', label: isPro ? 'Docs' : 'Docs 🔒' },
          { id: 'log', label: `Log (${notes.length})` }
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            ...S.btn, flex: 1, padding: '10px', fontSize: '11px', fontWeight: '600',
            letterSpacing: '0.08em', textTransform: 'uppercase',
            background: activeTab === tab.id ? '#2a2a2e' : 'transparent',
            color: activeTab === tab.id ? '#fff' : '#666',
            borderRadius: '4px', transition: 'all 0.15s ease'
          }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── TAB CONTENT ───────────────────────────────────────────── */}
      <div style={{
        background: '#141416', border: '1px solid #2a2a2e', borderRadius: '8px',
        padding: '16px', minHeight: '300px'
      }}>

        {/* ── NOTES TAB ────────────────────────────────────────────── */}
        {activeTab === 'timecode' && (
          <div>
            {/* Free tier note count warning */}
            {!isPro && notes.length >= FREE_MAX_NOTES - 5 && (
              <div style={{
                background: 'rgba(255,170,0,0.1)', border: '1px solid #ffaa00',
                borderRadius: '6px', padding: '10px 12px', marginBottom: '12px',
                fontSize: '11px', color: '#ffaa00', textAlign: 'center'
              }}>
                {notes.length >= FREE_MAX_NOTES
                  ? <span>Note limit reached. <button onClick={onShowPricing} style={{ ...S.btn, background: 'none', color: '#00ff88', textDecoration: 'underline', fontSize: '11px', padding: 0 }}>Upgrade to Pro</button> for unlimited notes.</span>
                  : `${FREE_MAX_NOTES - notes.length} notes remaining on Free tier`
                }
              </div>
            )}

            {/* Quick Note */}
            <div style={{ marginBottom: '20px' }}>
              <textarea
                ref={quickNoteRef} value={quickNote}
                onChange={(e) => setQuickNote(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleQuickNote(); } }}
                placeholder="Type a note..." disabled={isLongNoteMode}
                style={{
                  width: '100%', minHeight: '80px', padding: '16px', fontSize: '16px',
                  fontFamily: 'inherit', background: '#1a1a1e', border: '2px solid #333',
                  borderRadius: '8px', color: '#e8e8e8', outline: 'none',
                  opacity: isLongNoteMode ? 0.5 : 1, boxSizing: 'border-box',
                  resize: 'none', lineHeight: '1.4'
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                <div style={{ fontSize: '11px', color: '#00ff88', fontFamily: "'SF Mono', 'Fira Code', monospace" }}>
                  {currentTC}
                </div>
                <button onClick={handleQuickNote} disabled={!quickNote.trim() || isLongNoteMode} style={{
                  ...S.btn, padding: '8px 16px', fontSize: '12px', fontWeight: '600',
                  fontFamily: "'Outfit', sans-serif", borderRadius: '6px',
                  background: quickNote.trim() && !isLongNoteMode ? '#00ff88' : '#333',
                  color: quickNote.trim() && !isLongNoteMode ? '#000' : '#666',
                  cursor: quickNote.trim() && !isLongNoteMode ? 'pointer' : 'not-allowed'
                }}>
                  Save Note
                </button>
              </div>
            </div>

            {/* Long Note */}
            <div style={{
              background: isLongNoteMode ? 'rgba(255, 170, 0, 0.1)' : 'transparent',
              border: `1px solid ${isLongNoteMode ? '#ffaa00' : '#2a2a2e'}`,
              borderRadius: '8px', padding: '16px'
            }}>
              <label style={{ ...S.label, display: 'block', marginBottom: '8px', color: isLongNoteMode ? '#ffaa00' : '#666' }}>
                Long Note {isLongNoteMode && `(Started at ${longNoteStartTC})`}
              </label>

              {!isLongNoteMode ? (
                <button onClick={startLongNote} style={{
                  ...S.btn, width: '100%', padding: '14px', fontSize: '12px', fontWeight: '600',
                  letterSpacing: '0.1em', textTransform: 'uppercase',
                  background: 'transparent', color: '#ffaa00', border: '1px dashed #ffaa00', borderRadius: '6px'
                }}>
                  Start Long Note
                </button>
              ) : (
                <>
                  <textarea value={longNote} onChange={(e) => setLongNote(e.target.value)}
                    placeholder="Type your detailed note here..." autoFocus
                    style={{
                      width: '100%', minHeight: '120px', padding: '14px', fontSize: '14px',
                      fontFamily: 'inherit', background: '#1a1a1e', border: '1px solid #ffaa00',
                      borderRadius: '6px', color: '#e8e8e8', outline: 'none',
                      resize: 'vertical', marginBottom: '12px', boxSizing: 'border-box'
                    }}
                  />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={saveLongNote} style={{
                      ...S.btn, flex: 1, padding: '12px', fontSize: '12px', fontWeight: '600',
                      letterSpacing: '0.1em', textTransform: 'uppercase',
                      background: '#ffaa00', color: '#000', borderRadius: '4px'
                    }}>
                      Save ({longNoteStartTC} → {currentTC})
                    </button>
                    <button onClick={cancelLongNote} style={{
                      ...S.btn, padding: '12px 20px', fontSize: '12px', fontWeight: '600',
                      letterSpacing: '0.1em', textTransform: 'uppercase',
                      background: 'transparent', color: '#888', border: '1px solid #444', borderRadius: '4px'
                    }}>
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── METADATA TAB ──────────────────────────────────────────── */}
        {activeTab === 'metadata' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {metadataFields.map((field) => (
              <div key={field.id} style={S.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  {editingLabelId === field.id ? (
                    <input type="text" value={editingLabelValue}
                      onChange={(e) => setEditingLabelValue(e.target.value)}
                      onBlur={() => { if (editingLabelValue.trim()) updateMetadataLabel(field.id, editingLabelValue.trim()); setEditingLabelId(null); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') { if (editingLabelValue.trim()) updateMetadataLabel(field.id, editingLabelValue.trim()); setEditingLabelId(null); }}}
                      autoFocus style={{ ...S.label, background: '#141416', border: '1px solid #00ff88', borderRadius: '3px', color: '#00ff88', padding: '4px 8px', outline: 'none', width: '150px' }}
                    />
                  ) : (
                    <label onClick={() => { setEditingLabelId(field.id); setEditingLabelValue(field.label); }}
                      style={{ ...S.label, cursor: 'pointer', padding: '4px 0' }} title="Click to edit label">
                      {field.label}
                    </label>
                  )}
                  <button onClick={() => removeMetadataField(field.id)} style={{ ...S.btn, background: 'transparent', color: '#555', fontSize: '18px', padding: '0 4px', lineHeight: 1 }}>×</button>
                </div>
                <input type="text" value={field.value} onChange={(e) => updateMetadataValue(field.id, e.target.value)}
                  placeholder={field.placeholder} style={S.input}
                />
              </div>
            ))}

            {/* Add new field */}
            <div style={{ border: '1px dashed #333', borderRadius: '6px', padding: '12px' }}>
              <label style={{ ...S.label, display: 'block', marginBottom: '8px', color: '#555' }}>Add Custom Field</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input type="text" value={newFieldName} onChange={(e) => setNewFieldName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addMetadataField(); }}
                  placeholder="Field name..." style={{ ...S.input, flex: 1, background: '#1a1a1e' }}
                />
                <button onClick={addMetadataField} disabled={!newFieldName.trim()} style={{
                  ...S.btn, padding: '10px 16px', fontSize: '12px', fontWeight: '600',
                  background: newFieldName.trim() ? '#00ff88' : '#333',
                  color: newFieldName.trim() ? '#000' : '#666', borderRadius: '4px',
                  cursor: newFieldName.trim() ? 'pointer' : 'not-allowed'
                }}>
                  + Add
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── MIC LIST TAB ──────────────────────────────────────────── */}
        {activeTab === 'miclist' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button onClick={() => setShowMicExport(true)} style={{
              ...S.btn, width: '100%', padding: '12px', fontSize: '11px', fontWeight: '600',
              letterSpacing: '0.1em', textTransform: 'uppercase',
              background: 'linear-gradient(180deg, #3366ff 0%, #2255dd 100%)',
              color: '#fff', borderRadius: '6px'
            }}>
              Export Mic List
            </button>

            {mics.map((mic) => (
              <div key={mic.id} style={{ background: '#1a1a1e', border: '1px solid #2a2a2e', borderRadius: '8px', overflow: 'hidden' }}>
                {/* Mic header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderBottom: '1px solid #2a2a2e', background: '#141416' }}>
                  <div style={{ background: '#00ff88', color: '#000', fontWeight: '700', fontSize: '14px', padding: '6px 10px', borderRadius: '4px', minWidth: '45px', textAlign: 'center' }}>
                    {mic.number}
                  </div>
                  <input type="text" value={mic.frequency} onChange={(e) => updateMicField(mic.id, 'frequency', e.target.value)}
                    placeholder="Frequency (e.g., 606.500)"
                    style={{ flex: 1, padding: '8px', fontSize: '13px', fontFamily: "'SF Mono', 'Fira Code', monospace", background: '#1a1a1e', border: '1px solid #333', borderRadius: '4px', color: '#ffaa00', outline: 'none' }}
                  />
                  <button onClick={() => removeMic(mic.id)} style={{ ...S.btn, background: 'transparent', color: '#555', fontSize: '20px', padding: '0 4px', lineHeight: 1 }}>×</button>
                </div>

                {/* Assignments */}
                <div style={{ padding: '12px' }}>
                  {mic.assignments.map((assignment, index) => (
                    <div key={index} style={{
                      display: 'flex', gap: '10px', padding: '10px',
                      marginBottom: index < mic.assignments.length - 1 ? '8px' : '12px',
                      background: '#141416', borderRadius: '6px',
                      border: assignment.timecode ? '1px solid #333' : '1px solid transparent'
                    }}>
                      {/* Photo */}
                      <div style={{
                        width: '50px', height: '50px', background: '#1a1a1e', border: '1px dashed #444',
                        borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        overflow: 'hidden', flexShrink: 0, cursor: 'pointer', position: 'relative'
                      }}>
                        {assignment.image ? (
                          <img src={assignment.image} alt={assignment.name || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <span style={{ fontSize: '9px', color: '#555', textAlign: 'center' }}>+ Photo</span>
                        )}
                        <input type="file" accept="image/*" onChange={(e) => handleMicImageUpload(mic.id, index, e)}
                          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                        />
                      </div>

                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input type="text" value={assignment.name}
                            onChange={(e) => updateMicAssignment(mic.id, index, e.target.value)}
                            placeholder={index === 0 ? "Person name..." : "New person..."}
                            style={{ flex: 1, padding: '8px', fontSize: '14px', fontFamily: 'inherit', background: '#1a1a1e', border: '1px solid #333', borderRadius: '4px', color: '#e8e8e8', outline: 'none' }}
                          />
                          {index > 0 && (
                            <button onClick={() => removeAssignment(mic.id, index)} style={{ ...S.btn, background: 'transparent', color: '#555', fontSize: '16px', padding: '0 4px', lineHeight: 1 }}>×</button>
                          )}
                        </div>
                        {assignment.timecode && (
                          <span style={{ fontSize: '10px', fontFamily: "'SF Mono', 'Fira Code', monospace", color: '#ffaa00' }}>
                            Changed @ {assignment.timecode}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}

                  <button onClick={() => addPersonChange(mic.id)} style={{
                    ...S.btn, width: '100%', padding: '8px', fontSize: '10px', fontWeight: '600',
                    letterSpacing: '0.1em', textTransform: 'uppercase',
                    background: 'transparent', color: '#666', border: '1px dashed #333', borderRadius: '4px'
                  }}>
                    + Change Person @ {currentTC}
                  </button>
                </div>
              </div>
            ))}

            <button onClick={addMic} style={{
              ...S.btn, width: '100%', padding: '14px', fontSize: '12px', fontWeight: '600',
              letterSpacing: '0.1em', textTransform: 'uppercase',
              background: '#00ff88', color: '#000', borderRadius: '6px'
            }}>
              + Add Mic Channel
            </button>
          </div>
        )}

        {/* ── DOCS TAB ──────────────────────────────────────────────── */}
        {activeTab === 'docs' && (
          isPro ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ ...S.label, fontSize: '12px', margin: 0, color: '#888' }}>Documents</h3>
                <label style={{
                  padding: '8px 16px', fontSize: '11px', fontWeight: '600', letterSpacing: '0.08em',
                  textTransform: 'uppercase', background: 'linear-gradient(180deg, #3366ff 0%, #2255dd 100%)',
                  color: '#fff', borderRadius: '6px', cursor: 'pointer'
                }}>
                  + Add Document
                  <input type="file" accept=".pdf,image/*" onChange={(e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    if (file.size > 10 * 1024 * 1024) { alert('File too large. Please use under 10MB.'); return; }
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      setDocuments(prev => [{
                        id: `doc_${Date.now()}`, name: file.name, type: file.type,
                        data: reader.result, addedAt: new Date().toISOString(), sessionId: currentSessionId
                      }, ...prev]);
                    };
                    reader.readAsDataURL(file);
                    e.target.value = '';
                  }} style={{ display: 'none' }} />
                </label>
              </div>

              <p style={{ fontSize: '11px', color: '#666', marginBottom: '16px' }}>
                Upload call sheets, schedules, or script pages for quick reference.
              </p>

              {documents.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#555' }}>
                  <div style={{ fontSize: '32px', marginBottom: '12px' }}>📄</div>
                  <div style={{ fontSize: '13px' }}>No documents yet</div>
                  <div style={{ fontSize: '11px', color: '#444', marginTop: '4px' }}>Add a call sheet or schedule to reference during your session</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {documents.map(doc => (
                    <div key={doc.id} style={{ ...S.card, display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '40px', height: '40px', borderRadius: '6px', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '700', color: '#fff',
                        background: doc.type?.includes('pdf') ? '#ff4444' : '#3366ff'
                      }}>
                        {doc.type?.includes('pdf') ? 'PDF' : 'IMG'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: '600', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.name}</div>
                        <div style={{ fontSize: '10px', color: '#666' }}>Added {new Date(doc.addedAt).toLocaleDateString()}</div>
                      </div>
                      <button onClick={() => setViewingDocument(doc)} style={{
                        ...S.btn, padding: '8px 12px', fontSize: '10px', fontWeight: '600',
                        letterSpacing: '0.05em', textTransform: 'uppercase',
                        background: '#2a2a2e', color: '#fff', borderRadius: '4px'
                      }}>View</button>
                      <button onClick={() => { if (confirm('Delete this document?')) setDocuments(prev => prev.filter(d => d.id !== doc.id)); }}
                        style={{ ...S.btn, padding: '8px', fontSize: '14px', background: 'transparent', color: '#666' }}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <UpgradePrompt feature="Documents" onUpgrade={onShowPricing} />
          )
        )}

        {/* ── LOG TAB ───────────────────────────────────────────────── */}
        {activeTab === 'log' && (
          <div>
            {/* Custom note button */}
            <div style={{ marginBottom: '16px' }}>
              {!showCustomNote ? (
                <button onClick={() => { setShowCustomNote(true); setCustomNoteTC({ h: hours, m: minutes, s: seconds, f: frames }); }} style={{
                  ...S.btn, width: '100%', padding: '12px', fontSize: '11px', fontWeight: '600',
                  letterSpacing: '0.1em', textTransform: 'uppercase',
                  background: 'transparent', color: '#9966ff', border: '1px dashed #9966ff', borderRadius: '6px'
                }}>
                  + Add Custom Note (Retrospective)
                </button>
              ) : (
                <div style={{ background: 'rgba(153, 102, 255, 0.1)', border: '1px solid #9966ff', borderRadius: '8px', padding: '16px' }}>

 

                  <label style={{ ...S.label, display: 'block', marginBottom: '10px', color: '#9966ff' }}>Custom Timecode</label>

                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px', marginBottom: '12px' }}>
                    {[
                      { key: 'h', value: customNoteTC.h, max: 23 },
                      { key: 'm', value: customNoteTC.m, max: 59 },
                      { key: 's', value: customNoteTC.s, max: 59 },
                      { key: 'f', value: customNoteTC.f, max: Math.ceil(fps) - 1 }
                    ].map((field, i) => (
                      <React.Fragment key={field.key}>
                        {i > 0 && (
                          <span style={{ fontSize: '24px', fontWeight: '200', color: i === 3 && (fps === 29.97 || fps === 59.94) ? '#9966ff' : '#444' }}>
                            {i === 3 ? (fps === 29.97 || fps === 59.94 ? ';' : ':') : ':'}
                          </span>
                        )}
                        <input type="text" inputMode="numeric"
                          value={String(field.value).padStart(2, '0')}
                          onChange={(e) => { const val = parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0; setCustomNoteTC(prev => ({ ...prev, [field.key]: Math.min(val, field.max) })); }}
                          onFocus={(e) => e.target.select()}
                          style={{ width: '44px', fontSize: '24px', fontWeight: '300', fontFamily: "'SF Mono', 'Fira Code', monospace", background: '#1a1a1e', border: '1px solid #9966ff', borderRadius: '4px', color: '#9966ff', textAlign: 'center', padding: '4px', outline: 'none' }}
                          maxLength={2}
                        />
                      </React.Fragment>
                    ))}
                  </div>

                  <textarea value={customNoteText} onChange={(e) => setCustomNoteText(e.target.value)}
                    placeholder="Enter your note..."
                    style={{ width: '100%', minHeight: '80px', padding: '12px', fontSize: '14px', fontFamily: 'inherit', background: '#1a1a1e', border: '1px solid #333', borderRadius: '6px', color: '#e8e8e8', outline: 'none', resize: 'vertical', marginBottom: '12px', boxSizing: 'border-box' }}
                  />

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={addCustomNote} disabled={!customNoteText.trim()} style={{
                      ...S.btn, flex: 1, padding: '12px', fontSize: '12px', fontWeight: '600',
                      letterSpacing: '0.1em', textTransform: 'uppercase',
                      background: customNoteText.trim() ? '#9966ff' : '#333',
                      color: customNoteText.trim() ? '#fff' : '#666', borderRadius: '4px',
                      cursor: customNoteText.trim() ? 'pointer' : 'not-allowed'
                    }}>Add Note</button>
                    <button onClick={() => { setShowCustomNote(false); setCustomNoteText(''); }} style={{
                      ...S.btn, padding: '12px 20px', fontSize: '12px', fontWeight: '600',
                      letterSpacing: '0.1em', textTransform: 'uppercase',
                      background: 'transparent', color: '#888', border: '1px solid #444', borderRadius: '4px'
                    }}>Cancel</button>
                  </div>
                </div>
              )}
            </div>

                                         {notes.length > 0 && (
              <button onClick={generateCSV} style={{
                ...S.btn, width: '100%', marginTop: '16px', marginBottom: '10px', padding: '14px', fontSize: '12px',
                fontWeight: '600', letterSpacing: '0.1em', textTransform: 'uppercase',
                background: 'linear-gradient(180deg, #3366ff 0%, #2255dd 100%)',
                color: '#fff', borderRadius: '6px'
              }}>
                Export Log
              </button>
            )}

            {notes.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#555', padding: '40px 20px', fontSize: '13px' }}>
                No notes yet. Add notes from the Notes tab.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[...notes].filter(n => !n.deleted && !deletedNoteIds.has(n.id)).reverse().map((note, index) => (
                  <div key={note.id} style={{
                    ...S.card, borderLeft: `3px solid ${note.type === 'quick' ? '#00ff88' : note.type === 'custom' ? '#9966ff' : '#ffaa00'}`
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div style={{ fontSize: '12px', fontFamily: 'inherit', color: note.type === 'quick' ? '#00ff88' : note.type === 'custom' ? '#9966ff' : '#ffaa00' }}>
                        {note.timecodeIn}
                        {note.timecodeIn !== note.timecodeOut && <span style={{ color: '#666' }}> → {note.timecodeOut}</span>}
                      </div>
                      <button onClick={() => deleteNote(note.id)} style={{ ...S.btn, background: 'transparent', color: '#666', fontSize: '16px', padding: '0 4px', lineHeight: 1 }}>×</button>
                    </div>
                    <div style={{ fontSize: '13px', color: '#ccc', lineHeight: '1.5' }}>{note.note}</div>
                    <div style={{ fontSize: '9px', color: '#444', marginTop: '6px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                      {note.type} note • #{index + 1}
                    </div>
                  </div>
                ))}
              </div>
            )}


          </div>
        )}
      </div>

      {/* ─── EXPORT MODAL ──────────────────────────────────────────── */}
      {showExportModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', padding: '20px', zIndex: 1000
        }}>
          <div style={{
            background: '#1a1a1e', border: '1px solid #333', borderRadius: '12px',
            padding: '24px', maxWidth: '500px', width: '100%', maxHeight: '80vh',
            overflow: 'hidden', display: 'flex', flexDirection: 'column'
          }}>
            <h3 style={{ ...S.label, fontSize: '14px', color: '#fff', marginBottom: '20px', marginTop: 0 }}>Export Log</h3>

            <div style={{ background: '#141416', border: '1px solid #2a2a2e', borderRadius: '6px', padding: '16px', marginBottom: '16px', fontSize: '12px', color: '#888' }}>
              <div style={{ marginBottom: '8px' }}><strong style={{ color: '#ccc' }}>{notes.length}</strong> notes will be exported</div>
              {metadataFields.filter(f => f.value).slice(0, 3).map(f => <div key={f.id}>{f.label}: {f.value}</div>)}
              <div>Frame Rate: {fps} FPS</div>
            </div>

            <textarea id="csv-preview" readOnly value={csvContent} style={{
              background: '#0a0a0b', border: '1px solid #2a2a2e', borderRadius: '6px',
              padding: '12px', marginBottom: '16px', fontSize: '10px',
              fontFamily: "'SF Mono', 'Fira Code', monospace", color: '#888',
              overflow: 'auto', minHeight: '150px', maxHeight: '200px', whiteSpace: 'pre',
              width: '100%', boxSizing: 'border-box', resize: 'none'
            }} onFocus={(e) => e.target.select()} />

            <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
              {/* Share/Download CSV */}
              <button onClick={() => {
                const prod = metadataFields.find(f => f.id === 'production')?.value || 'notes';
                shareFile(csvContent, `${prod.replace(/[^a-zA-Z0-9]/g, '_')}_log_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
              }} style={{
                ...S.btn, width: '100%', padding: '14px', fontSize: '12px', fontWeight: '600',
                letterSpacing: '0.1em', textTransform: 'uppercase',
                background: 'linear-gradient(180deg, #00ff88 0%, #00cc6a 100%)', color: '#000', borderRadius: '6px'
              }}>
                Share CSV
              </button>

              {/* NLE Exports — Pro only */}
              {isPro ? (
                <div style={{ borderTop: '1px solid #333', marginTop: '8px', paddingTop: '16px' }}>
                  <p style={{ ...S.label, textAlign: 'center', marginBottom: '12px', marginTop: 0, fontSize: '10px', color: '#888' }}>Export for NLE</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {[
                      { label: '📋 EDL (Universal)', fn: generateEDL, ext: 'edl', mime: 'text/plain' },
                      { label: '🎬 Final Cut Pro', fn: generateFCPXML, ext: 'fcpxml', mime: 'application/xml' },
                      { label: '🎞️ Premiere Pro', fn: generatePremiereMarkers, ext: 'tsv', mime: 'text/tab-separated-values' },
                      { label: '🎛️ Avid (ALE)', fn: generateALE, ext: 'ale', mime: 'text/plain' },
                    ].map(item => (
                      <button key={item.ext} onClick={() => {
                        const prod = metadataFields.find(f => f.id === 'production')?.value || 'notes';
                        shareFile(item.fn(), `${prod.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.${item.ext}`, item.mime);
                      }} style={{
                        ...S.btn, padding: '12px 8px', fontSize: '10px', fontWeight: '600',
                        letterSpacing: '0.05em', textTransform: 'uppercase',
                        background: '#2a2a2e', color: '#fff', borderRadius: '6px'
                      }}>
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ borderTop: '1px solid #333', marginTop: '8px', paddingTop: '16px', textAlign: 'center' }}>
                  <p style={{ fontSize: '11px', color: '#888', marginBottom: '8px' }}>NLE exports (EDL, FCPXML, Premiere, Avid) available with Pro</p>
                  <button onClick={onShowPricing} style={{
                    ...S.btn, padding: '10px 24px', fontSize: '11px', fontWeight: '600',
                    background: 'transparent', color: '#00ff88', border: '1px solid #00ff88',
                    borderRadius: '6px'
                  }}>
                    Upgrade to Pro
                  </button>
                </div>
              )}

              <button onClick={copyToClipboard} style={{
                ...S.btn, width: '100%', padding: '14px', fontSize: '12px', fontWeight: '600',
                letterSpacing: '0.1em', textTransform: 'uppercase',
                background: copyFeedback ? '#00ff88' : '#2a2a2e',
                color: copyFeedback ? '#000' : '#fff', borderRadius: '6px', marginTop: '8px',
                transition: 'all 0.3s ease',
                transform: copyFeedback ? 'scale(1.02)' : 'scale(1)'
              }}>
                {copyFeedback ? '✓ Copied to Clipboard!' : 'Copy to Clipboard'}
              </button>

              <button onClick={() => setShowExportModal(false)} style={{
                ...S.btn, padding: '12px 20px', fontSize: '12px', fontWeight: '600',
                letterSpacing: '0.1em', textTransform: 'uppercase',
                background: 'transparent', color: '#888', border: '1px solid #444', borderRadius: '6px'
              }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MIC LIST EXPORT MODAL ─────────────────────────────────── */}
      {showMicExport && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', padding: '20px', zIndex: 1000
        }}>
          <div style={{
            background: '#1a1a1e', border: '1px solid #333', borderRadius: '12px',
            padding: '24px', maxWidth: '500px', width: '100%', maxHeight: '85vh',
            overflow: 'hidden', display: 'flex', flexDirection: 'column'
          }}>
            <h3 style={{ ...S.label, fontSize: '14px', color: '#fff', marginBottom: '16px', marginTop: 0 }}>Export Mic List</h3>

            {/* Preview */}
            <div style={{ flex: 1, overflow: 'auto', background: '#fff', borderRadius: '6px', padding: '16px', marginBottom: '16px', color: '#000', fontSize: '12px' }}>
              <h2 style={{ fontSize: '18px', margin: '0 0 4px 0', color: '#000' }}>Radio Mic List</h2>
              <div style={{ color: '#666', marginBottom: '16px', fontSize: '11px' }}>
                {metadataFields.find(f => f.id === 'production')?.value || 'Production'} • {new Date().toLocaleDateString()}
              </div>

              {mics.filter(mic => mic.assignments.some(a => a.name) || mic.frequency).length > 0 ? (
                mics.filter(mic => mic.assignments.some(a => a.name) || mic.frequency).map(mic => (
                  <div key={mic.id} style={{ border: '1px solid #ddd', borderRadius: '6px', marginBottom: '10px', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#f5f5f5', borderBottom: '1px solid #ddd' }}>
                      <span style={{ background: '#000', color: '#fff', fontWeight: '700', fontSize: '11px', padding: '3px 6px', borderRadius: '3px' }}>CH {mic.number}</span>
                      <span style={{ fontFamily: 'monospace', color: '#666', fontSize: '10px' }}>{mic.frequency}</span>
                    </div>
                    {mic.assignments.filter(a => a.name).map((assignment, i) => (
                      <div key={i} style={{ display: 'flex', gap: '10px', padding: '10px 12px', borderTop: i > 0 ? '1px solid #eee' : 'none', alignItems: 'center' }}>
                        {assignment.image ? (
                          <img src={assignment.image} alt={assignment.name} style={{ width: '36px', height: '36px', borderRadius: '4px', objectFit: 'cover', flexShrink: 0 }} />
                        ) : (
                          <div style={{ width: '36px', height: '36px', borderRadius: '4px', background: '#f0f0f0', flexShrink: 0 }} />
                        )}
                        <div>
                          <strong style={{ fontSize: '12px' }}>{assignment.name}</strong>
                          {assignment.timecode && <div style={{ fontFamily: 'monospace', fontSize: '9px', color: '#888' }}>Changed @ {assignment.timecode}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                ))
              ) : (
                <div style={{ color: '#888', textAlign: 'center', padding: '20px' }}>No mic data to export.</div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
              <button onClick={async () => {
                try {
                  const prod = metadataFields.find(f => f.id === 'production')?.value || 'mic-list';
                  const date = new Date().toLocaleDateString();
                  const filename = `${prod.replace(/[^a-zA-Z0-9]/g, '_')}_mic_list_${new Date().toISOString().split('T')[0]}.pdf`;
                  const pdf = new jsPDF();
                  let yPos = 20;
                  const pageHeight = pdf.internal.pageSize.height;
                  const margin = 15;

                  pdf.setFontSize(22); pdf.setFont('helvetica', 'bold');
                  pdf.text('Radio Mic List', margin, yPos); yPos += 8;
                  pdf.setFontSize(11); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(100);
                  pdf.text(`${prod} • ${date}`, margin, yPos); pdf.setTextColor(0); yPos += 15;

                  for (const mic of mics) {
                    if (!mic.assignments.some(a => a.name) && !mic.frequency) continue;
                    if (yPos > pageHeight - 60) { pdf.addPage(); yPos = 20; }

                    pdf.setFillColor(245, 245, 245);
                    pdf.rect(margin, yPos - 5, pdf.internal.pageSize.width - margin * 2, 12, 'F');
                    pdf.setFillColor(0);
                    pdf.roundedRect(margin + 2, yPos - 4, 22, 10, 2, 2, 'F');
                    pdf.setTextColor(255); pdf.setFontSize(10); pdf.setFont('helvetica', 'bold');
                    pdf.text(`CH ${mic.number}`, margin + 5, yPos + 3);
                    pdf.setTextColor(100); pdf.setFont('helvetica', 'normal');
                    if (mic.frequency) pdf.text(mic.frequency, margin + 30, yPos + 3);
                    pdf.setTextColor(0); yPos += 14;

                    for (const assignment of mic.assignments) {
                      if (!assignment.name) continue;
                      if (yPos > pageHeight - 40) { pdf.addPage(); yPos = 20; }
                      if (assignment.image) {
                        try { pdf.addImage(assignment.image, 'JPEG', margin + 2, yPos, 15, 15); } catch (e) { pdf.setFillColor(238); pdf.rect(margin + 2, yPos, 15, 15, 'F'); }
                      } else { pdf.setFillColor(238, 238, 238); pdf.rect(margin + 2, yPos, 15, 15, 'F'); }
                      pdf.setFontSize(12); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(0);
                      pdf.text(assignment.name, margin + 22, yPos + 6);
                      if (assignment.timecode) { pdf.setFontSize(9); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(130); pdf.text(`Changed @ ${assignment.timecode}`, margin + 22, yPos + 12); pdf.setTextColor(0); }
                      yPos += 20;
                    }
                    yPos += 5;
                  }

                  // Try share sheet, fall back to direct download
                  const pdfBlob = pdf.output('blob');
                  const pdfFile = new File([pdfBlob], filename, { type: 'application/pdf' });
                  const isMobile = 'ontouchstart' in window && window.innerWidth < 1024;
                  if (isMobile && navigator.share && navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
                    try {
                      await navigator.share({ files: [pdfFile], title: filename });
                    } catch (shareErr) {
                      if (shareErr.name !== 'AbortError') pdf.save(filename);
                    }
                  } else {
                    pdf.save(filename);
                  }
                } catch (err) { console.error('PDF error:', err); alert('Error generating PDF.'); }
              }} style={{
                ...S.btn, width: '100%', padding: '14px', fontSize: '12px', fontWeight: '600',
                letterSpacing: '0.1em', textTransform: 'uppercase',
                background: 'linear-gradient(180deg, #00ff88 0%, #00cc6a 100%)', color: '#000', borderRadius: '6px'
              }}>
                Share Mic List PDF
              </button>

              <button onClick={() => setShowMicExport(false)} style={{
                ...S.btn, padding: '12px 20px', fontSize: '12px', fontWeight: '600',
                letterSpacing: '0.1em', textTransform: 'uppercase',
                background: 'transparent', color: '#888', border: '1px solid #444', borderRadius: '6px'
              }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── SESSIONS PANEL ────────────────────────────────────────── */}
      {showSessionsPanel && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', padding: '20px', zIndex: 1000
        }}>
          <div style={{
            background: '#1a1a1e', border: '1px solid #333', borderRadius: '12px',
            padding: '24px', maxWidth: '500px', width: '100%', maxHeight: '80vh',
            overflow: 'hidden', display: 'flex', flexDirection: 'column'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ ...S.label, fontSize: '14px', color: '#fff', margin: 0 }}>Sessions</h3>
              <button onClick={() => setShowSessionsPanel(false)} style={{ ...S.btn, background: 'transparent', color: '#888', fontSize: '18px', padding: '0 4px', lineHeight: 1 }}>×</button>
            </div>

            {/* New session */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <input type="text" value={newSessionName} onChange={(e) => setNewSessionName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') createNewSession(); }}
                placeholder="New session name..."
                style={{ ...S.input, flex: 1, background: '#141416' }}
              />
              <button onClick={() => createNewSession()} style={{
                ...S.btn, padding: '10px 16px', fontSize: '12px', fontWeight: '600',
                background: '#00ff88', color: '#000', borderRadius: '4px',
                opacity: (!isPro && sessions.length >= FREE_MAX_SESSIONS) ? 0.5 : 1
              }}>
                + New
              </button>
            </div>

            {!isPro && sessions.length >= FREE_MAX_SESSIONS && (
              <div style={{
                background: 'rgba(255,170,0,0.1)', border: '1px solid #ffaa00',
                borderRadius: '6px', padding: '10px 12px', marginBottom: '12px',
                fontSize: '11px', color: '#ffaa00', textAlign: 'center'
              }}>
                Free tier: {FREE_MAX_SESSIONS} session max. <button onClick={onShowPricing} style={{ ...S.btn, background: 'none', color: '#00ff88', textDecoration: 'underline', fontSize: '11px', padding: 0 }}>Upgrade to Pro</button>
              </div>
            )}

            {/* Session list */}
            <div style={{ flex: 1, overflow: 'auto' }}>
              {sessions.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#555', padding: '20px' }}>No sessions yet</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {sessions.map(session => {
                    const isActive = session.id === currentSessionId;
                    const isSelected = session.id === selectedSessionId;
                    return (
                      <div key={session.id} onClick={() => setSelectedSessionId(isSelected ? null : session.id)} style={{
                        ...S.card, cursor: 'pointer',
                        border: `1px solid ${isActive ? '#00ff88' : isSelected ? '#555' : '#2a2a2e'}`
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: '600', color: '#fff', fontFamily: "'Outfit', sans-serif" }}>
                              {isActive && <span style={{ color: '#00ff88', marginRight: '6px' }}>●</span>}
                              {session.name}
                            </div>
                            <div style={{ fontSize: '10px', color: '#666', marginTop: '4px' }}>
                              {(session.notes || []).length} notes • {new Date(session.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                          <div style={{ fontSize: '14px', color: '#666' }}>{isSelected ? '▾' : '›'}</div>
                        </div>

                        {isSelected && (
                          <div style={{ display: 'flex', borderTop: '1px solid #2a2a2e', marginTop: '12px' }}>
                            <button onClick={(e) => { e.stopPropagation(); if (isActive) { setShowSessionsPanel(false); } else { loadSession(session.id); } }}
                              style={{
                                ...S.btn, flex: 1, padding: '12px', fontSize: '12px', fontWeight: '600',
                                fontFamily: "'Outfit', sans-serif",
                                background: isActive ? '#2a2a2e' : '#00ff88',
                                color: isActive ? '#fff' : '#000',
                                borderRight: '1px solid #2a2a2e',
                                cursor: 'pointer'
                              }}>
                              {isActive ? 'Open' : 'Load'}
                            </button>
                            <button onClick={(e) => {
                              e.stopPropagation();
                              const name = prompt('Rename session:', session.name);
                              if (name?.trim()) renameSession(session.id, name.trim());
                            }} style={{
                              ...S.btn, flex: 1, padding: '12px', fontSize: '12px', fontWeight: '600',
                              fontFamily: "'Outfit', sans-serif",
                              background: 'transparent', color: '#888', borderRight: '1px solid #2a2a2e'
                            }}>Rename</button>
                            <button onClick={(e) => {
                              e.stopPropagation();
                              if (sessions.length > 1 && confirm('Delete session?')) { deleteSession(session.id); setSelectedSessionId(null); }
                              else if (sessions.length <= 1) alert('Cannot delete the only session.');
                            }} style={{
                              ...S.btn, flex: 1, padding: '12px', fontSize: '12px', fontWeight: '600',
                              fontFamily: "'Outfit', sans-serif",
                              background: 'transparent', color: '#ff6666'
                            }}>Delete</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Account Section */}
            <div style={{
              marginTop: '24px', borderTop: '1px solid #2a2a2e', paddingTop: '20px'
            }}>
              <div style={{
                fontSize: '11px', color: '#666', textTransform: 'uppercase',
                letterSpacing: '0.1em', marginBottom: '12px'
              }}>Account</div>
              <p style={{ fontSize: '12px', color: '#888', marginBottom: '16px' }}>
                {user?.email || 'Signed in'}
              </p>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => { setShowSessionsPanel(false); onLogout(); }} style={{
                  flex: 1, padding: '12px', fontSize: '13px', fontWeight: '600',
                  fontFamily: "'Outfit', sans-serif", background: 'transparent',
                  color: '#888', border: '1px solid #333', borderRadius: '8px', cursor: 'pointer'
                }}>Sign Out</button>
                <button onClick={() => setShowDeleteConfirm(true)} style={{
                  flex: 1, padding: '12px', fontSize: '13px', fontWeight: '600',
                  fontFamily: "'Outfit', sans-serif", background: 'transparent',
                  color: '#ff4444', border: '1px solid rgba(255,68,68,0.3)', borderRadius: '8px', cursor: 'pointer'
                }}>Delete Account</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── DOCUMENT VIEWER ───────────────────────────────────────── */}
      {viewingDocument && (
        <PdfViewer document={viewingDocument} onClose={() => setViewingDocument(null)} />
      )}

      {/* ─── DELETE ACCOUNT CONFIRMATION ─────────────────────────────── */}
      {showDeleteConfirm && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.9)',
          zIndex: 3500,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: '#1a1a1e',
            borderRadius: '16px',
            padding: '28px',
            maxWidth: '380px',
            width: '100%',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '36px', marginBottom: '16px' }}>⚠️</div>
            <h3 style={{
              color: '#fff',
              fontSize: '18px',
              fontWeight: '700',
              fontFamily: "'Outfit', sans-serif",
              margin: '0 0 12px 0'
            }}>
              Delete Account?
            </h3>
            <p style={{
              color: '#888',
              fontSize: '13px',
              lineHeight: '1.6',
              marginBottom: '24px'
            }}>
              This will permanently delete your account, all sessions, notes, and data. This action cannot be undone. Active subscriptions should be cancelled separately.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                style={{
                  ...S.btn,
                  flex: 1,
                  padding: '14px',
                  fontSize: '14px',
                  fontWeight: '600',
                  background: '#2a2a2e',
                  color: '#fff',
                  borderRadius: '10px'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={isDeleting}
                style={{
                  ...S.btn,
                  flex: 1,
                  padding: '14px',
                  fontSize: '14px',
                  fontWeight: '600',
                  background: isDeleting ? '#333' : '#ff4444',
                  color: '#fff',
                  borderRadius: '10px',
                  cursor: isDeleting ? 'not-allowed' : 'pointer'
                }}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── ANIMATIONS ────────────────────────────────────────────── */}
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
    </div>
  );
};

export default TakeNotePro;
