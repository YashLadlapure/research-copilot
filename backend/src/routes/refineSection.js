const express = require('express');
const { getProfile } = require('../profiles');
const { HttpError } = require('../errors');
const { findSection, refineBlocker } = require('../manuscript/sections');
const { refineSection } = require('../ai/geminiRefine');
const { requireSession } = require('./requireSession');

const router = express.Router();

router.post('/', async (req, res) => {
  const { sessionId, section: sectionName } = req.body ?? {};
  const session = requireSession(sessionId);

  const section = typeof sectionName === 'string' ? findSection(session.manuscript, sectionName) : null;
  if (!section) {
    throw new HttpError(404, 'That section was not found in this manuscript.');
  }
  const blocker = refineBlocker(section);
  if (blocker) {
    throw new HttpError(422, blocker);
  }

  const requirements = session.report.issues
    .filter((issue) => issue.section === section.name && issue.requirement)
    .map((issue) => issue.requirement);
  const abstract = findSection(session.manuscript, 'abstract');

  const revision = await refineSection({
    section,
    profile: getProfile(session.profile),
    requirements,
    abstract: abstract ? abstract.body : '',
  });

  const suggestion = { section: section.name, originalText: section.body, ...revision };
  session.pending[section.name] = suggestion;

  res.json({ suggestion });
});

module.exports = router;
