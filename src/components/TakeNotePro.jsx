import React, { useState, useEffect, useRef } from 'react';
import { saveSession, loadUserSessions, deleteSession } from '../services/sessions';
import { logOut } from '../services/auth';
import { Clock, Play, Pause, Plus, Settings, FileText, Mic, Download, LogOut } from 'lucide-react';
import './TakeNotePro.css';

const TakeNotePro = ({ user, isPro, onShowPricing }) => {
  // ==================== STATE ====================
  
  // Sessions
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [sessionCount, setSessionCount] = useState(0);
  const [newSessionName, setNewSessionName] = useState('');
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  
  // Timecode
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [frames, setFrames] = useState(0);
  const [fps, setFps] = useState(25);
  const [isRunning, setIsRunning] = useState(false);
  const [isEditing, setIsEditing] = useState(true);
  
  // Notes
  const [notes, setNotes] = useState([]);
  const [quickNote, setQuickNote] = useState('');
  const [editingNoteId, setEditingNoteId] = useState(null);
  
  // Metadata
  const [metadataFields, setMetadataFields] = useState([
    { id: 'production', label: 'Production', value: '', placeholder: 'e.g., Documentary 2025' },
    { id: 'scene', label: 'Scene', value: '', placeholder: 'e.g., INT. OFFICE - DAY' },
    { id: 'take', label: 'Take', value: '', placeholder: 'e.g., 3' },
    { id: 'cameraName', label: 'Camera', value: '', placeholder: 'e.g., A-Cam' },
  ]);
  
  // UI State
  const [activeTab, setActiveTab] = useState('sessions');
  const [showExportMenu, setShowExportMenu] = useState(false);
  
  // Refs
  const intervalRef = useRef(null);
  const quickNoteRef = useRef(null);
  const saveTimeoutRef = useRef(null);
  
  // ==================== LOAD SESSIONS ON MOUNT ====================
  
  useEffect(() => {
    loadSessions();
  }, [user.uid]);
  
  const loadSessions = async () => {
    setIsLoadingSessions(true);
    const userSessions = await loadUserSessions(user.uid);
    setSessions(userSessions);
    setSessionCount(userSessions.length);
    
    // Load the most recent session if exists
    if (userSessions.length > 0) {
      loadSessionData(userSessions[0]);
    } else {
      // Auto-create first session for new users
      createNewSession();
    }
    setIsLoadingSessions(false);
  };
  
  // ==================== SESSION MANAGEMENT ====================
  
  const createNewSession = async () => {
    // FREE TIER LIMIT: Check session count
    if (!isPro && sessionCount >= 1) {
      alert('Free tier is limited to 1 session. Upgrade to Pro for unlimited sessions!');
      onShowPricing();
      return;
    }
    
    const today = new Date();
    const defaultName = newSessionName.trim() || `Session ${sessionCount + 1} - ${today.toLocaleDateString()}`;
    
    const newSession = {
      id: `session_${Date.now()}`,
      name: defaultName,
      createdAt: today.toISOString(),
      notes: [],
      metadata: metadataFields.map(f => ({ ...f })),
      fps: fps,
    };
    
    // Save to Firestore
    const saved = await saveSession(user.uid, newSession);
    if (saved) {
      setSessions([newSession, ...sessions]);
      setSessionCount(sessionCount + 1);
      setCurrentSessionId(newSession.id);
      loadSessionData(newSession);
      setNewSessionName('');
      setActiveTab('notes');
    }
  };
  
  const loadSessionData = (session) => {
    setCurrentSessionId(session.id);
    setNotes(session.notes || []);
    setMetadataFields(session.metadata || metadataFields);
    setFps(session.fps || 25);
    setActiveTab('notes');
  };
  
  const saveCurrentSession = async () => {
    if (!currentSessionId) return;
    
    const session = sessions.find(s => s.id === currentSessionId);
    if (session) {
      const updatedSession = {
        ...session,
        notes,
        metadata: metadataFields,
        fps,
      };
      
      await saveSession(user.uid, updatedSession);
      
      // Update local state
      setSessions(sessions.map(s => 
        s.id === currentSessionId ? updatedSession : s
      ));
    }
  };
  
  const handleDeleteSession = async (sessionId) => {
    if (!confirm('Delete this session? This cannot be undone.')) return;
    
    const success = await deleteSession(sessionId);
    if (success) {
      const updatedSessions = sessions.filter(s => s.id !== sessionId);
      setSessions(updatedSessions);
      setSessionCount(sessionCount - 1);
      
      // Load another session or create new one
      if (sessionId === currentSessionId) {
        if (updatedSessions.length > 0) {
          loadSessionData(updatedSessions[0]);
        } else {
          setCurrentSessionId(null);
          setNotes([]);
        }
      }
    }
  };
  
  // Auto-save session when data changes
  useEffect(() => {
    if (currentSessionId) {
      // Clear existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      
      // Debounce save by 2 seconds
      saveTimeoutRef.current = setTimeout(() => {
        saveCurrentSession();
      }, 2000);
      
      return () => {
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }
      };
    }
  }, [notes, metadataFields, fps, currentSessionId]);
  
  // ==================== TIMECODE ====================
  
  // Auto-set to current time on mount
  useEffect(() => {
    const now = new Date();
    setHours(now.getHours());
    setMinutes(now.getMinutes());
    setSeconds(now.getSeconds());
    setFrames(0);
  }, []);
  
  // Timecode runner
  useEffect(() => {
    if (isRunning && !isEditing) {
      intervalRef.current = setInterval(() => {
        setFrames(prev => {
          if (prev + 1 >= fps) {
            setSeconds(s => {
              if (s + 1 >= 60) {
                setMinutes(m => {
                  if (m + 1 >= 60) {
                    setHours(h => (h + 1) % 24);
                    return 0;
                  }
                  return m + 1;
                });
                return 0;
              }
              return s + 1;
            });
            return 0;
          }
          return prev + 1;
        });
      }, 1000 / fps);
      
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [isRunning, isEditing, fps]);
  
  const getCurrentTimecode = () => {
    const pad = (num) => String(num).padStart(2, '0');
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}:${pad(frames)}`;
  };
  
  const togglePlayPause = () => {
    if (isEditing) {
      setIsEditing(false);
      setIsRunning(true);
    } else {
      setIsRunning(!isRunning);
    }
  };
  
  // ==================== NOTES ====================
  
  const addQuickNote = () => {
    // FREE TIER LIMIT: Check note count
    if (!isPro && notes.length >= 20) {
      alert('Free tier is limited to 20 notes per session. Upgrade to Pro for unlimited notes!');
      onShowPricing();
      return;
    }
    
    if (!quickNote.trim()) return;
    
    const newNote = {
      id: `note_${Date.now()}`,
      timecode: getCurrentTimecode(),
      text: quickNote.trim(),
      timestamp: new Date().toISOString(),
    };
    
    setNotes([...notes, newNote]);
    setQuickNote('');
    
    // Focus back on input
    if (quickNoteRef.current) {
      quickNoteRef.current.focus();
    }
  };
  
  const deleteNote = (noteId) => {
    setNotes(notes.filter(n => n.id !== noteId));
  };
  
  const updateNote = (noteId, newText) => {
    setNotes(notes.map(n => 
      n.id === noteId ? { ...n, text: newText } : n
    ));
  };
  
  // ==================== EXPORT ====================
  
  const exportToNLE = (format) => {
    // PRO FEATURE GATE
    if (!isPro) {
      alert(`NLE exports are a Pro feature!\n\nUpgrade to Pro for £4.99/year to unlock:\n• EDL export\n• FCPXML export\n• TSV export\n• ALE export`);
      onShowPricing();
      return;
    }
    
    // TODO: Implement actual export
    alert(`${format.toUpperCase()} export coming soon!`);
  };
  
  const exportPDF = () => {
    // Basic PDF available to all
    alert('PDF export coming soon!');
  };

  // ==================== RENDER ====================
  
  const currentSession = sessions.find(s => s.id === currentSessionId);
  
  if (isLoadingSessions) {
    return (
      <div className="takenote-loading">
        <div className="loading-spinner"></div>
        <p>Loading sessions...</p>
      </div>
    );
  }
  
  return (
    <div className="takenote-app">
      {/* Header */}
      <header className="app-header">
        <div className="header-left">
          <Clock size={24} />
          <h1>Take Note Pro</h1>
          {!isPro && (
            <button onClick={onShowPricing} className="btn-upgrade-mini">
              Upgrade to Pro
            </button>
          )}
        </div>
        <div className="header-right">
          <span className="user-email">{user.email}</span>
          {isPro && <span className="pro-badge">✓ Pro</span>}
          <button onClick={logOut} className="btn-icon" title="Sign out">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="app-body">
        {/* Sidebar - Sessions List */}
        <aside className="sidebar">
          <div className="sidebar-header">
            <h2>Sessions</h2>
            <button onClick={createNewSession} className="btn-icon" title="New session">
              <Plus size={20} />
            </button>
          </div>
          
          {!isPro && sessionCount >= 1 && (
            <div className="tier-limit-warning">
              <p>🔒 Free tier: 1 session max</p>
              <button onClick={onShowPricing} className="btn-upgrade-small">
                Upgrade for unlimited
              </button>
            </div>
          )}
          
          <div className="sessions-list">
            {sessions.map(session => (
              <div
                key={session.id}
                className={`session-item ${session.id === currentSessionId ? 'active' : ''}`}
                onClick={() => loadSessionData(session)}
              >
                <div className="session-name">{session.name}</div>
                <div className="session-meta">
                  {session.notes?.length || 0} notes • {new Date(session.createdAt).toLocaleDateString()}
                </div>
                {sessions.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteSession(session.id);
                    }}
                    className="btn-delete"
                    title="Delete session"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        </aside>

        {/* Main Panel */}
        <main className="main-panel">
          {!currentSession ? (
            <div className="empty-state">
              <Clock size={64} />
              <h2>No session selected</h2>
              <p>Create a new session to get started</p>
              <button onClick={createNewSession} className="btn-primary">
                <Plus size={20} />
                Create Session
              </button>
            </div>
          ) : (
            <>
              {/* Session Header */}
              <div className="session-header">
                <input
                  type="text"
                  value={currentSession.name}
                  onChange={(e) => {
                    const updatedSessions = sessions.map(s =>
                      s.id === currentSessionId ? { ...s, name: e.target.value } : s
                    );
                    setSessions(updatedSessions);
                  }}
                  className="session-name-input"
                />
              </div>

              {/* Timecode Display */}
              <div className="timecode-section">
                <div className="timecode-display">
                  {getCurrentTimecode()}
                </div>
                <div className="timecode-controls">
                  <button onClick={togglePlayPause} className="btn-icon-large">
                    {isRunning ? <Pause size={24} /> : <Play size={24} />}
                  </button>
                  <select
                    value={fps}
                    onChange={(e) => setFps(Number(e.target.value))}
                    className="fps-select"
                    disabled={isRunning}
                  >
                    <option value={23.976}>23.976 fps</option>
                    <option value={24}>24 fps</option>
                    <option value={25}>25 fps</option>
                    <option value={29.97}>29.97 fps</option>
                    <option value={30}>30 fps</option>
                  </select>
                </div>
              </div>

              {/* Quick Note Input */}
              <div className="quick-note-section">
                <input
                  ref={quickNoteRef}
                  type="text"
                  value={quickNote}
                  onChange={(e) => setQuickNote(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') addQuickNote();
                  }}
                  placeholder="Type note and press Enter..."
                  className="quick-note-input"
                />
                <button onClick={addQuickNote} className="btn-primary">
                  <Plus size={20} />
                  Add Note
                </button>
              </div>

              {/* Free Tier Note Limit Warning */}
              {!isPro && notes.length >= 15 && (
                <div className="tier-limit-warning">
                  <p>⚠️ {20 - notes.length} notes remaining (Free tier: 20 max)</p>
                  <button onClick={onShowPricing} className="btn-upgrade-small">
                    Upgrade to Pro
                  </button>
                </div>
              )}

              {/* Notes List */}
              <div className="notes-section">
                <div className="notes-header">
                  <h3>Notes ({notes.length})</h3>
                </div>
                <div className="notes-list">
                  {notes.length === 0 ? (
                    <div className="empty-notes">
                      <p>No notes yet. Add your first note above!</p>
                    </div>
                  ) : (
                    notes.map(note => (
                      <div key={note.id} className="note-item">
                        <div className="note-timecode">{note.timecode}</div>
                        {editingNoteId === note.id ? (
                          <input
                            type="text"
                            value={note.text}
                            onChange={(e) => updateNote(note.id, e.target.value)}
                            onBlur={() => setEditingNoteId(null)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') setEditingNoteId(null);
                            }}
                            className="note-edit-input"
                            autoFocus
                          />
                        ) : (
                          <div
                            className="note-text"
                            onClick={() => setEditingNoteId(note.id)}
                          >
                            {note.text}
                          </div>
                        )}
                        <button
                          onClick={() => deleteNote(note.id)}
                          className="btn-delete-note"
                          title="Delete note"
                        >
                          ×
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Export Section */}
              <div className="export-section">
                <button onClick={exportPDF} className="btn-export">
                  <Download size={18} />
                  Export PDF
                </button>
                <button
                  onClick={() => exportToNLE('edl')}
                  className="btn-export"
                  disabled={!isPro}
                >
                  <Download size={18} />
                  Export EDL {!isPro && '🔒'}
                </button>
                <button
                  onClick={() => exportToNLE('fcpxml')}
                  className="btn-export"
                  disabled={!isPro}
                >
                  <Download size={18} />
                  Export FCPXML {!isPro && '🔒'}
                </button>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default TakeNotePro;
