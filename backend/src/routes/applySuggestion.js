const express = require('express');
const { getProfile } = require('../profiles');
const { HttpError } = require('../errors');
const { findSection, replaceSectionBody } = require('../manuscript/sections');
const { evaluateCompliance } = require('../rules/evaluateCompliance');
const { requireSession } = require('./requireSession');

const router = express.Router();

// Applies the suggestion the server generated for this section. The client
// names the section rather than sending text, so what gets applied is exactly
// what the author was shown.
router.post('/', (req, res) => {
  const { sessionId, section: sectionName } = req.body ?? {};
  const session = requireSession(sessionId);

  const suggestion = typeof sectionName === 'string' ? session.pending[sectionName] : null;
  if (!suggestion) {
    throw new HttpError(409, 'There is no suggestion waiting for that section. Request a refinement first.');
  }
  const section = findSection(session.manuscript, suggestion.section);
  if (!section || section.body !== suggestion.originalText) {
    delete session.pending[suggestion.section];
    throw new HttpError(409, 'That section has changed since the suggestion was made. Request a new one.');
  }

  session.manuscript = replaceSectionBody(session.manuscript, suggestion.section, suggestion.revisedText);
  session.report = evaluateCompliance(session.manuscript, getProfile(session.profile));
  session.revisions.push({
    section: suggestion.section,
    originalText: suggestion.originalText,
    revisedText: suggestion.revisedText,
    changeSummary: suggestion.changeSummary,
    appliedAt: new Date().toISOString(),
  });
  delete session.pending[suggestion.section];

  res.json({ report: session.report, revisions: session.revisions });
});

module.exports = router;
