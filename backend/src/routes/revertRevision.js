const express = require('express');
const { getProfile } = require('../profiles');
const { HttpError } = require('../errors');
const { findSection, replaceSectionBody, toDocument } = require('../manuscript/sections');
const { evaluateCompliance } = require('../rules/evaluateCompliance');
const { requireSession } = require('./requireSession');

const router = express.Router();

// Puts a section back to the text it had before any revision was accepted,
// and drops that section's revisions from the history.
router.post('/', (req, res) => {
  const { sessionId, section: sectionName } = req.body ?? {};
  const session = requireSession(sessionId);

  const own = session.revisions.filter((revision) => revision.section === sectionName);
  if (typeof sectionName !== 'string' || own.length === 0) {
    throw new HttpError(409, 'That section has no accepted revision to undo.');
  }
  const section = findSection(session.manuscript, sectionName);
  if (!section || section.body !== own.at(-1).revisedText) {
    throw new HttpError(409, 'That section has changed since the revision was accepted, so it cannot be undone.');
  }

  session.manuscript = replaceSectionBody(session.manuscript, sectionName, own[0].originalText);
  session.report = evaluateCompliance(session.manuscript, getProfile(session.profile));
  session.revisions = session.revisions.filter((revision) => revision.section !== sectionName);
  delete session.pending[sectionName];

  res.json({ report: session.report, revisions: session.revisions, document: toDocument(session.manuscript) });
});

module.exports = router;
