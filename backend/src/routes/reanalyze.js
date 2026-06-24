const express = require('express');
const router = express.Router();
const { getSession, updateSession } = require('../store');
const { getProfileConfig } = require('../profiles/index');
const { evaluateCompliance } = require('../rules/evaluateCompliance');

router.post('/', async (req, res) => {
  const { sessionId } = req.body;

  if (!sessionId) {
    return res.status(400).json({ error: '"sessionId" is required.' });
  }

  const session = getSession(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found.' });
  }

  let profileConfig;
  try {
    profileConfig = getProfileConfig(session.profile);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  // Re-score directly from the current session sections — no Gemini re-parse.
  // applySuggestion already updated structuredManuscript with the revised text,
  // so running evaluateCompliance here reflects the actual applied changes.
  const complianceReport = evaluateCompliance(session.structuredManuscript, profileConfig);

  updateSession(sessionId, { complianceReport });

  return res.json({
    sessionId,
    structuredManuscript: session.structuredManuscript,
    complianceReport,
  });
});

module.exports = router;
