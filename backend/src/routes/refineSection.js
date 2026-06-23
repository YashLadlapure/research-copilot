const express = require('express');
const router = express.Router();
const { getSession } = require('../store');
const { refineSectionText } = require('../ai/geminiRefine');

router.post('/', async (req, res) => {
  const { sessionId, targetSection, mode = 'strict' } = req.body;

  if (!sessionId || !targetSection) {
    return res.status(400).json({ error: '"sessionId" and "targetSection" are required.' });
  }

  const session = getSession(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found. Please re-analyze your manuscript.' });
  }

  const structured = session.structuredManuscript;
  if (!structured) {
    return res.status(400).json({ error: 'No structured manuscript found. Run Analyze first.' });
  }

  const sectionKey =
    Object.keys(structured).find((k) => k === targetSection) ||
    Object.keys(structured).find((k) => k.toLowerCase() === targetSection.toLowerCase()) ||
    Object.keys(structured).find((k) => k.toLowerCase().includes(targetSection.toLowerCase()));

  const originalText = sectionKey ? structured[sectionKey] : null;
  if (!originalText) {
    return res.status(400).json({
      error: `Section "${targetSection}" not found. Available: ${Object.keys(structured).join(', ')}`,
    });
  }

  try {
    const result = await refineSectionText(originalText, session.profile, mode);
    return res.json({
      suggestion: {
        target_section: targetSection,
        original_text: result.original_text || originalText,
        revised_text: result.revised_text,
        change_summary: result.change_summary,
        rationale: result.rationale,
        safety_note: result.safety_note,
        mode,
        confidence: result.confidence,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
