const express = require('express');
const { getProfile, profileKeys } = require('../profiles');
const { HttpError } = require('../errors');
const { evaluateCompliance } = require('../rules/evaluateCompliance');
const { requireSession } = require('./requireSession');

const router = express.Router();

// Re-runs the rules against a different profile. The manuscript is already
// parsed, so this needs no Gemini call.
router.post('/', (req, res) => {
  const { sessionId, profile: profileKey } = req.body ?? {};
  const session = requireSession(sessionId);

  const profile = getProfile(profileKey);
  if (!profile) {
    throw new HttpError(400, `Unknown profile. Use one of: ${profileKeys.join(', ')}.`);
  }

  session.profile = profile.key;
  session.report = evaluateCompliance(session.manuscript, profile);
  session.pending = {};

  res.json({ report: session.report });
});

module.exports = router;
