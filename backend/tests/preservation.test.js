const test = require('node:test');
const assert = require('node:assert/strict');
const { comparePreservation } = require('../src/ai/preservation');

const original = 'Our model reaches 93.4% accuracy on 1,000 samples [3], improving on earlier work [1, 2] by 2.1 points.';

test('a pure rewording changes nothing', () => {
  const revised = 'The model attains 93.4 % accuracy on 1000 samples [3], which is 2.1 points above earlier work [1, 2].';

  assert.deepEqual(comparePreservation(original, revised), { checked: 5, added: [], removed: [] });
});

test('an altered number is reported as both added and removed', () => {
  const result = comparePreservation(original, original.replace('93.4%', '94.3%'));

  assert.deepEqual(result.added, ['94.3%']);
  assert.deepEqual(result.removed, ['93.4%']);
});

test('a dropped citation is reported', () => {
  const result = comparePreservation(original, original.replace(' [3]', ''));

  assert.deepEqual(result.added, []);
  assert.deepEqual(result.removed, ['[3]']);
});

test('an invented citation is reported', () => {
  const result = comparePreservation(original, `${original} This matches prior findings [7].`);

  assert.deepEqual(result.added, ['[7]']);
});

test('author-year citations and LaTeX references are tracked', () => {
  const source = 'As shown before (Smith et al., 2020), see \\cite{rao2021} and \\ref{fig:overview}.';
  const result = comparePreservation(source, 'As shown before, see \\cite{rao2021}.');

  assert.deepEqual(result.removed, ['(Smith et al., 2020)', '\\ref{fig:overview}']);
});

test('repeated values are counted, not just matched', () => {
  const result = comparePreservation('We ran 5 trials on 5 datasets.', 'We ran 5 trials.');

  assert.deepEqual(result.removed, ['5']);
});
