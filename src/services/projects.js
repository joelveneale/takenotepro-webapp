import { getFirestore, collection, doc, getDocs, getDoc, setDoc, deleteDoc, query, orderBy, updateDoc, writeBatch } from 'firebase/firestore';

const db = getFirestore();

// ─── PROJECT CRUD ─────────────────────────────────────────────────────────────

export const createProject = async (userId, project) => {
  try {
    const projectRef = doc(db, 'users', userId, 'projects', project.id);
    await setDoc(projectRef, {
      ...project,
      userId,
      createdAt: project.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    return true;
  } catch (err) {
    console.error('Error creating project:', err);
    return false;
  }
};

export const loadUserProjects = async (userId) => {
  try {
    const projectsRef = collection(db, 'users', userId, 'projects');
    const q = query(projectsRef, orderBy('updatedAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    console.error('Error loading projects:', err);
    return [];
  }
};

export const saveProjectToFirestore = async (userId, project) => {
  try {
    const projectRef = doc(db, 'users', userId, 'projects', project.id);
    await setDoc(projectRef, {
      ...project,
      userId,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    return true;
  } catch (err) {
    console.error('Error saving project:', err);
    return false;
  }
};

export const deleteProjectFromFirestore = async (userId, projectId) => {
  try {
    const projectRef = doc(db, 'users', userId, 'projects', projectId);
    await deleteDoc(projectRef);
    return true;
  } catch (err) {
    console.error('Error deleting project:', err);
    return false;
  }
};

// ─── SESSION HELPERS (PROJECT-AWARE) ──────────────────────────────────────────

// Get today's date string
export const getTodayString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Format date for display
export const formatDateDisplay = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
};

// Get sessions for a project
export const getProjectSessions = (sessions, projectId) => {
  return sessions.filter(s => s.projectId === projectId)
    .sort((a, b) => (b.date || b.createdAt || '').localeCompare(a.date || a.createdAt || ''));
};

// Find today's session for a project
export const findTodaySession = (sessions, projectId) => {
  const today = getTodayString();
  return sessions.find(s => s.projectId === projectId && s.date === today);
};

// Move session to another project
export const moveSessionToProject = async (userId, sessionId, newProjectId, sessions, saveSessionFn) => {
  const session = sessions.find(s => s.id === sessionId);
  if (!session) return false;
  
  const updatedSession = { ...session, projectId: newProjectId, updatedAt: new Date().toISOString() };
  await saveSessionFn(userId, updatedSession);
  return updatedSession;
};

// Migrate legacy sessions (no projectId) to a default project
export const migrateSessionsToProject = (sessions, projectId) => {
  return sessions.map(s => {
    if (!s.projectId) {
      return { ...s, projectId, date: s.date || (s.createdAt ? s.createdAt.split('T')[0] : getTodayString()) };
    }
    return s;
  });
};

// Get calendar data for a project (which dates have sessions)
export const getProjectCalendarData = (sessions, projectId) => {
  const projectSessions = sessions.filter(s => s.projectId === projectId);
  const dateMap = {};
  projectSessions.forEach(s => {
    const date = s.date || (s.createdAt ? s.createdAt.split('T')[0] : null);
    if (date) {
      dateMap[date] = { 
        sessionId: s.id, 
        noteCount: (s.notes || []).filter(n => !n.deleted).length 
      };
    }
  });
  return dateMap;
};
