/** @type {Map<string, import('./types').ManuscriptSession>} */
const sessions = new Map();

function createSession(session) {
  sessions.set(session.id, session);
  return session;
}

function getSession(id) {
  return sessions.get(id) || null;
}

function updateSession(id, patch) {
  const current = sessions.get(id);
  if (!current) return null;
  const updated = { ...current, ...patch };
  sessions.set(id, updated);
  return updated;
}

module.exports = { sessions, createSession, getSession, updateSession };
