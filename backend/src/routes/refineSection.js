const express = require('express');
const router = express.Router();
const { getSession, updateSession } = require('../store');
const { refineSectionText } = require('../ai/geminiRefine');

// POST /api/refine-section
// Body: { sessionId, targetSection, mode? }
router.post('/', async (req, res) => {
  // Support both field names: targetSection (frontend) and sectionName (legacy)
  const { sessionId, targetSection, sectionName, mode = 'strict' } = req.body;
  const section = targetSection || sectionName;

  if (!sessionId || !section) {
    return res.status(400).json({ error: '"sessionId" and "targetSection" are required.' });
  }

  const session = getSession(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found. Please re-analyze your manuscript.' });
  }

  const structured = session.structuredManuscript;
  if (!structured) {
    return res.status(400).json({ error: 'No structured manuscript found. Please run Analyze first.' });
  }

  // Try exact key match first, then lowercase, then partial match
  const sectionKey =
    Object.keys(structured).find((k) => k === section) ||
    Object.keys(structured).find((k) => k.toLowerCase() === section.toLowerCase()) ||
    Object.keys(structured).find((k) => k.toLowerCase().includes(section.toLowerCase()));

  const originalText = sectionKey ? structured[sectionKey] : null;

  if (!originalText) {
    return res.status(400).json({
      error: `Section "${section}" not found. Available: ${Object.keys(structured).join(', ')}`,
    });
  }

  try {
    const geminiResult = await refineSectionText(originalText, session.profile, mode);

    const suggestion = {
      target_section: section,
      original_text: geminiResult.original_text || originalText,
      revised_text: geminiResult.revised_text,
      change_summary: geminiResult.change_summary,
      rationale: geminiResult.rationale,
      safety_note: geminiResult.safety_note,
      mode,
      confidence: geminiResult.confidence,
    };

    return res.json({ suggestion });
  } catch (err) {
    console.error('[refine-section] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
