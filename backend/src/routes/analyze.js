const express = require('express');
const router = express.Router();
const { getProfileConfig } = require('../profiles/index');
const { createSession } = require('../store');
const { evaluateCompliance } = require('../rules/evaluateCompliance');

function normalizeText(text) {
  return text.trim().replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n');
}

function buildDummyStructured(text) {
  return {
    title: 'Extracted Title (placeholder)',
    abstract: text.slice(0, 300),
    keywords: ['keyword1', 'keyword2', 'keyword3'],
    sectionsDetected: ['introduction', 'methodology', 'results', 'conclusion', 'references'],
    sectionsMissing: ['abstract', 'keywords'],
    referencesPresent: true,
  };
}

router.post('/', (req, res) => {
  const { text, profile } = req.body;

  if (!text || !profile) {
    return res.status(400).json({ error: 'Both "text" and "profile" are required.' });
  }

  let profileConfig;
  try {
    profileConfig = getProfileConfig(profile);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const normalizedText = normalizeText(text);
  const structuredManuscript = buildDummyStructured(normalizedText);
  const complianceReport = evaluateCompliance(structuredManuscript, profileConfig);
  const sessionId = Date.now().toString();

  createSession({
    id: sessionId,
    profile,
    originalText: text,
    normalizedText,
    structuredManuscript,
    complianceReport,
    revisions: [],
  });

  return res.json({ sessionId, structuredManuscript, complianceReport });
});

module.exports = router;
