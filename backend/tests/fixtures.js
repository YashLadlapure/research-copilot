const { parseManuscript } = require('../src/manuscript/parseSections');
const { normalizeManuscript, wordCount } = require('../src/manuscript/text');
const { evaluateCompliance } = require('../src/rules/evaluateCompliance');
const { getProfile } = require('../src/profiles');

function filler(words) {
  const vocabulary = ['sensor', 'streams', 'require', 'efficient', 'detection', 'methods', 'under', 'tight', 'latency', 'budgets'];
  return `${Array.from({ length: words }, (_, i) => vocabulary[i % vocabulary.length]).join(' ')}.`;
}

// A small paper that satisfies every LNCS check. Tests override one part at a
// time to trigger a single rule.
function lncsPaper(overrides = {}) {
  const parts = {
    title: 'Lightweight Anomaly Detection for Sensor Streams',
    authors: 'Asha Rao and Ben Li\nExample University, Pune, India\nasha.rao@example.edu',
    abstract: `Abstract. ${filler(170)}`,
    keywords: 'Keywords: anomaly detection · sensor streams · edge computing · time series',
    introduction: '1 Introduction\nSensor networks produce continuous streams [1]. Earlier approaches [2] are costly to run.',
    method: '2 Method\nThe detector uses a sliding window [3].\nFig. 1. Overview of the pipeline.\nTable 1. Dataset statistics.',
    conclusion: '3 Conclusion\nThe method detects anomalies with low latency.',
    references: [
      'References',
      '1. Rao, A., Li, B.: Stream mining at the edge. In: Proceedings, pp. 1–10. Springer, Cham (2020)',
      '2. Chen, C.: Edge analytics. Springer, Heidelberg (2019)',
      '3. Diaz, D.: Sliding windows. J. Data 4(2), 1–9 (2021)',
    ].join('\n'),
    ...overrides,
  };
  return Object.values(parts).filter(Boolean).join('\n\n');
}

function parse(text) {
  const normalized = normalizeManuscript(text);
  return { ...parseManuscript(normalized), totalWords: wordCount(normalized) };
}

function evaluate(text, profileKey = 'lncs') {
  return evaluateCompliance(parse(text), getProfile(profileKey));
}

module.exports = { lncsPaper, filler, parse, evaluate };
