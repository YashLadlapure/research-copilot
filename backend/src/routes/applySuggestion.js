const express = require('express');
const router = express.Router();
const { getSession, updateSession } = require('../store');
const { getProfileConfig } = require('../profiles/index');
const { evaluateCompliance } = require('../rules/evaluateCompliance');

function parseKeywords(value) {
  if (Array.isArray(value)) return value.map(k => k.trim()).filter(Boolean);
  const str = String(value)
    .replace(/^keywords?[:\s]*/i, '')
    .replace(/^index\s+terms?[:\s]*/i, '')
    .trim();
  return str.split(/[,;\n]+/).map(k => k.trim()).filter(Boolean);
}

function rebuildStructured(structured, targetSection, revisedText) {
  const secLower = targetSection.toLowerCase();
  const updatedSections = { ...(structured.sections || {}) };

  if (secLower === 'keywords') {
    const parsed = parseKeywords(revisedText);
    updatedSections['keywords'] = parsed.join(', ');
    return { ...structured, keywords: parsed, sections: updatedSections };
  }

  if (secLower === 'abstract') {
    updatedSections['abstract'] = revisedText;
    return { ...structured, abstract: revisedText, sections: updatedSections };
  }

  if (secLower === 'title') {
    updatedSections['title'] = revisedText;
    return { ...structured, title: revisedText, sections: updatedSections };
  }

  updatedSections[secLower] = revisedText;
  return { ...structured, sections: updatedSections };
}

router.post('/', (req, res) => {
  const { sessionId, targetSection, revisedText } = req.body;

  if (!sessionId || !targetSection) {
    return res.status(400).json({ error: '"sessionId" and "targetSection" are required.' });
  }

  if (!revisedText || !revisedText.trim()) {
    return res.status(400).json({ error: '"revisedText" is required and cannot be empty.' });
  }

  const session = getSession(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found.' });
  }

  const structured = session.structuredManuscript;
  const secLower = targetSection.toLowerCase();

  const sectionMap = structured.sections || {};
  const topLevelKeys = ['title', 'abstract', 'keywords'];
  const existsInMap = Object.keys(sectionMap).some(k => k.toLowerCase() === secLower);
  const existsTopLevel = topLevelKeys.includes(secLower);
  const existsInDetected = (structured.sectionsDetected || []).some(
    s => s.toLowerCase() === secLower
  );

  if (!existsInMap && !existsTopLevel && !existsInDetected) {
    return res.status(400).json({
      error: `Section "${targetSection}" not found. Try re-analyzing the manuscript.`,
    });
  }

  const updatedManuscript = rebuildStructured(structured, targetSection, revisedText);

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

  return res.json({
    ok: true,
    applied: targetSection,
    complianceReport: newReport,
    structuredManuscript: updatedManuscript,
  });
});

module.exports = router;
