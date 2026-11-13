const test = require('node:test');
const assert = require('node:assert/strict');
const { lncsPaper, filler, evaluate } = require('./fixtures');

const issueIds = (report) => report.issues.map((issue) => issue.id);
const findIssue = (report, id) => report.issues.find((issue) => issue.id === id);

test('a compliant LNCS paper scores 100 with no issues', () => {
  const report = evaluate(lncsPaper());

  assert.deepEqual(issueIds(report), []);
  assert.equal(report.score, 100);
  assert.ok(report.checks.every((check) => check.passed));
});

test('an abstract over the limit is critical and can be refined', () => {
  const report = evaluate(lncsPaper({ abstract: `Abstract. ${filler(300)}` }));
  const issue = findIssue(report, 'abstract-length:abstract');

  assert.equal(issue.severity, 'Critical');
  assert.equal(issue.manualOnly, false);
  assert.match(issue.requirement, /at most 250 words/);
  assert.equal(report.score, 80);
});

test('an abstract under the minimum is left to the author', () => {
  const report = evaluate(lncsPaper({ abstract: `Abstract. ${filler(40)}` }));
  const issue = findIssue(report, 'abstract-length:abstract');

  assert.equal(issue.severity, 'Review');
  assert.equal(issue.manualOnly, true);
  assert.equal(issue.requirement, undefined);
});

test('a missing required section is critical and listed as missing', () => {
  const report = evaluate(lncsPaper({ conclusion: null }));

  assert.equal(findIssue(report, 'has-conclusion:conclusion').severity, 'Critical');
  assert.equal(report.sections.find((s) => s.name === 'conclusion').status, 'Missing');
});

test('an LNCS reference list numbered "1." is accepted', () => {
  const report = evaluate(lncsPaper());

  assert.equal(report.checks.find((check) => check.id === 'reference-list').passed, true);
});

test('an unnumbered author-year reference list is flagged', () => {
  const report = evaluate(
    lncsPaper({
      introduction: '1 Introduction\nStreams are common (Rao, 2020). Costs are high (Chen et al., 2019; Diaz, 2021). See also Lee (2018).',
      method: '2 Method\nThe detector uses a sliding window (Diaz, 2021).',
      references: 'References\nChen, C. (2019). Edge analytics. Springer.\nDiaz, D. (2021). Sliding windows. J. Data.\nRao, A. (2020). Stream mining.',
    }),
  );

  assert.ok(issueIds(report).includes('reference-list:references'));
  assert.ok(issueIds(report).includes('citation-style:references'));
});

test('reference list entries are not counted as in-text citations', () => {
  const report = evaluate(
    lncsPaper({
      introduction: `1 Introduction\n${filler(320)}`,
      method: '2 Method\nThe detector uses a sliding window.',
      references: 'References\n[1] A. Rao, "Stream mining," 2020.\n[2] C. Chen, "Edge analytics," 2019.',
    }),
  );

  assert.match(findIssue(report, 'citation-style:references').problem, /no in-text citations/);
});

test('contractions are flagged per section and can be refined', () => {
  const report = evaluate(
    lncsPaper({ conclusion: "3 Conclusion\nThe method doesn't need labels and it's fast. The authors' data is public." }),
  );
  const issue = findIssue(report, 'formal-tone:conclusion');

  assert.equal(issue.manualOnly, false);
  assert.match(issue.problem, /doesn't/);
  assert.doesNotMatch(issue.problem, /authors'/);
  assert.equal(report.sections.find((s) => s.name === 'conclusion').status, 'Review');
});

test('undefined acronyms are reported, defined and well-known ones are not', () => {
  const report = evaluate(
    lncsPaper({
      method: '2 Method\nA long short-term memory (LSTM) network feeds an SVM. The API returns JSON. LSTMs are standard.',
    }),
  );
  const issue = findIssue(report, 'acronyms:document');

  assert.match(issue.problem, /SVM/);
  assert.doesNotMatch(issue.problem, /LSTM|API|JSON/);
  assert.equal(issue.manualOnly, true);
});

test('deep heading numbering and a numbered acknowledgement are flagged for LNCS', () => {
  const report = evaluate(
    lncsPaper({
      method: '2 Method\nOverview.\n2.1 Windowing\nText.\n2.1.1 Window Size\nMore.',
      conclusion: '3 Conclusion\nDone.\n\n4 Acknowledgments\nThanks to the lab.',
    }),
  );

  assert.ok(issueIds(report).includes('heading-depth:document'));
  assert.ok(issueIds(report).includes('acknowledgements-heading:acknowledgements'));
});

test('sections out of order are flagged', () => {
  const inOrder = evaluate(lncsPaper());
  const swapped = evaluate(
    lncsPaper({
      introduction: 'Conclusion\nThe method detects anomalies [1].',
      method: null,
      conclusion: 'Introduction\nSensor networks produce streams [2].',
    }),
  );

  assert.equal(inOrder.checks.find((check) => check.id === 'section-order').passed, true);
  assert.match(findIssue(swapped, 'section-order:document').problem, /conclusion section appears before the introduction/);
});

test('caption format is checked against the profile', () => {
  const figureColon = lncsPaper({ method: '2 Method\nThe detector [3].\nFigure 1: Overview of the pipeline.' });

  assert.ok(issueIds(evaluate(figureColon)).includes('figure-captions:document'));
  assert.ok(issueIds(evaluate(lncsPaper(), 'ieee')).includes('table-captions:document'));
});

test('the same paper produces different issues under the IEEE profile', () => {
  const lncs = evaluate(lncsPaper());
  const ieee = evaluate(lncsPaper(), 'ieee');

  assert.deepEqual(issueIds(lncs), []);
  assert.ok(issueIds(ieee).includes('heading-numbering:document'));
  assert.ok(issueIds(ieee).includes('keyword-label:keywords'));
});

test('keyword count outside the range can be refined', () => {
  const report = evaluate(lncsPaper({ keywords: 'Keywords: anomaly detection, sensors' }));
  const issue = findIssue(report, 'keyword-count:keywords');

  assert.equal(issue.manualOnly, false);
  assert.match(issue.requirement, /between 4 and 6/);
});

test('missing keywords are reported once, not twice', () => {
  const report = evaluate(lncsPaper({ keywords: null }));

  assert.deepEqual(issueIds(report), ['has-keywords:keywords']);
});

test('author e-mail is only checked when there is an author block', () => {
  const withoutEmail = evaluate(lncsPaper({ authors: 'Asha Rao and Ben Li\nExample University, Pune, India' }));
  const anonymous = evaluate(lncsPaper({ authors: null }));

  assert.ok(issueIds(withoutEmail).includes('author-email:document'));
  assert.ok(!issueIds(anonymous).includes('author-email:document'));
});

test('references and the title cannot be refined, other present sections can', () => {
  const rows = Object.fromEntries(evaluate(lncsPaper()).sections.map((row) => [row.name, row]));

  assert.ok(rows.references.refineBlocker);
  assert.ok(rows.title.refineBlocker);
  assert.equal(rows.introduction.refineBlocker, null);
  assert.equal(rows.abstract.refineBlocker, null);
});
