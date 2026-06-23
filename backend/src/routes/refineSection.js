const express = require('express');
const router = express.Router();
const { getSession, updateSession } = require('../store');
const { refineSectionText } = require('../ai/geminiRefine');

router.post('/', async (req, res) => {
  const { sessionId, sectionName, mode = 'balanced', apply = false } = req.body;

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
  const originalText = structured[sectionKey];

  if (!originalText) {
    return res.status(400).json({ error: `Section "${sectionName}" not found in extracted manuscript.` });
  }

  try {
    const geminiResult = await refineSectionText(originalText, session.profile, mode);

    const suggestion = {
      targetSection: sectionName,
      originalText: geminiResult.original_text || originalText,
      revisedText: geminiResult.revised_text,
      changeSummary: geminiResult.change_summary,
      rationale: geminiResult.rationale,
      safetyNote: geminiResult.safety_note,
      mode,
      confidence: geminiResult.confidence,
    };

    if (apply && geminiResult.revised_text) {
      const updatedManuscript = { ...structured, [sectionKey]: geminiResult.revised_text };
      updateSession(sessionId, { structuredManuscript: updatedManuscript });
    }

    return res.json(suggestion);
  } catch (err) {
    console.error('[refine-section] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
