const express = require('express');
const router = express.Router();
const { getProfileConfig } = require('../profiles/index');
const { createSession } = require('../store');

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

function evaluateCompliance(structured, profileConfig) {
  const issues = [];
  const sectionStatus = [];
  const ruleChecks = [];

  for (const required of profileConfig.requiredSections) {
    const found = structured.sectionsDetected.includes(required) ||
      !structured.sectionsMissing.includes(required);
    ruleChecks.push({
      rule: `section_present_${required}`,
      passed: found,
      observedValue: found,
      expected: 'true',
    });
    if (!found) {
      issues.push({
        section: required,
        severity: 'Critical',
        problem: `Required section "${required}" is missing.`,
        action: `Add a "${required}" section before submission.`,
      });
      sectionStatus.push({ section: required, status: 'Critical', summary: 'Section not detected.' });
    } else {
      sectionStatus.push({ section: required, status: 'Good', summary: 'Section detected.' });
    }
  }

  const abstractWords = structured.abstract.trim().split(/\s+/).length;
  const abstractOk = abstractWords >= profileConfig.abstractMinWords && abstractWords <= profileConfig.abstractMaxWords;
  ruleChecks.push({
    rule: 'abstract_word_count',
    passed: abstractOk,
    observedValue: abstractWords,
    expected: `${profileConfig.abstractMinWords}–${profileConfig.abstractMaxWords} words`,
  });
  if (!abstractOk) {
    issues.push({
      section: 'abstract',
      severity: abstractWords > profileConfig.abstractMaxWords ? 'Critical' : 'Review',
      problem: `Abstract is ${abstractWords} words. ${profileConfig.name} requires ${profileConfig.abstractMinWords}–${profileConfig.abstractMaxWords} words.`,
      action: abstractWords > profileConfig.abstractMaxWords ? 'Shorten the abstract.' : 'Expand the abstract.',
    });
  }

  const deduction = issues.filter(i => i.severity === 'Critical').length * 20 +
    issues.filter(i => i.severity === 'Review').length * 10;
  const overallScore = Math.max(0, 100 - deduction);

  return {
    overallScore,
    issues,
    sectionStatus,
    ruleChecks,
    recommendedActions: issues.map(i => i.action),
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
