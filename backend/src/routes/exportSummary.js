const express = require('express');
const { getSession } = require('../store');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// FIX #8: validate GEMINI_API_KEY at module load so missing key surfaces immediately
if (!process.env.GEMINI_API_KEY) {
  console.error('[exportSummary] WARNING: GEMINI_API_KEY is not set. Requests will fail.');
}

const router = express.Router();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

async function callGemini(prompt) {
  const model = genAI.getGenerativeModel({ model: MODEL });
  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

router.post('/', async (req, res) => {
  const { sessionId, revisedSections } = req.body;
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });

  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({ error: 'Gemini API key not configured on this server.' });
  }

  const session = getSession(sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const sections = session.structuredManuscript?.sections;
  if (!sections || Object.keys(sections).length === 0) {
    return res.status(400).json({ error: 'No manuscript sections found in session. Re-run analysis first.' });
  }

  const { profile } = session;
  const revised = revisedSections || {};
  const hasRevisions = Object.keys(revised).length > 0;

  let changeLog = '';

  if (hasRevisions) {
    const entries = Object.entries(revised);
    const explanations = [];

    for (const [sectionName, revisedText] of entries) {
      // FIX #14: use session.originalSections (snapshot at analysis time) for the
      // BEFORE text. Falling back to sections[sectionName] would show the
      // already-revised text if applySuggestion mutated it in the session.
      const originalSections = session.originalSections || {};
      const original = originalSections[sectionName] || sections[sectionName] || '';

      const prompt = `You are a research writing assistant.\n\nA researcher revised the "${sectionName}" section of their manuscript for ${profile.toUpperCase()} compliance.\n\nOriginal:\n${original.slice(0, 800)}\n\nRevised:\n${revisedText.slice(0, 800)}\n\nWrite ONE sentence (max 30 words) explaining why this revision improves compliance. Be specific. No fluff.`;

      try {
        const explanation = await callGemini(prompt);
        explanations.push({ section: sectionName, original, revised: revisedText, why: explanation });
      } catch {
        explanations.push({ section: sectionName, original, revised: revisedText, why: 'Improved for publication compliance.' });
      }
    }

    changeLog = explanations.map((e, i) =>
      `[${i + 1}] ${e.section.toUpperCase()}\nBEFORE: "${e.original.slice(0, 200).replace(/\n/g, ' ')}..."\nAFTER:  "${e.revised.slice(0, 200).replace(/\n/g, ' ')}..."\nWHY:    ${e.why}\n`
    ).join('\n');
  }

  const allSections = Object.entries(sections)
    .map(([name, text]) => {
      const isRevised = revised[name];
      const label = isRevised ? `[REVISED] ${name.toUpperCase()}` : name.toUpperCase();
      return `${label}\n${(isRevised ? revised[name] : text)}\n`;
    })
    .join('\n---\n\n');

  const output = [
    `RESEARCH COPILOT — EXPORT`,
    `Profile: ${profile.toUpperCase()}`,
    `Generated: ${new Date().toISOString()}`,
    '',
    hasRevisions ? '=== CHANGE SUMMARY ===\n' + changeLog : '=== NO REVISIONS MADE ===',
    '',
    '=== FULL PAPER ===',
    '',
    allSections,
  ].join('\n');

  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Content-Disposition', `attachment; filename="manuscript-export.txt"`);
  res.send(output);
});

module.exports = router;
