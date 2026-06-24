const express = require('express');
const router = express.Router();
const { getSession } = require('../store');
const { getProfileConfig } = require('../profiles/index');
const { refineSectionText } = require('../ai/geminiRefine');

function buildConstraints(targetSection, complianceReport, profileConfig) {
  const constraints = [];
  const sectionLower = targetSection.toLowerCase();

  if (complianceReport && complianceReport.issues) {
    for (const issue of complianceReport.issues) {
      if (issue.section && issue.section.toLowerCase() === sectionLower) {
        if (issue.problem) constraints.push(issue.problem);
        if (issue.recommended_action) constraints.push(issue.recommended_action);
      }
    }
  }

  if (profileConfig) {
    if (sectionLower === 'abstract') {
      constraints.push(
        `The revised abstract MUST be ${profileConfig.abstractMaxWords} words or fewer — this is a hard limit for ${profileConfig.name}.`
      );
    }
    if (sectionLower === 'keywords') {
      constraints.push(
        `${profileConfig.name} requires ${profileConfig.keywordsMinCount}–${profileConfig.keywordsMaxCount} keywords, labeled "${profileConfig.keywordsLabel}".`
      );
    }
  }

  return constraints;
}

function extractFromRawText(normalizedText, targetSection) {
  if (!normalizedText) return null;
  const lines = normalizedText.split('\n');
  const escaped = targetSection.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const headingRe = new RegExp(`^\\s*(?:\\d+\\.?\\s*)?${escaped}\\s*$`, 'i');
  const topLevelHeadingRe = /^\s*(?:\d+\.?\s*)?[A-Z][A-Za-z ]{2,40}\s*$/;
  const subHeadingRe = /^\s*\d+\.\d+/;

  let inSection = false;
  const buffer = [];
  for (const line of lines) {
    if (headingRe.test(line)) {
      inSection = true;
      continue;
    }
    if (inSection) {
      if (
        topLevelHeadingRe.test(line) &&
        !subHeadingRe.test(line) &&
        line.trim().length > 0
      ) break;
      buffer.push(line);
    }
  }
  return buffer.length ? buffer.join('\n').trim() : null;
}

router.post('/', async (req, res) => {
  // BUG FIX #4: removed stale `mode` param — geminiRefine.js ignores it
  // (the _mode parameter in refineSectionText is already a no-op).
  // Frontend was sending mode:'compliance' but default was 'strict' — now
  // the param is simply not accepted or forwarded to avoid future confusion.
  const { sessionId, targetSection } = req.body;

  if (!sessionId || !targetSection) {
    return res.status(400).json({ error: '"sessionId" and "targetSection" are required.' });
  }

  const session = getSession(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found. Please re-analyze your manuscript.' });
  }

  const structured = session.structuredManuscript;
  if (!structured) {
    return res.status(400).json({ error: 'No structured manuscript found. Run Analyze first.' });
  }

  const sectionMap = structured.sections || {};
  const targetLower = targetSection.toLowerCase();

  const sectionKey =
    Object.keys(sectionMap).find(k => k === targetSection) ||
    Object.keys(sectionMap).find(k => k.toLowerCase() === targetLower);

  let originalText = sectionKey ? sectionMap[sectionKey] : null;

  if (!originalText) {
    originalText = extractFromRawText(session.normalizedText, targetSection);
  }

  if (!originalText) {
    return res.status(400).json({
      error: `Section "${targetSection}" text could not be located. Try re-analyzing the manuscript.`,
    });
  }

  let profileConfig;
  try {
    profileConfig = getProfileConfig(session.profile);
  } catch (_) {
    profileConfig = null;
  }

  const constraints = buildConstraints(targetSection, session.complianceReport, profileConfig);

  try {
    const result = await refineSectionText(originalText, session.profile, null, constraints);
    return res.json({
      suggestion: {
        target_section: targetSection,
        original_text: result.original_text || originalText,
        revised_text: result.revised_text,
        change_summary: result.change_summary,
        rationale: result.rationale,
        safety_note: result.safety_note,
        confidence: result.confidence,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
