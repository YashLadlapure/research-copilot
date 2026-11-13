const test = require('node:test');
const assert = require('node:assert/strict');

delete process.env.GEMINI_API_KEY;
process.env.ALLOWED_ORIGINS = 'https://app.example.com';

const app = require('../src/app');
const gemini = require('../src/ai/geminiClient');
const { lncsPaper } = require('./fixtures');

let server;
let baseUrl;

test.before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => server.close());

async function post(path, body, headers = {}) {
  const response = await fetch(baseUrl + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json(), headers: response.headers };
}

const analyze = (overrides) => post('/api/analyze', { text: lncsPaper(overrides), profile: 'lncs' });

test('analysis falls back to rule-based parsing when Gemini is not configured', async () => {
  const { status, body } = await analyze();

  assert.equal(status, 200);
  assert.equal(body.extraction, 'rules');
  assert.equal(body.title, 'Lightweight Anomaly Detection for Sensor Streams');
  assert.equal(body.report.score, 100);
  assert.match(body.sessionId, /^[0-9a-f-]{36}$/);
});

test('invalid input is rejected with a JSON error instead of crashing', async () => {
  const cases = [
    [{ text: 123, profile: 'lncs' }, 400],
    [{ text: 'too short', profile: 'lncs' }, 400],
    [{ text: lncsPaper(), profile: 'apa' }, 400],
    [{ text: lncsPaper(), profile: 'constructor' }, 400],
    [{ text: 'x'.repeat(150001), profile: 'lncs' }, 413],
    ['{not json', 400],
  ];

  for (const [body, expected] of cases) {
    const response = await post('/api/analyze', body);
    assert.equal(response.status, expected);
    assert.equal(typeof response.body.error, 'string');
  }

  const health = await fetch(`${baseUrl}/health`);
  assert.equal(health.status, 200);
});

test('unknown routes return a JSON 404', async () => {
  const response = await fetch(`${baseUrl}/api/nope`);

  assert.equal(response.status, 404);
  assert.match((await response.json()).error, /No route/);
});

test('CORS allows only exact configured origins', async () => {
  const allowed = await fetch(`${baseUrl}/health`, { headers: { Origin: 'https://app.example.com' } });
  const lookalike = await fetch(`${baseUrl}/health`, { headers: { Origin: 'https://app.example.com.evil.test' } });

  assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://app.example.com');
  assert.equal(lookalike.headers.get('access-control-allow-origin'), null);
});

test('an unknown session id is reported as expired', async () => {
  const { status, body } = await post('/api/refine-section', { sessionId: 'missing', section: 'abstract' });

  assert.equal(status, 404);
  assert.equal(body.code, 'SESSION_EXPIRED');
});

test('refinement reports Gemini as unavailable when it is not configured', async () => {
  const { body: analysis } = await analyze();
  const { status, body } = await post('/api/refine-section', { sessionId: analysis.sessionId, section: 'introduction' });

  assert.equal(status, 503);
  assert.match(body.error, /not configured/);
});

test('references cannot be sent for refinement', async () => {
  const { body: analysis } = await analyze();
  const { status, body } = await post('/api/refine-section', { sessionId: analysis.sessionId, section: 'references' });

  assert.equal(status, 422);
  assert.match(body.error, /never rewritten/);
});

test('a suggestion cannot be applied before one exists', async () => {
  const { body: analysis } = await analyze();
  const { status } = await post('/api/apply-suggestion', { sessionId: analysis.sessionId, section: 'introduction' });

  assert.equal(status, 409);
});

test('switching profile re-scores the same session', async () => {
  const { body: analysis } = await analyze();
  const { status, body } = await post('/api/reanalyze', { sessionId: analysis.sessionId, profile: 'ieee' });

  assert.equal(status, 200);
  assert.equal(body.report.profile.key, 'ieee');
  assert.ok(body.report.issues.some((issue) => issue.id === 'heading-numbering:document'));
});

test('refine then apply updates the report and records the revision', async (t) => {
  const informal = "3 Conclusion\nThe method doesn't need labels and reaches 91% recall [2].";
  const formal = 'The method does not need labels and reaches 91% recall [2].';
  t.mock.method(gemini, 'generateJson', async () => ({ revised_text: formal, change_summary: 'Expanded a contraction.' }));

  const { body: analysis } = await analyze({ conclusion: informal });
  assert.ok(analysis.report.issues.some((issue) => issue.id === 'formal-tone:conclusion'));

  const refine = await post('/api/refine-section', { sessionId: analysis.sessionId, section: 'conclusion' });
  assert.equal(refine.status, 200);
  assert.equal(refine.body.suggestion.revisedText, formal);
  assert.deepEqual(refine.body.suggestion.warnings, []);

  const apply = await post('/api/apply-suggestion', { sessionId: analysis.sessionId, section: 'conclusion' });
  assert.equal(apply.status, 200);
  assert.deepEqual(apply.body.report.issues, []);
  assert.equal(apply.body.report.score, 100);
  assert.equal(apply.body.revisions.length, 1);
  assert.equal(apply.body.revisions[0].originalText, informal.split('\n')[1]);

  const again = await post('/api/apply-suggestion', { sessionId: analysis.sessionId, section: 'conclusion' });
  assert.equal(again.status, 409);
});

test('PDF upload rejects files that are not PDFs', async () => {
  const form = new FormData();
  form.append('pdf', new Blob(['plain text pretending to be a pdf'], { type: 'application/pdf' }), 'paper.pdf');
  const response = await fetch(`${baseUrl}/api/extract-pdf`, { method: 'POST', body: form });

  assert.equal(response.status, 415);
  assert.match((await response.json()).error, /not a PDF/);
});
