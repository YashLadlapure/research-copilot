const express = require('express');
const router = express.Router();
const { getSession, updateSession } = require('../store');
const { getProfileConfig } = require('../profiles/index');
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

// Rebuild a plain text string from session.structuredManuscript.sections
// so re-analysis runs on the current revised content, not the original paste.
function stitchSectionsToText(structured) {
  const sections = structured.sections || {};
  const order = [
    'title', 'abstract', 'keywords',
    ...KNOWN_SECTIONS,
  ];

  const seen = new Set();
  const parts = [];

  for (const key of order) {
    const lower = key.toLowerCase();
    if (seen.has(lower)) continue;
    const body = sections[lower];
    if (body && body.trim()) {
      parts.push(`${key.charAt(0).toUpperCase() + key.slice(1)}\n${body.trim()}`);
      seen.add(lower);
    }
  }

  // append any extra sections not in the predefined order
  for (const [key, body] of Object.entries(sections)) {
    if (!seen.has(key.toLowerCase()) && body && body.trim()) {
      parts.push(`${key.charAt(0).toUpperCase() + key.slice(1)}\n${body.trim()}`);
    }
  }

  return parts.join('\n\n');
}

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
  const { sessionId } = req.body;

  if (!sessionId) {
    return res.status(400).json({ error: '"sessionId" is required.' });
  }

  const session = getSession(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found.' });
  }

  let profileConfig;
  try {
    profileConfig = getProfileConfig(session.profile);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  // Build fresh text from the current (possibly revised) section bodies
  const stitchedText = stitchSectionsToText(session.structuredManuscript);
  const normalizedText = normalizeText(stitchedText);

  let geminiJson;
  try {
    geminiJson = await extractSections(normalizedText, session.profile);
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }

  const base = mapToStructured(geminiJson);

  // Merge with existing sections so revised bodies are preserved
  const existingSections = session.structuredManuscript.sections || {};
  const mergedSections = { ...existingSections };

  // Overlay Gemini-extracted top-level fields
  if (base.abstract) mergedSections['abstract'] = base.abstract;
  if (base.title) mergedSections['title'] = base.title;
  if (base.keywords && base.keywords.length) {
    mergedSections['keywords'] = base.keywords.join(', ');
  }

  const structuredManuscript = {
    ...session.structuredManuscript,
    title: base.title || session.structuredManuscript.title,
    abstract: base.abstract || session.structuredManuscript.abstract,
    keywords: base.keywords.length ? base.keywords : session.structuredManuscript.keywords,
    sectionsDetected: base.sectionsDetected.length
      ? base.sectionsDetected
      : session.structuredManuscript.sectionsDetected,
    sectionsMissing: base.sectionsMissing,
    referencesPresent: base.referencesPresent || session.structuredManuscript.referencesPresent,
    sections: mergedSections,
    rawText: normalizedText,
  };

  const complianceReport = evaluateCompliance(structuredManuscript, profileConfig);

  updateSession(sessionId, { structuredManuscript, complianceReport, normalizedText });

  return res.json({ sessionId, structuredManuscript, complianceReport });
});

module.exports = router;
