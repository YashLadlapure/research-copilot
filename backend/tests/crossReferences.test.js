const test = require('node:test');
const assert = require('node:assert/strict');
const { lncsPaper, filler, evaluate } = require('./fixtures');

const issue = (report, id) => report.issues.find((item) => item.id === id);
const check = (report, id) => report.checks.find((item) => item.id === id);

const lncsReferences = (...extra) =>
  [
    'References',
    '1. Rao, A., Li, B.: Stream mining at the edge. In: Proceedings, pp. 1–10. Springer, Cham (2020)',
    '2. Chen, C.: Edge analytics. Springer, Heidelberg (2019)',
    '3. Diaz, D.: Sliding windows. J. Data 4(2), 1–9 (2021)',
    ...extra,
  ].join('\n');

test('a reference entry that is never cited is flagged on the reference list', () => {
  const report = evaluate(lncsPaper({ references: lncsReferences('4. Evans, E.: Unused work. Springer (2018)') }));
  const found = issue(report, 'citation-coverage:references');
  assert.ok(found);
  assert.match(found.problem, /1 of 4 reference entry is never cited.*\[4\]/);
  assert.deepEqual(found.evidence, ['4. Evans, E.: Unused work. Springer (2018)']);
  assert.equal(found.manualOnly, true);
});

test('a citation with no matching entry is flagged where it appears', () => {
  const report = evaluate(
    lncsPaper({ conclusion: '3 Conclusion\nThe method detects anomalies with low latency, unlike [7].' }),
  );
  const found = issue(report, 'citation-coverage:document');
  assert.ok(found);
  assert.match(found.problem, /points? to no entry.*\[7\]/);
  assert.deepEqual(found.evidence, ['[7]']);
});

test('citation ranges and lists count every number they cover', () => {
  const report = evaluate(
    lncsPaper({
      introduction: '1 Introduction\nSensor networks produce continuous streams [1–3].',
      method: '2 Method\nThe detector uses a sliding window, shown in Fig. 1. Table 1 lists the datasets.\nFig. 1. Overview of the pipeline.\nTable 1. Dataset statistics.',
    }),
  );
  assert.equal(check(report, 'citation-coverage').passed, true);
});

test('a figure or table the text never mentions is flagged', () => {
  const report = evaluate(
    lncsPaper({
      method: '2 Method\nThe detector uses a sliding window [3], see Figs. 1 and 2.\nFig. 1. Overview.\nFig. 2. Detail.\nFig. 3. Unused.\nTable 1. Dataset statistics.',
    }),
  );
  const found = issue(report, 'float-mentions:document');
  assert.ok(found);
  assert.equal(found.problem, 'Fig. 3 and Table 1 are never referred to in the text.');
  assert.deepEqual(found.evidence, ['Fig. 3. Unused.', 'Table 1. Dataset statistics.']);
});

test('Roman table numbers are matched for IEEE', () => {
  const paper = lncsPaper({
    method: '2 Method\nThe detector uses a sliding window [3], shown in Fig. 1. TABLE I lists the datasets.\nFig. 1. Overview of the pipeline.\nTABLE I\nDataset statistics',
  });
  assert.equal(check(evaluate(paper, 'ieee'), 'float-mentions').passed, true);
});

function aclPaper(overrides = {}) {
  const parts = {
    title: 'Lightweight Anomaly Detection for Sensor Streams',
    authors: 'Asha Rao and Ben Li\nExample University\nasha.rao@example.edu',
    abstract: `Abstract. ${filler(150)}`,
    introduction: '1 Introduction\nSensor networks produce streams (Rao and Li, 2020). Chen (2019) studied edge analytics.',
    method: '2 Method\nThe detector uses a sliding window (Diaz et al., 2021), shown in Figure 1.\nFigure 1: Overview of the pipeline.',
    conclusion: '3 Conclusion\nThe method detects anomalies with low latency.',
    limitations: 'Limitations\nThe evaluation covers one greenhouse.',
    references: [
      'References',
      'Chen Chen. 2019. Edge analytics. Springer, Heidelberg.',
      'Daniel Diaz, Eva Ng, and Omar Sami. 2021. Sliding windows. Journal of Data, 4(2):1–9.',
      'Asha Rao and Ben Li. 2020. Stream mining at the edge. In Proceedings of the Workshop, pages 1–10.',
    ].join('\n'),
    ...overrides,
  };
  return Object.values(parts).filter(Boolean).join('\n\n');
}

test('a compliant ACL paper needs no keywords and passes every check', () => {
  const report = evaluate(aclPaper(), 'acl');
  assert.deepEqual(report.issues.map((item) => item.id), []);
  assert.equal(report.score, 100);
  assert.equal(check(report, 'citation-coverage').passed, true);
});

test('ACL flags numbered citations, a numbered list and a missing Limitations section', () => {
  const report = evaluate(lncsPaper(), 'acl');
  const ids = report.issues.map((item) => item.id);
  assert.ok(ids.includes('citation-style:references'));
  assert.ok(ids.includes('reference-list:references'));
  assert.ok(ids.includes('has-limitations:limitations'));
  assert.ok(!ids.some((id) => id.startsWith('keyword')));
});

test('ACL matches author–year citations to entries in either name order', () => {
  const report = evaluate(
    aclPaper({ conclusion: '3 Conclusion\nThe method extends Smith (2017) to sensor streams.' }),
    'acl',
  );
  const missing = issue(report, 'citation-coverage:document');
  assert.match(missing.problem, /Smith \(2017\)/);
  assert.equal(issue(report, 'citation-coverage:references'), undefined);
});

test('ACL caps the abstract at 200 words and has no minimum', () => {
  const long = evaluate(aclPaper({ abstract: `Abstract. ${filler(230)}` }), 'acl');
  assert.equal(issue(long, 'abstract-length:abstract').severity, 'Critical');
  const short = evaluate(aclPaper({ abstract: `Abstract. ${filler(60)}` }), 'acl');
  assert.equal(check(short, 'abstract-length').passed, true);
});

test('ACM leaves abstract length and page count to the conference and checks colon captions', () => {
  const report = evaluate(lncsPaper(), 'acm');
  assert.equal(check(report, 'abstract-length'), undefined);
  assert.equal(check(report, 'page-estimate'), undefined);
  assert.equal(check(report, 'keyword-count'), undefined);
  assert.equal(check(report, 'figure-captions').passed, false);
  assert.match(issue(report, 'figure-captions:document').action, /Figure 1: Overview/);
});
