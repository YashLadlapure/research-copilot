function wordCount(text) {
  const trimmed = (text || '').trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

// Lowercased, whitespace-collapsed form used to test whether one piece of
// text appears inside another regardless of line wrapping.
function squash(text) {
  return (text || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function normalizeManuscript(text) {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t ]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function splitKeywords(text) {
  return (text || '')
    .replace(/\s+/g, ' ')
    .split(/\s*[,;·•∙]\s*/)
    .map((keyword) => keyword.trim().replace(/\.$/, ''))
    .filter((keyword) => keyword && keyword.length <= 80)
    .slice(0, 20);
}

module.exports = { wordCount, squash, normalizeManuscript, splitKeywords };
