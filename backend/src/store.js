const { randomUUID } = require('crypto');

const SESSION_TTL_MS = 60 * 60 * 1000;
const MAX_SESSIONS = 200;
const SWEEP_INTERVAL_MS = 10 * 60 * 1000;

const sessions = new Map();

function isExpired(session, now = Date.now()) {
  return now - session.lastUsedAt > SESSION_TTL_MS;
}

function evictLeastRecentlyUsed() {
  let oldest = null;
  for (const session of sessions.values()) {
    if (!oldest || session.lastUsedAt < oldest.lastUsedAt) oldest = session;
  }
  if (oldest) sessions.delete(oldest.id);
}

function createSession(data) {
  if (sessions.size >= MAX_SESSIONS) evictLeastRecentlyUsed();
  const session = { ...data, id: randomUUID(), lastUsedAt: Date.now() };
  sessions.set(session.id, session);
  return session;
}

function getSession(id) {
  const session = sessions.get(id);
  if (!session) return null;
  if (isExpired(session)) {
    sessions.delete(id);
    return null;
  }
  session.lastUsedAt = Date.now();
  return session;
}

function sweepExpired() {
  const now = Date.now();
  for (const session of sessions.values()) {
    if (isExpired(session, now)) sessions.delete(session.id);
  }
}

setInterval(sweepExpired, SWEEP_INTERVAL_MS).unref();

module.exports = { createSession, getSession, SESSION_TTL_MS, MAX_SESSIONS };
