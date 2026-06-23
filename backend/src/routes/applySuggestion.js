const express = require('express');
const router = express.Router();
const { getSession, updateSession } = require('../store');
const { getProfileConfig } = require('../profiles/index');
const { evaluateCompliance } = require('../rules/evaluateCompliance');

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

  const updatedManuscript = revisedText
    ? { ...structured, [sectionKey]: revisedText }
    : structured;

  let profileConfig;
  try {
    profileConfig = getProfileConfig(session.profile);
  } catch (_) {
    profileConfig = null;
  }

  const newReport = profileConfig
    ? evaluateCompliance(updatedManuscript, profileConfig)
    : session.complianceReport;

  updateSession(sessionId, {
    structuredManuscript: updatedManuscript,
    complianceReport: newReport,
  });

  return res.json({ ok: true, applied: targetSection, complianceReport: newReport });
});

module.exports = router;
