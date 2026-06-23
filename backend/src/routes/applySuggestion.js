const express = require('express');
const router = express.Router();
const { getSession, updateSession } = require('../store');

// POST /api/apply-suggestion
// Body: { sessionId, targetSection }
// Applies the last Gemini revised_text back into the session's structured manuscript
router.post('/', (req, res) => {
  const { sessionId, targetSection, revisedText } = req.body;

  if (!sessionId || !targetSection) {
    return res.status(400).json({ error: '"sessionId" and "targetSection" are required.' });
  }

  const session = getSession(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found.' });
  }

  const structured = session.structuredManuscript;

  const sectionKey =
    Object.keys(structured).find((k) => k === targetSection) ||
    Object.keys(structured).find((k) => k.toLowerCase() === targetSection.toLowerCase()) ||
    Object.keys(structured).find((k) => k.toLowerCase().includes(targetSection.toLowerCase()));

  if (!sectionKey) {
    return res.status(400).json({ error: `Section "${targetSection}" not found in manuscript.` });
  }

  if (revisedText) {
    const updatedManuscript = { ...structured, [sectionKey]: revisedText };
    updateSession(sessionId, { structuredManuscript: updatedManuscript });
  }

  return res.json({ ok: true, applied: targetSection });
});

module.exports = router;
