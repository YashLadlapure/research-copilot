const express = require('express');
const { getProfile, profileKeys } = require('../profiles');
const { createSession } = require('../store');
const { HttpError } = require('../errors');
const { buildManuscript } = require('../manuscript/buildManuscript');
const { evaluateCompliance } = require('../rules/evaluateCompliance');

const MIN_MANUSCRIPT_CHARS = 200;
const MAX_MANUSCRIPT_CHARS = 150000;

const router = express.Router();

router.post('/', async (req, res) => {
  const { text, profile: profileKey } = req.body ?? {};

  if (typeof text !== 'string' || text.trim().length < MIN_MANUSCRIPT_CHARS) {
    throw new HttpError(400, 'Paste at least the title, abstract and a few paragraphs of the manuscript.');
  }
  if (text.length > MAX_MANUSCRIPT_CHARS) {
    throw new HttpError(413, 'That manuscript is too long. The limit is 150,000 characters.');
  }
  const profile = getProfile(profileKey);
  if (!profile) {
    throw new HttpError(400, `Unknown profile. Use one of: ${profileKeys.join(', ')}.`);
  }

  const { manuscript, extraction } = await buildManuscript(text);
  const report = evaluateCompliance(manuscript, profile);
  const session = createSession({ profile: profile.key, manuscript, report, pending: {}, revisions: [] });

  res.json({ sessionId: session.id, title: manuscript.title, extraction, report });
});

module.exports = router;
