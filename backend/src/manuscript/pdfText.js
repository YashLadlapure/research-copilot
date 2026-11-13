const RUNNING_LINE_MIN_PAGES = 3;

const maskDigits = (line) => line.trim().replace(/\d+/g, '#');

function edgeLines(lines) {
  const first = lines.findIndex((line) => line.trim());
  const last = lines.findLastIndex((line) => line.trim());
  return first === -1 ? [] : [...new Set([first, last])];
}

// Running heads and page numbers sit on the first or last line of a page and
// repeat from page to page with only the number changing.
function stripRunningLines(pages) {
  const pageLines = pages.map((page) => page.split('\n'));

  const seen = new Map();
  for (const lines of pageLines) {
    for (const index of edgeLines(lines)) {
      const key = maskDigits(lines[index]);
      seen.set(key, (seen.get(key) || 0) + 1);
    }
  }

  return pageLines.map((lines) => {
    const running = edgeLines(lines).filter((index) => seen.get(maskDigits(lines[index])) >= RUNNING_LINE_MIN_PAGES);
    return lines.filter((_, index) => !running.includes(index)).join('\n');
  });
}

// Takes the text of each PDF page and returns one manuscript string. Words
// hyphenated across a line break are rejoined so word counts stay accurate.
function cleanPdfText(pages) {
  return stripRunningLines(pages)
    .join('\n')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/([a-z])-\n([a-z])/g, '$1$2')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

module.exports = { cleanPdfText };
