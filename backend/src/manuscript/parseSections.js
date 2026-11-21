const { splitKeywords } = require('./text');

const MAX_HEADING_CHARS = 80;
const MAX_HEADING_WORDS = 10;
const FRONT_MATTER_MAX_CHARS = 3000;

const ARABIC_HEADING = /^(\d{1,2}(?:\.\d{1,2})*)\.?\s+(\S.*)$/;
const ROMAN_HEADING = /^([IVX]+)\.\s+(\S.*)$/;
const ROMAN_NUMERAL = /^(?=[IVX])X{0,3}(?:IX|IV|V?I{0,3})$/;
const UNNUMBERED_HEADING =
  /^(abstract|keywords|key words|index terms|introduction|related work|background|literature review|methodology|methods?|experiments|evaluation|results|results and discussion|discussion|conclusions?|conclusions? and future work|future work|limitations|ethics statement|ethical considerations|acknowledge?ments?|references|bibliography)$/i;

// Lines that open a PDF's first page but are not the title.
const RUNNING_HEAD = /\b(?:journal|proceedings|transactions|vol\.|arxiv|preprint|copyright)\b|©/i;
const EMAIL = /@[\w-]+(?:\.[\w-]+)+/;
const FIRST_PAGE_CHARS = 6000;

const ABSTRACT_LABEL = /^abstract\s*[.:—–-]\s*(.*)$/i;
const KEYWORDS_LABEL = /^(keywords|key words|index terms)\s*[.:—–-]\s*(.*)$/i;

const MINOR_WORDS = new Set([
  'a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'from', 'in', 'into', 'nor', 'of',
  'on', 'or', 'over', 'per', 'the', 'to', 'under', 'using', 'via', 'vs', 'with', 'without',
]);

function romanToInt(numeral) {
  const values = { I: 1, V: 5, X: 10 };
  let total = 0;
  for (let i = 0; i < numeral.length; i++) {
    const value = values[numeral[i]];
    total += value < (values[numeral[i + 1]] || 0) ? -value : value;
  }
  return total;
}

function isTitleCase(words) {
  return words.every((word) => MINOR_WORDS.has(word.toLowerCase()) || !/^[a-z]/.test(word));
}

// A numbered line only counts as a heading if the rest of it reads like a
// title: capitalised, no closing punctuation, and short or in title case.
function looksLikeTitle(text) {
  if (!/^[A-Z]/.test(text) || /[.,;:!?]$/.test(text)) return false;
  const words = text.split(/\s+/);
  if (words.length > MAX_HEADING_WORDS) return false;
  return words.length <= 4 || isTitleCase(words);
}

function parseHeadingLine(rawLine) {
  const line = rawLine.trim();
  if (!line || line.length > MAX_HEADING_CHARS) return null;

  const arabic = line.match(ARABIC_HEADING);
  if (arabic && looksLikeTitle(arabic[2])) {
    const parts = arabic[1].split('.');
    return { numbering: 'arabic', number: Number(parts[0]), depth: parts.length, title: arabic[2] };
  }

  const roman = line.match(ROMAN_HEADING);
  if (roman && ROMAN_NUMERAL.test(roman[1]) && looksLikeTitle(roman[2])) {
    return { numbering: 'roman', number: romanToInt(roman[1]), depth: 1, title: roman[2] };
  }

  if (UNNUMBERED_HEADING.test(line)) {
    return { numbering: 'none', number: null, depth: 1, title: line };
  }
  return null;
}

// Maps the many spellings of a standard heading onto one name. Spaces are
// ignored because PDF text often renders small caps as "I NTRODUCTION".
function canonicalName(title) {
  const cleaned = title.toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
  const compact = cleaned.replace(/ /g, '');
  if (compact === 'abstract') return 'abstract';
  if (compact === 'keywords' || compact === 'indexterms') return 'keywords';
  if (compact.startsWith('introduction')) return 'introduction';
  if (/conclusion|concludingremarks/.test(compact)) return 'conclusion';
  if (/^acknowledge?ments?$/.test(compact)) return 'acknowledgements';
  if (compact === 'references' || compact === 'bibliography') return 'references';
  return cleaned;
}

function isStandardHeading(title) {
  return UNNUMBERED_HEADING.test(title.trim()) || ['introduction', 'conclusion'].includes(canonicalName(title));
}

// Adjacent lines numbered n, n+1 ("1. Collect data / 2. Train model") are a
// list, not a run of section headings.
function dropNumberedLists(candidates, lines) {
  const isNumberedTopLevel = (c) => c && c.depth === 1 && c.numbering !== 'none';
  const nonEmpty = lines.map((line, i) => (line.trim() ? i : -1)).filter((i) => i >= 0);
  const inList = new Set();

  for (let k = 0; k < nonEmpty.length - 1; k++) {
    const here = candidates[nonEmpty[k]];
    const next = candidates[nonEmpty[k + 1]];
    const consecutive =
      isNumberedTopLevel(here) &&
      isNumberedTopLevel(next) &&
      here.numbering === next.numbering &&
      next.number === here.number + 1;
    if (consecutive) inList.add(nonEmpty[k]).add(nonEmpty[k + 1]);
  }
  return candidates.map((candidate, i) => (inList.has(i) ? null : candidate));
}

function firstParagraph(text) {
  return text.split(/\n\s*\n/)[0];
}

function uniqueName(name, sections) {
  if (!sections.some((s) => s.name === name)) return name;
  let n = 2;
  while (sections.some((s) => s.name === `${name} (${n})`)) n++;
  return `${name} (${n})`;
}

// Without Gemini the title is taken to be the first line that is not a
// running head. A title wrapped over two lines is cut at the first.
function guessTitle(frontMatter) {
  const lines = frontMatter.split('\n').map((line) => line.trim()).filter(Boolean);
  const title = lines.find((line) => line.split(/\s+/).length >= 2 && !RUNNING_HEAD.test(line)) || lines[0] || '';
  return title.slice(0, 300);
}

function parseManuscript(text) {
  const lines = text.split('\n');
  const candidates = dropNumberedLists(lines.map(parseHeadingLine), lines);

  const sections = [];
  const subheadings = [];
  const frontMatterLines = [];
  let current = null;
  let lastNumber = 0;
  let keywordsLabel = null;

  const open = (name, heading, numbering, firstLine) => {
    current = { name: uniqueName(name, sections), heading, numbering, lines: firstLine ? [firstLine] : [] };
    sections.push(current);
  };
  const has = (name) => sections.some((s) => s.name === name);

  // A numbered heading has to continue the sequence, which filters out stray
  // numbered lines. Standard headings such as "5 Conclusion" are trusted even
  // after a gap, so one unrecognised heading cannot hide the rest of the
  // paper. Reference entries are numbered too, so nothing numbered counts as
  // a heading once the reference list has started.
  const acceptsHeading = (heading) => {
    if (heading.number === null) return true;
    if (has('references') || heading.number <= lastNumber) return false;
    return isStandardHeading(heading.title) || heading.number <= lastNumber + 2;
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();
    const beforeBody = lastNumber === 0;

    const abstractLabel = beforeBody && !has('abstract') && line.match(ABSTRACT_LABEL);
    if (abstractLabel) {
      open('abstract', 'Abstract', 'none', abstractLabel[1]);
      continue;
    }

    const keywordsMatch = beforeBody && !has('keywords') && line.match(KEYWORDS_LABEL);
    if (keywordsMatch) {
      keywordsLabel = keywordsMatch[1];
      open('keywords', keywordsMatch[1], 'none', keywordsMatch[2]);
      continue;
    }

    const heading = candidates[i];
    if (heading && heading.depth === 1 && acceptsHeading(heading)) {
      if (heading.number !== null) lastNumber = heading.number;
      const name = canonicalName(heading.title);
      if (name === 'keywords') keywordsLabel = heading.title;
      open(name, line, heading.numbering);
      continue;
    }
    if (heading && heading.depth > 1 && !has('references')) {
      subheadings.push({ depth: heading.depth, text: line });
    }

    if (current) current.lines.push(rawLine);
    else frontMatterLines.push(rawLine);
  }

  const parsed = sections.map(({ lines: bodyLines, ...section }) => {
    const body = bodyLines.join('\n').trim();
    return { ...section, body: section.name === 'keywords' ? splitKeywords(firstParagraph(body)).join(', ') : body };
  });

  const frontMatter = frontMatterLines.join('\n').trim().slice(0, FRONT_MATTER_MAX_CHARS);

  return {
    title: guessTitle(frontMatter),
    frontMatter,
    hasContactEmail: EMAIL.test(text.slice(0, FIRST_PAGE_CHARS)),
    keywordsLabel,
    sections: parsed,
    subheadings,
  };
}

module.exports = { parseManuscript, parseHeadingLine, canonicalName };
