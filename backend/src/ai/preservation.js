const CITATION =
  /\[\d+(?:\s*[-–,]\s*\d+)*\]|\\(?:cite[a-z]*|ref|eqref|autoref)\{[^}]*\}|\([A-Z][^()\d]{1,60}?,?\s(?:19|20)\d{2}[a-z]?(?:;[^()]*)?\)/g;
const NUMBER = /\d+(?:[.,]\d+)*(?:\s?%)?/g;

function extractFacts(text) {
  const citations = (text.match(CITATION) || []).map((citation) => citation.replace(/\s+/g, ' '));
  const numbers = (text.replace(CITATION, ' ').match(NUMBER) || []).map((number) =>
    number.replace(/\s/g, '').replace(/,(?=\d{3}(?!\d))/g, ''),
  );
  return [...numbers, ...citations];
}

// Items of `from` that have no counterpart in `other`, counting duplicates.
function missingFrom(from, other) {
  const remaining = new Map();
  for (const item of other) remaining.set(item, (remaining.get(item) || 0) + 1);

  return from.filter((item) => {
    const left = remaining.get(item) || 0;
    if (left === 0) return true;
    remaining.set(item, left - 1);
    return false;
  });
}

// Compares the numbers and citation markers in a revision against the
// original. `added` means the model wrote a value the author never did.
function comparePreservation(original, revised) {
  const before = extractFacts(original);
  const after = extractFacts(revised);
  return {
    checked: before.length,
    added: missingFrom(after, before),
    removed: missingFrom(before, after),
  };
}

module.exports = { comparePreservation };
