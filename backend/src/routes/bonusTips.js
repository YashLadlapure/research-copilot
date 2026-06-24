const express = require('express');
const { getSession } = require('../store');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const router = express.Router();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

async function callGemini(prompt) {
  const model = genAI.getGenerativeModel({ model: MODEL });
  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

const PROFILE_LABELS = {
  lncs: 'Springer LNCS (Lecture Notes in Computer Science)',
  ieee: 'IEEE Conference',
};

router.post('/', async (req, res) => {
  const { sessionId, profile } = req.body;
  if (!sessionId || !profile) return res.status(400).json({ error: 'sessionId and profile required' });

  const session = getSession(sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const label = PROFILE_LABELS[profile] || profile;

  const prompt = `You are an expert academic publishing advisor.

A researcher is preparing a paper for ${label}.

Give exactly 7 specific, prioritized tips that will significantly increase the chance of acceptance for ${label}. These should be based on what reviewers and editors at ${label} look for.

Focus on: structure expectations, abstract quality, keyword selection, citation format, writing style, figure/table formatting, and common rejection reasons.

Return ONLY a JSON array of 7 strings. Each string is one actionable tip. No markdown, no explanation outside the JSON.

Example format:
["Tip one here.","Tip two here."]`;

  try {
    const raw = await callGemini(prompt);
    let tips;
    try {
      const match = raw.match(/(\[[\s\S]*?\])/);
      tips = match ? JSON.parse(match[1]) : JSON.parse(raw);
    } catch {
      tips = raw.split('\n').filter(l => l.trim().length > 10).slice(0, 7);
    }
    res.json({ tips, profile, label });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
