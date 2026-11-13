const test = require('node:test');
const assert = require('node:assert/strict');
const gemini = require('../src/ai/geminiClient');
const { refineSection } = require('../src/ai/geminiRefine');
const { getProfile } = require('../src/profiles');

const lncs = getProfile('lncs');
const introduction = {
  name: 'introduction',
  body: "Our detector doesn't need labels. It reaches 93.4% recall on the benchmark [2], and it's fast.",
};

// Replaces the Gemini call with scripted answers and records the prompts.
function stubGemini(t, answers) {
  const prompts = [];
  t.mock.method(gemini, 'generateJson', async (request) => {
    prompts.push(request.prompt);
    return answers[prompts.length - 1];
  });
  return prompts;
}

test('returns a clean revision after one call', async (t) => {
  const prompts = stubGemini(t, [
    {
      revised_text: 'Our detector does not need labels. It reaches 93.4% recall on the benchmark [2], and it is fast.',
      change_summary: 'Expanded two contractions.',
    },
  ]);

  const result = await refineSection({
    section: introduction,
    profile: lncs,
    requirements: ['Replace contractions with formal wording.'],
    abstract: '',
  });

  assert.equal(prompts.length, 1);
  assert.match(prompts[0], /<section>\nOur detector doesn't need labels/);
  assert.match(prompts[0], /- Replace contractions with formal wording\./);
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.preservation, { checked: 2, added: [], removed: [] });
  assert.equal(result.changeSummary, 'Expanded two contractions.');
});

test('asks again when the revision changes a number, and accepts the correction', async (t) => {
  const prompts = stubGemini(t, [
    { revised_text: 'Our detector does not need labels. It reaches 95% recall on the benchmark [2], and it is fast.', change_summary: 'x' },
    { revised_text: 'Our detector does not need labels. It reaches 93.4% recall on the benchmark [2], and it is fast.', change_summary: 'y' },
  ]);

  const result = await refineSection({ section: introduction, profile: lncs, requirements: [], abstract: '' });

  assert.equal(prompts.length, 2);
  assert.match(prompts[1], /previous revision was rejected/);
  assert.match(prompts[1], /95%/);
  assert.deepEqual(result.warnings, []);
});

test('returns warnings when the second attempt still alters a value', async (t) => {
  const altered = { revised_text: 'Our detector does not need labels. It reaches 95% recall on the benchmark, and it is fast.', change_summary: 'x' };
  stubGemini(t, [altered, altered]);

  const result = await refineSection({ section: introduction, profile: lncs, requirements: [], abstract: '' });

  assert.equal(result.warnings.length, 2);
  assert.match(result.warnings[0], /not in your original: 95%/);
  assert.match(result.warnings[1], /Dropped from your original: 93\.4%, \[2\]/);
});

test('rejects a revision that drops most of the section', async (t) => {
  stubGemini(t, [
    { revised_text: 'Fast.', change_summary: 'x' },
    { revised_text: 'Fast.', change_summary: 'x' },
  ]);

  await assert.rejects(
    refineSection({ section: introduction, profile: lncs, requirements: [], abstract: '' }),
    (err) => err instanceof gemini.GeminiError && err.status === 502,
  );
});

test('holds a shortened abstract to the profile word limit', async (t) => {
  const abstract = { name: 'abstract', body: Array(300).fill('word').join(' ') };
  const prompts = stubGemini(t, [
    { revised_text: Array(260).fill('word').join(' '), change_summary: 'x' },
    { revised_text: Array(240).fill('word').join(' '), change_summary: 'y' },
  ]);

  const result = await refineSection({ section: abstract, profile: lncs, requirements: [], abstract: '' });

  assert.match(prompts[1], /It is 260 words\. The limit is 250\./);
  assert.deepEqual(result.warnings, []);
});

test('keywords are normalised and must come from the abstract', async (t) => {
  const keywords = { name: 'keywords', body: 'anomaly detection, sensors' };
  const abstract = 'We study anomaly detection for sensor streams using edge computing and time series models.';
  const prompts = stubGemini(t, [
    { revised_text: 'anomaly detection; sensor streams; edge computing; blockchain', change_summary: 'x' },
    { revised_text: 'anomaly detection; sensor streams; edge computing; time series', change_summary: 'y' },
  ]);

  const result = await refineSection({ section: keywords, profile: lncs, requirements: [], abstract });

  assert.match(prompts[0], /<abstract>/);
  assert.match(prompts[1], /do not appear in the abstract or the current list: blockchain/);
  assert.equal(result.revisedText, 'anomaly detection, sensor streams, edge computing, time series');
  assert.equal(result.preservation, null);
});
