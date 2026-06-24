const express = require('express');
const router = express.Router();
const { randomUUID } = require('crypto');
const { getProfileConfig } = require('../profiles/index');
const { createSession, getSession, updateSession } = require('../store');
const { evaluateCompliance } = require('../rules/evaluateCompliance');
const { extractSections } = require('../ai/geminiClient');

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

function normalizeText(text) {
  return text.trim().replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n');
}

function extractSectionBodies(text, detectedSections) {
  const bodies = {};
  const lines = text.split('\n');
  let currentSection = null;
  let buffer = [];

  const headingPattern = new RegExp(
    `^\\s*(?:\\d+\\.?\\s*)?(${detectedSections
      .map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|')})\\s*$`,
    'i'
  );

  for (const line of lines) {
    const match = line.match(headingPattern);
    if (match) {
      if (currentSection && buffer.length) {
        bodies[currentSection] = buffer.join('\n').trim();
      }
      currentSection = match[1].toLowerCase().replace(/^conclusions$/, 'conclusion');
      buffer = [];
    } else if (currentSection) {
      buffer.push(line);
    }
  }
  if (currentSection && buffer.length) {
    bodies[currentSection] = buffer.join('\n').trim();
  }
  return bodies;
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

async function buildStructuredManuscript(normalizedText, profile) {
  const geminiJson = await extractSections(normalizedText, profile);
  const base = mapToStructured(geminiJson);

  const regexFound = regexSectionScan(normalizedText);
  const mergedDetected = [...new Set([...base.sectionsDetected, ...regexFound])];
  const mergedMissing = base.sectionsMissing.filter(
    s => !mergedDetected.map(d => d.toLowerCase()).includes(s.toLowerCase())
  );

  const referencesPresent =
    base.referencesPresent ||
    mergedDetected.some(s => s.toLowerCase() === 'references' || s.toLowerCase() === 'bibliography');

  const sectionBodies = extractSectionBodies(normalizedText, mergedDetected);
  if (base.title) sectionBodies['title'] = sectionBodies['title'] || base.title;
  if (base.abstract) sectionBodies['abstract'] = sectionBodies['abstract'] || base.abstract;
  if (base.keywords && base.keywords.length) {
    sectionBodies['keywords'] = sectionBodies['keywords'] || base.keywords.join(', ');
  }

  return {
    ...base,
    sectionsDetected: mergedDetected,
    sectionsMissing: mergedMissing,
    referencesPresent,
    sections: sectionBodies,
    rawText: normalizedText,
  };
}

router.post('/', async (req, res) => {
  const { text, profile, sessionId: existingSessionId } = req.body;

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

  // BUG FIX #3: always re-run Gemini extraction on re-analyze so
  // applied revisions are reflected in the updated structured manuscript.
  // The old path re-used the stale existing.structuredManuscript without
  // re-processing the text, so the compliance score ran on outdated data.
  if (existingSessionId) {
    const existing = getSession(existingSessionId);
    if (existing) {
      let structuredManuscript;
      try {
        structuredManuscript = await buildStructuredManuscript(normalizedText, profile);
      } catch (err) {
        return res.status(502).json({ error: err.message });
      }
      const newReport = evaluateCompliance(structuredManuscript, profileConfig);
      updateSession(existingSessionId, { structuredManuscript, complianceReport: newReport, profile, normalizedText });
      return res.json({
        sessionId: existingSessionId,
        structuredManuscript,
        complianceReport: newReport,
      });
    }
  }

  let structuredManuscript;
  try {
    structuredManuscript = await buildStructuredManuscript(normalizedText, profile);
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }

  const complianceReport = evaluateCompliance(structuredManuscript, profileConfig);
  const sessionId = randomUUID();

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
