const express = require('express');
const router = express.Router();
const { getSession, updateSession } = require('../store');
const { getProfileConfig } = require('../profiles/index');
const { evaluateCompliance } = require('../rules/evaluateCompliance');

const KNOWN_SECTIONS = [
  'abstract', 'introduction', 'related work', 'literature review', 'background',
  'methodology', 'methods', 'approach', 'system design', 'system architecture',
  'architecture', 'implementation', 'design', 'experiments', 'experimental setup',
  'evaluation', 'results', 'results and discussion', 'discussion', 'analysis',
  'performance', 'conclusion', 'conclusions', 'future work', 'future scope',
  'acknowledgements', 'acknowledgments', 'references', 'bibliography',
];

function regexSectionScan(text) {
  const found = new Set();
  const lower = text.toLowerCase();
  for (const sec of KNOWN_SECTIONS) {
    const escaped = sec.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(
      `(?:^|\\n)\\s*(?:\\d+\\.?\\s*)?${escaped}\\s*(?:\\n|$)`,
      'i'
    );
    if (pattern.test(lower)) found.add(sec === 'conclusions' ? 'conclusion' : sec);
  }
  return [...found];
}

function parseKeywords(value) {
  if (Array.isArray(value)) return value.map(k => k.trim()).filter(Boolean);
  const str = String(value)
    .replace(/^keywords?[:\s]*/i, '')
    .replace(/^index\s+terms?[:\s]*/i, '')
    .trim();
  return str.split(/[,;\n]+/).map(k => k.trim()).filter(Boolean);
}

function rebuildStructured(structured, sectionKey, revisedText) {
  let updated;

  if (sectionKey.toLowerCase() === 'keywords') {
    const parsedKeywords = parseKeywords(revisedText);
    updated = { ...structured, keywords: parsedKeywords };
  } else {
    updated = { ...structured, [sectionKey]: revisedText };
  }

  const textParts = [
    updated.title || '',
    updated.abstract ? `Abstract\n${updated.abstract}` : '',
    Array.isArray(updated.keywords) && updated.keywords.length
      ? `Keywords\n${updated.keywords.join(', ')}`
      : '',
    ...(updated.sectionsDetected || []).map(s => `${s}\n`),
  ];
  const approxText = textParts.join('\n\n');

  const regexFound = regexSectionScan(approxText);
  const implicitSections = [];
  if (updated.title && updated.title.trim()) implicitSections.push('title');
  if (updated.abstract && updated.abstract.trim()) implicitSections.push('abstract');
  if (Array.isArray(updated.keywords) && updated.keywords.length > 0) implicitSections.push('keywords');
  if (updated.referencesPresent) implicitSections.push('references');

  const mergedDetected = [...new Set([...updated.sectionsDetected, ...regexFound, ...implicitSections])];
  const mergedMissing = (updated.sectionsMissing || []).filter(
    s => !mergedDetected.map(d => d.toLowerCase()).includes(s.toLowerCase())
  );

  return { ...updated, sectionsDetected: mergedDetected, sectionsMissing: mergedMissing };
}

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
    ? rebuildStructured(structured, sectionKey, revisedText)
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

  return res.json({
    ok: true,
    applied: targetSection,
    complianceReport: newReport,
    structuredManuscript: updatedManuscript,
  });
});

module.exports = router;
