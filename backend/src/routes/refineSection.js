const express = require('express');
const router = express.Router();
const { getSession } = require('../store');

router.post('/', (req, res) => {
  const { sessionId, sectionName, mode = 'Strict' } = req.body;

  if (!sessionId || !sectionName) {
    return res.status(400).json({ error: '"sessionId" and "sectionName" are required.' });
  }

  const session = getSession(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found.' });
  }

  const structured = session.structuredManuscript;
  if (!structured) {
    return res.status(400).json({ error: 'No structured manuscript found in session.' });
  }

  const sectionKey = sectionName.toLowerCase();
  const originalText = structured[sectionKey] || `Original text for "${sectionName}" not extracted yet.`;

  const suggestion = {
    targetSection: sectionName,
    originalText,
    revisedText: `${originalText} [Refined: language tightened and formalized for ${session.profile.toUpperCase()} submission.]`,
    changeSummary: 'Minor language and clarity improvements applied.',
    rationale: `The section was refined to better align with ${session.profile.toUpperCase()} tone and structure requirements.`,
    safetyNote: 'No claims, citations, or numerical results were modified.',
    mode,
    confidence: 0.75,
  };

  return res.json(suggestion);
});

module.exports = router;
