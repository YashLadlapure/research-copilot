const { getSession } = require('../store');
const { HttpError } = require('../errors');

function requireSession(sessionId) {
  const session = typeof sessionId === 'string' ? getSession(sessionId) : null;
  if (!session) {
    throw new HttpError(404, 'This session has expired. Analyze the manuscript again.', 'SESSION_EXPIRED');
  }
  return session;
}

module.exports = { requireSession };
