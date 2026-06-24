const express = require('express');
const { getSession } = require('../store');
const { callGemini } = require('../ai/gemini');

const router = express.Router();

const SECTION_ORDER = ['title', 'abstract', 'keywords', 'introduction', 'methodology', 'results', 'conclusion', 'references'];

function buildFullPaper(structured, revisedSections) {
  return SECTION_ORDER
    .filter(k => structured[k])
    .map(k => ({
      section: k,
      content: revisedSections[k] || (typeof structured[k] === 'string' ? structured[k] : JSON.stringify(structured[k])),
      revised: !!revisedSections[k],
    }));
}

router.post('/', async (req, res) => {
  const { sessionId, revisedSections } = req.body;
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });

  const session = getSession(sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const structured = session.structuredManuscript;
  const entries = Object.keys(revisedSections || {});

  if (entries.length === 0) {
    return res.json({ changes: [], fullPaper: buildFullPaper(structured, {}) });
  }

  const pairs = entries.map(section => ({
    section,
    original: typeof structured[section] === 'string'
      ? structured[section]
      : JSON.stringify(structured[section]),
    revised: revisedSections[section],
  }));

  const prompt = `You are an academic writing assistant reviewing manuscript revisions.

For each section change below, write a 1-2 sentence explanation of WHY this revision improves the paper for academic publication. Be specific — mention what was weak before and what the revision fixes (clarity, compliance, tone, structure, etc.).

Return ONLY a JSON array matching this shape exactly:
[{"section":"<name>","summary":"<explanation>"}]

Changes:
${JSON.stringify(pairs, null, 2)}`;

  try {
    const raw = await callGemini(prompt);
    let summaries;
    try {
      const match = raw.match(/(\[[\s\S]*?\])/);
      summaries = match ? JSON.parse(match[1]) : JSON.parse(raw);
    } catch {
      summaries = pairs.map(p => ({ section: p.section, summary: 'Revision improves compliance and academic tone.' }));
    }

    const changes = pairs.map(p => {
      const found = summaries.find(s => s.section?.toLowerCase() === p.section?.toLowerCase());
      return {
        section: p.section,
        original: p.original,
        revised: p.revised,
        summary: found?.summary || 'Revision improves compliance and academic tone.',
      };
    });

    res.json({ changes, fullPaper: buildFullPaper(structured, revisedSections) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
