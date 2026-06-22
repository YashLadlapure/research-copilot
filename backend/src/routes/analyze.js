const express = require('express');
const router = express.Router();
const { getProfileConfig } = require('../profiles/index');
const { createSession } = require('../store');
const { evaluateCompliance } = require('../rules/evaluateCompliance');
const { extractSections } = require('../ai/geminiClient');

function normalizeText(text) {
  return text.trim().replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n');
}

function mapToStructured(geminiJson) {
  return {
    title: geminiJson.title || '',
    abstract: geminiJson.abstract || '',
    keywords: Array.isArray(geminiJson.keywords) ? geminiJson.keywords : [],
    sectionsDetected: Array.isArray(geminiJson.sections_detected) ? geminiJson.sections_detected : [],
    sectionsMissing: Array.isArray(geminiJson.sections_missing) ? geminiJson.sections_missing : [],
    referencesPresent: geminiJson.references_present === true,
  };
}

router.post('/', async (req, res) => {
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

  let structuredManuscript;
  try {
    const geminiJson = await extractSections(normalizedText, profile);
    structuredManuscript = mapToStructured(geminiJson);
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }

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
