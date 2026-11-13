const test = require('node:test');
const assert = require('node:assert/strict');
const { parse, lncsPaper } = require('./fixtures');

const names = (manuscript) => manuscript.sections.map((section) => section.name);

test('splits an LNCS paper into its sections', () => {
  const manuscript = parse(lncsPaper());

  assert.equal(manuscript.title, 'Lightweight Anomaly Detection for Sensor Streams');
  assert.deepEqual(names(manuscript), ['abstract', 'keywords', 'introduction', 'method', 'conclusion', 'references']);
  assert.match(manuscript.frontMatter, /asha\.rao@example\.edu/);
});

test('reads run-in abstract and keyword labels', () => {
  const manuscript = parse(lncsPaper());
  const section = (name) => manuscript.sections.find((s) => s.name === name);

  assert.ok(section('abstract').body.startsWith('sensor streams'));
  assert.equal(section('keywords').body, 'anomaly detection, sensor streams, edge computing, time series');
  assert.equal(manuscript.keywordsLabel, 'Keywords');
});

test('recognises IEEE roman-numeral headings, including broken small caps', () => {
  const manuscript = parse(
    [
      'A Study of Things',
      'A. Author',
      'Abstract—This paper studies things.',
      'Index Terms—things, stuff, items',
      'I. I NTRODUCTION',
      'Opening text.',
      'II. RELATED WORK',
      'Earlier text.',
      'A. Datasets',
      'Details.',
      'III. CONCLUSION AND FUTURE WORK',
      'Closing text.',
      'REFERENCES',
      '[1] V. Kumar, "A paper," 2020.',
    ].join('\n'),
  );

  assert.deepEqual(names(manuscript), ['abstract', 'keywords', 'introduction', 'related work', 'conclusion', 'references']);
  assert.equal(manuscript.keywordsLabel, 'Index Terms');
  assert.equal(manuscript.sections[2].numbering, 'roman');
});

test('does not mistake a numbered list for section headings', () => {
  const manuscript = parse(
    lncsPaper({
      introduction: '1 Introduction\nThe pipeline has three steps:\n1. Collect data\n2. Train model\n3. Evaluate',
    }),
  );

  assert.deepEqual(names(manuscript), ['abstract', 'keywords', 'introduction', 'method', 'conclusion', 'references']);
  assert.match(manuscript.sections[2].body, /2\. Train model/);
});

test('does not mistake wrapped reference entries for headings', () => {
  const manuscript = parse(
    lncsPaper({
      references: 'References\n4. Vapnik, V.: Statistical Learning Theory. Wiley\n(1998)\n5. Rao, A.: Streams. Springer (2020)',
    }),
  );

  assert.equal(names(manuscript).at(-1), 'references');
  assert.match(manuscript.sections.at(-1).body, /Vapnik/);
});

test('records sub-headings without splitting the section', () => {
  const manuscript = parse(
    lncsPaper({ method: '2 Method\nOverview.\n2.1 Windowing\nText.\n2.1.1 Window Size\nMore text.' }),
  );

  assert.deepEqual(manuscript.subheadings.map((h) => h.depth), [2, 3]);
  assert.match(manuscript.sections.find((s) => s.name === 'method').body, /2\.1\.1 Window Size/);
});

test('treats every spelling of a conclusion heading as the conclusion', () => {
  for (const heading of ['5 Conclusions', '5. Conclusion and Future Work', '5 Concluding Remarks']) {
    const manuscript = parse(`Title\n\nAbstract. Text.\n\n4 Results\nNumbers.\n\n${heading}\nDone.`);
    assert.ok(names(manuscript).includes('conclusion'), heading);
  }
});
