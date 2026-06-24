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

router.post('/', async (req, res) => {
  const { sessionId, targetSection, mode = 'strict' } = req.body;

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

  // sections live inside structured.sections, not at the top level
  const sectionMap = structured.sections || structured;

  const sectionKey =
    Object.keys(sectionMap).find((k) => k === targetSection) ||
    Object.keys(sectionMap).find((k) => k.toLowerCase() === targetSection.toLowerCase()) ||
    Object.keys(sectionMap).find((k) => k.toLowerCase().includes(targetSection.toLowerCase()));

  const originalText = sectionKey ? sectionMap[sectionKey] : null;
  if (!originalText) {
    return res.status(400).json({
      error: `Section "${targetSection}" not found. Available: ${Object.keys(sectionMap).join(', ')}`,
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
    const result = await refineSectionText(originalText, session.profile, mode, constraints);
    return res.json({
      suggestion: {
        target_section: targetSection,
        original_text: result.original_text || originalText,
        revised_text: result.revised_text,
        change_summary: result.change_summary,
        rationale: result.rationale,
        safety_note: result.safety_note,
        mode,
        confidence: result.confidence,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
