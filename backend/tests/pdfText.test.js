const test = require('node:test');
const assert = require('node:assert/strict');
const { cleanPdfText } = require('../src/manuscript/pdfText');

test('removes running heads and page numbers that repeat across pages', () => {
  const pages = [
    'A Study of Things\nA. Author\nAbstract. Text.\n1',
    '2 A. Author et al.\nBody text on page two.\n2',
    '4 A. Author et al.\nBody text on page three.\n3',
    '6 A. Author et al.\nBody text on page four.\n4',
  ];

  const text = cleanPdfText(pages);

  assert.doesNotMatch(text, /et al\./);
  assert.doesNotMatch(text, /^\d$/m);
  assert.match(text, /^A Study of Things/);
  assert.match(text, /Body text on page four\.$/);
});

test('rejoins words hyphenated across a line break', () => {
  assert.equal(cleanPdfText(['Anomaly detec-\ntion for sensor net-\nworks.']), 'Anomaly detection for sensor networks.');
});

test('leaves a short document untouched', () => {
  assert.equal(cleanPdfText(['Title\nBody.', 'More body.']), 'Title\nBody.\nMore body.');
});
