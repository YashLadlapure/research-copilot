const { wordCount } = require('../manuscript/text');
const { findSection, listKeywords, refineBlocker } = require('../manuscript/sections');

const PENALTY = { Critical: 20, Review: 5 };

const NUMERIC_CITATION = /\[\d+(?:\s*[-–,]\s*\d+)*\]/g;
const NUMERIC_CITATION_GROUP = /\[(\d+(?:\s*[-–,]\s*\d+)*)\]/g;
const NUMBERED_REFERENCE = /^(?:\[(\d+)\]|(\d{1,3})\.\s)/;
const YEAR = /\b(?:19|20)\d{2}[a-z]?\b/;
const CAPITALISED_WORD = /\p{Lu}[\p{L}'’-]+/gu;
const NAME_FILLERS = new Set(['And', 'Et', 'Al', 'In', 'Proc', 'Proceedings']);
const PARENTHETICAL_AUTHOR_YEAR = /\([A-Z][^()\d]{1,60}?,?\s(?:19|20)\d{2}[a-z]?(?:;[^()]*)?\)/g;
const NARRATIVE_AUTHOR_YEAR = /\b[A-Z][a-z]+(?:\set\sal\.|\sand\s[A-Z][a-z]+)?\s\((?:19|20)\d{2}[a-z]?\)/g;

const FIGURE_CAPTION_LINE = /^(?:Fig\.?|Figure|FIGURE)\s*\d+(?:[.:]|\s*$|\s+[A-Z])/;
const TABLE_CAPTION_LINE = /^(?:Table|TABLE)\s+(?:\d+|[IVXLC]+)(?:[.:]|\s*$|\s+[A-Z])/;
const FIGURE_CAPTION_NUMBER = /^(?:Fig\.?|Figure|FIGURE)\s*(\d+)/;
const TABLE_CAPTION_NUMBER = /^(?:Table|TABLE)\s+(\d+|[IVXLC]+)/;
const FIGURE_MENTION = /\b(?:Fig(?:ure)?s?\.?|FIG\.|FIGURES?)\s*(\d+(?:\s*(?:[-–,]|and|&)\s*\d+)*)/g;
const TABLE_MENTION = /\b(?:Tables?|TABLES?)\s+((?:\d+|[IVXLC]+)(?:\s*(?:[-–,]|and|&)\s*(?:\d+|[IVXLC]+))*)\b/g;

const CONTRACTION = /\b(?:[A-Za-z]+n['’]t|(?:it|that|there|here|what|let)['’]s|[A-Za-z]+['’](?:re|ve|ll|d|m))\b/gi;
const INFORMAL_PHRASE = /\b(?:a lot of|lots of|a bunch of|tons of|pretty much|kinda|sorta|gonna|wanna|you can|you will|you should)\b/gi;
const TONE_EXEMPT = new Set(['keywords', 'acknowledgements', 'references']);

const ACRONYM = /\b[A-Z]{3,6}s?\b/g;
const ROMAN_NUMERAL = /^[IVXLC]+$/;
const WELL_KNOWN_ACRONYMS = new Set([
  'IEEE', 'ACM', 'LNCS', 'USA', 'PDF', 'URL', 'API', 'CPU', 'GPU', 'RAM', 'HTTP', 'HTTPS',
  'HTML', 'XML', 'JSON', 'SQL', 'DOI', 'ISBN', 'ISSN', 'ASCII',
]);
// Capitalised words that are not acronyms, mostly from captions and headings.
const NOT_ACRONYMS = new Set(['TABLE', 'FIG', 'FIGURE', 'NOTE', 'THE', 'AND', 'FOR', 'WITH']);

const EXPECTED_ORDER = ['abstract', 'keywords', 'introduction', 'conclusion', 'acknowledgements', 'references'];

const matches = (text, pattern) => text.match(pattern) || [];
const count = (text, pattern) => matches(text, pattern).length;
// The exact phrases that triggered an issue, so the client can mark them in
// the text. Capped because a long paper can repeat one mistake many times.
const evidence = (phrases) => [...new Set(phrases)].slice(0, 20);
const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

function bodyText(manuscript) {
  return manuscript.sections
    .filter((section) => section.name !== 'references')
    .map((section) => section.body)
    .join('\n');
}

function passed(id, label, expected, observed) {
  return { check: { id, label, expected, observed, passed: true }, issues: [] };
}

function failed(id, label, expected, observed, ...issues) {
  return {
    check: { id, label, expected, observed, passed: false },
    issues: issues.map((issue) => ({ id: `${id}:${issue.section}`, manualOnly: false, ...issue })),
  };
}

function isPresent(manuscript, name) {
  if (name === 'title') return Boolean(manuscript.title.trim());
  if (name === 'keywords') return listKeywords(manuscript).length > 0;
  return Boolean(findSection(manuscript, name));
}

function keywordRange({ min, max }) {
  if (min && max) return `${min}–${max}`;
  if (min) return `at least ${min}`;
  if (max) return `at most ${max}`;
  return null;
}

function missingSectionIssue(name, profile) {
  const label = profile.keywords?.label ?? 'Keywords';
  const range = profile.keywords ? keywordRange(profile.keywords) : null;
  const numbered = profile.citations === 'numeric';
  const advice = {
    title: ['No title was detected.', 'Put the paper title on the first line of the manuscript.'],
    abstract: ['No abstract was found.', 'Add an abstract introduced by the label "Abstract".'],
    keywords: [
      `No ${label.toLowerCase()} were found.`,
      `Add ${range ? `${range} ` : ''}${label.toLowerCase()} directly after the abstract, introduced by "${label}".`,
    ],
    references: [
      'No reference list was found.',
      numbered
        ? 'Add a "References" section with a numbered list of sources.'
        : 'Add an unnumbered "References" section listing every source cited in the text.',
    ],
  };
  const [problem, action] = advice[name] || [
    `No ${name} section was found.`,
    `Add a section headed "${capitalize(name)}". If it already exists, make sure its heading sits on its own line.`,
  ];
  return { section: name, severity: 'Critical', manualOnly: true, problem, action };
}

function checkRequiredSections(manuscript, profile) {
  return profile.requiredSections.map((name) => {
    const label = `${name === 'keywords' ? profile.keywords.label : capitalize(name)} present`;
    return isPresent(manuscript, name)
      ? passed(`has-${name}`, label, 'present', 'found')
      : failed(`has-${name}`, label, 'present', 'not found', missingSectionIssue(name, profile));
  });
}

function checkSectionOrder(manuscript) {
  const present = EXPECTED_ORDER.filter((name) => findSection(manuscript, name));
  if (present.length < 2) return null;

  const position = (name) => manuscript.sections.findIndex((section) => section.name === name);
  const expected = present.join(' → ');
  for (let i = 0; i < present.length - 1; i++) {
    const [earlier, later] = [present[i], present[i + 1]];
    if (position(earlier) > position(later)) {
      return failed('section-order', 'Section order', expected, `${later} before ${earlier}`, {
        section: 'document',
        severity: 'Review',
        manualOnly: true,
        problem: `The ${later} section appears before the ${earlier}.`,
        action: `Reorder the paper so the sections run: ${expected}.`,
      });
    }
  }
  return passed('section-order', 'Section order', expected, 'in order');
}

function checkHeadingNumbering(manuscript, profile) {
  const numbered = manuscript.sections.filter((section) => section.numbering !== 'none');
  if (numbered.length < 2) return null;

  const { numbering, example } = profile.headings;
  const mismatched = numbered.filter((section) => section.numbering !== numbering);
  const label = { arabic: 'Arabic numerals', roman: 'Roman numerals' };
  if (mismatched.length <= numbered.length / 2) {
    return passed('heading-numbering', 'Heading numbering', label[numbering], label[numbering]);
  }
  return failed('heading-numbering', 'Heading numbering', label[numbering], label[mismatched[0].numbering], {
    section: 'document',
    severity: 'Review',
    manualOnly: true,
    problem: `Section headings use ${label[mismatched[0].numbering]} (e.g. "${mismatched[0].heading}"). ${profile.name} uses ${label[numbering]}.`,
    action: `Renumber the headings in the ${profile.name} style: ${example}.`,
    evidence: evidence(mismatched.map((section) => section.heading)),
  });
}

function checkHeadingDepth(manuscript, profile) {
  const maxDepth = profile.headings.maxNumberedDepth;
  if (!maxDepth) return null;

  const tooDeep = manuscript.subheadings.filter((heading) => heading.depth > maxDepth);
  const expected = `numbered to ${maxDepth} levels`;
  if (tooDeep.length === 0) return passed('heading-depth', 'Heading depth', expected, 'within limit');
  return failed('heading-depth', 'Heading depth', expected, `${tooDeep.length} deeper`, {
    section: 'document',
    severity: 'Review',
    manualOnly: true,
    problem: `${tooDeep.length} ${tooDeep.length === 1 ? 'heading is' : 'headings are'} numbered deeper than ${maxDepth} levels, e.g. "${tooDeep[0].text}".`,
    action: `${profile.name} numbers only the first ${maxDepth} levels. Make lower-level headings unnumbered run-in headings.`,
    evidence: evidence(tooDeep.map((heading) => heading.text)),
  });
}

function checkAcknowledgementsHeading(manuscript) {
  const section = findSection(manuscript, 'acknowledgements');
  if (!section) return null;
  if (section.numbering === 'none') {
    return passed('acknowledgements-heading', 'Acknowledgements heading', 'unnumbered', 'unnumbered');
  }
  return failed('acknowledgements-heading', 'Acknowledgements heading', 'unnumbered', 'numbered', {
    section: 'acknowledgements',
    severity: 'Review',
    manualOnly: true,
    problem: `The acknowledgements heading is numbered ("${section.heading}").`,
    action: 'Remove the section number. Acknowledgements and References are unnumbered.',
    evidence: [section.heading],
  });
}

function checkAbstractLength(manuscript, profile) {
  const abstract = findSection(manuscript, 'abstract');
  if (!abstract) return null;

  const words = wordCount(abstract.body);
  const { minWords, maxWords } = profile.abstract;
  if (!minWords && !maxWords) return null;
  const expected = keywordRange({ min: minWords, max: maxWords }) + ' words';
  const observed = `${words} words`;

  if (maxWords && words > maxWords) {
    return failed('abstract-length', 'Abstract length', expected, observed, {
      section: 'abstract',
      severity: 'Critical',
      problem: `The abstract is ${words} words; ${profile.name} allows at most ${maxWords}.`,
      action: `Cut at least ${words - maxWords} words. Refinement can condense it without dropping results.`,
      requirement: `Condense the abstract to at most ${maxWords} words. It is currently ${words} words.`,
      // Everything past the limit, so the reader can see how much is over.
      evidence: [abstract.body.trim().split(/\s+/).slice(maxWords).join(' ')],
    });
  }
  if (minWords && words < minWords) {
    return failed('abstract-length', 'Abstract length', expected, observed, {
      section: 'abstract',
      severity: 'Review',
      manualOnly: true,
      problem: `The abstract is ${words} words; ${profile.name} expects at least ${minWords}.`,
      action: 'Add the missing motivation, method or result yourself. Refinement never adds content.',
    });
  }
  return passed('abstract-length', 'Abstract length', expected, observed);
}

function checkAbstractCitations(manuscript) {
  const abstract = findSection(manuscript, 'abstract');
  if (!abstract) return null;

  const found = [...matches(abstract.body, NUMERIC_CITATION), ...matches(abstract.body, PARENTHETICAL_AUTHOR_YEAR)];
  const citations = found.length;
  if (citations === 0) return passed('abstract-citations', 'Abstract free of citations', 'none', 'none');
  return failed('abstract-citations', 'Abstract free of citations', 'none', `${citations} found`, {
    section: 'abstract',
    severity: 'Review',
    manualOnly: true,
    problem: `The abstract contains ${citations} ${citations === 1 ? 'citation' : 'citations'}.`,
    action: 'Remove them. Abstracts are indexed on their own, without the reference list.',
    evidence: evidence(found),
  });
}

function checkKeywordCount(manuscript, profile) {
  const keywords = listKeywords(manuscript);
  if (keywords.length === 0 || !profile.keywords) return null;

  const { min, max, label } = profile.keywords;
  const expected = keywordRange(profile.keywords);
  if (!expected) return null;
  const tooMany = Boolean(max) && keywords.length > max;
  const tooFew = Boolean(min) && keywords.length < min;
  if (!tooMany && !tooFew) {
    return passed('keyword-count', `Number of ${label.toLowerCase()}`, expected, String(keywords.length));
  }
  return failed('keyword-count', `Number of ${label.toLowerCase()}`, expected, String(keywords.length), {
    section: 'keywords',
    severity: 'Review',
    problem: `${keywords.length} ${label.toLowerCase()} listed; ${profile.name} expects ${expected}.`,
    action: tooMany
      ? `Remove at least ${keywords.length - max}. Refinement keeps the most specific terms.`
      : `Add at least ${min - keywords.length}. Refinement suggests terms taken from your abstract.`,
    requirement: `Return ${min && max ? `between ${min} and ${max}` : expected} keywords as a comma-separated list, using only terms that appear in the abstract or in the current list.`,
  });
}

function checkKeywordLabel(manuscript, profile) {
  if (!manuscript.keywordsLabel || !profile.keywords) return null;

  const compact = (text) => text.toLowerCase().replace(/\s+/g, '');
  const expected = profile.keywords.label;
  if (compact(manuscript.keywordsLabel) === compact(expected)) {
    return passed('keyword-label', 'Keyword label', expected, manuscript.keywordsLabel);
  }
  return failed('keyword-label', 'Keyword label', expected, manuscript.keywordsLabel, {
    section: 'keywords',
    severity: 'Review',
    manualOnly: true,
    problem: `The keyword list is labelled "${manuscript.keywordsLabel}"; ${profile.name} labels it "${expected}".`,
    action: `Rename the label to "${expected}".`,
  });
}

function checkTitle(manuscript) {
  const title = manuscript.title.trim();
  if (!title) return [];

  const letters = title.replace(/[^A-Za-z]/g, '');
  const allCaps = letters.length >= 10 && letters === letters.toUpperCase();
  const titleIssue = (problem, action) => ({ section: 'title', severity: 'Review', manualOnly: true, problem, action });

  return [
    /\.$/.test(title)
      ? failed('title-punctuation', 'Title punctuation', 'no final period', 'ends with a period',
          titleIssue('The title ends with a period.', 'Remove the final period from the title.'))
      : passed('title-punctuation', 'Title punctuation', 'no final period', 'ok'),
    allCaps
      ? failed('title-capitals', 'Title capitalisation', 'title case', 'all capitals',
          titleIssue('The title is written entirely in capitals.', 'Use title case. The template applies its own styling.'))
      : passed('title-capitals', 'Title capitalisation', 'title case', 'ok'),
  ];
}

function checkCitationStyle(manuscript, profile) {
  const text = bodyText(manuscript);
  const numeric = count(text, NUMERIC_CITATION);
  const authorYearCitations = [...matches(text, PARENTHETICAL_AUTHOR_YEAR), ...matches(text, NARRATIVE_AUTHOR_YEAR)];
  const authorYear = authorYearCitations.length;
  const observed = `${numeric} numeric, ${authorYear} author–year`;

  if (profile.citations === 'author-year') {
    const expected = 'author–year, e.g. (Smith, 2020)';
    if (numeric >= 3 && numeric > authorYear) {
      return failed('citation-style', 'In-text citation style', expected, observed, {
        section: 'references',
        severity: 'Critical',
        manualOnly: true,
        problem: `Citations use numbered style (${numeric} found); ${profile.name} uses author–year citations.`,
        action: 'Cite by author and year, such as (Smith, 2020) or Smith (2020), and list the references alphabetically without numbers.',
        evidence: evidence(matches(text, NUMERIC_CITATION)),
      });
    }
    return passed('citation-style', 'In-text citation style', expected, observed);
  }

  if (authorYear >= 3 && authorYear > numeric) {
    return failed('citation-style', 'In-text citation style', 'numeric, e.g. [1]', observed, {
      section: 'references',
      severity: 'Critical',
      manualOnly: true,
      problem: `Citations use author–year style (${authorYear} found); ${profile.name} uses numbered citations.`,
      action: 'Change in-text citations to bracketed numbers such as [1] and number the reference list to match.',
      evidence: evidence(authorYearCitations),
    });
  }
  if (numeric === 0 && authorYear === 0) {
    if (!findSection(manuscript, 'references') || wordCount(text) < 300) return null;
    return failed('citation-style', 'In-text citation style', 'numeric, e.g. [1]', 'no citations found', {
      section: 'references',
      severity: 'Review',
      manualOnly: true,
      problem: 'The paper has a reference list but no in-text citations were found.',
      action: 'Cite every listed reference in the text with a bracketed number such as [1].',
    });
  }
  return passed('citation-style', 'In-text citation style', 'numeric, e.g. [1]', observed);
}

function checkReferenceList(manuscript, profile) {
  const references = findSection(manuscript, 'references');
  if (!references || !references.body.trim()) return null;

  const lines = references.body.split('\n').map((line) => line.trim()).filter(Boolean);
  const numbered = lines.filter((line) => NUMBERED_REFERENCE.test(line)).length;
  const authorFirst = lines.filter((line) => /^[A-Z][A-Za-z'’-]+,\s+[A-Z]\./.test(line)).length;

  if (profile.citations === 'author-year') {
    const expected = 'unnumbered, alphabetical';
    if (numbered < 2) return passed('reference-list', 'Reference list numbering', expected, 'unnumbered');
    return failed('reference-list', 'Reference list numbering', expected, `${numbered} numbered`, {
      section: 'references',
      severity: 'Review',
      manualOnly: true,
      problem: `The reference list is numbered; ${profile.name} lists references alphabetically by first author, without numbers.`,
      action: `Remove the numbers and sort the list by first author. ${profile.name} format: ${profile.references.example}`,
    });
  }

  if (numbered > 0) {
    return passed('reference-list', 'Reference list numbering', 'numbered entries', `${numbered} numbered`);
  }
  if (authorFirst < 2) return null;
  return failed('reference-list', 'Reference list numbering', 'numbered entries', 'unnumbered', {
    section: 'references',
    severity: 'Critical',
    manualOnly: true,
    problem: 'The reference list is not numbered; entries start with author names.',
    action: `Number the entries. ${profile.name} format: ${profile.references.example}`,
  });
}

function checkCaptions(manuscript, profile) {
  const lines = bodyText(manuscript).split('\n').map((line) => line.trim());
  const kinds = [
    ['figure', FIGURE_CAPTION_LINE],
    ['table', TABLE_CAPTION_LINE],
  ];

  return kinds.map(([kind, captionLine]) => {
    const captions = lines.filter((line) => captionLine.test(line));
    if (captions.length === 0) return null;

    const { pattern, example } = profile.captions[kind];
    const matching = captions.filter((line) => pattern.test(line)).length;
    const label = `${capitalize(kind)} caption format`;
    if (matching > 0) return passed(`${kind}-captions`, label, example, `${matching} of ${captions.length} match`);
    return failed(`${kind}-captions`, label, example, `0 of ${captions.length} match`, {
      section: 'document',
      severity: 'Review',
      manualOnly: true,
      problem: `${capitalize(kind)} captions do not follow the ${profile.name} format (found "${captions[0].slice(0, 40)}").`,
      action: `Format ${kind} captions like this: ${example}`,
      evidence: evidence(captions),
    });
  });
}

function isAllCapsLine(line) {
  const letters = line.replace(/[^A-Za-z]/g, '');
  return letters.length >= 4 && letters === letters.toUpperCase();
}

function checkAcronyms(manuscript) {
  const text = bodyText(manuscript)
    .split('\n')
    .filter((line) => !isAllCapsLine(line))
    .join('\n');
  const singular = (token) => token.replace(/s$/, '');
  const tokens = matches(text, ACRONYM);
  const acronyms = [...new Set(tokens.map(singular))];
  if (acronyms.length === 0) return null;

  const isDefined = (acronym) =>
    new RegExp(`\\(${acronym}s?\\)|\\b${acronym}s?\\s\\(`).test(text);
  const undefinedAcronyms = acronyms.filter(
    (acronym) =>
      !WELL_KNOWN_ACRONYMS.has(acronym) &&
      !NOT_ACRONYMS.has(acronym) &&
      !ROMAN_NUMERAL.test(acronym) &&
      !isDefined(acronym),
  );

  const expected = 'defined on first use';
  if (undefinedAcronyms.length === 0) {
    return passed('acronyms', 'Acronyms defined', expected, `${acronyms.length} checked`);
  }
  const shown = undefinedAcronyms.slice(0, 6).join(', ');
  const more = undefinedAcronyms.length > 6 ? ` and ${undefinedAcronyms.length - 6} more` : '';
  return failed('acronyms', 'Acronyms defined', expected, `${undefinedAcronyms.length} undefined`, {
    section: 'document',
    severity: 'Review',
    manualOnly: true,
    problem: `${undefinedAcronyms.length} ${undefinedAcronyms.length === 1 ? 'acronym appears' : 'acronyms appear'} without a definition: ${shown}${more}.`,
    action: 'Spell each one out where it first appears, e.g. "convolutional neural network (CNN)".',
    evidence: evidence(undefinedAcronyms.map((acronym) => tokens.find((token) => singular(token) === acronym))),
  });
}

function checkFormalTone(manuscript) {
  const issues = [];
  let hits = 0;

  for (const section of manuscript.sections) {
    if (TONE_EXEMPT.has(section.name)) continue;
    const found = [...matches(section.body, CONTRACTION), ...matches(section.body, INFORMAL_PHRASE)];
    if (found.length === 0) continue;

    hits += found.length;
    const examples = [...new Set(found.map((phrase) => phrase.toLowerCase()))]
      .slice(0, 4)
      .map((phrase) => `"${phrase}"`)
      .join(', ');
    issues.push({
      section: section.name,
      severity: 'Review',
      problem: `Informal wording in the ${section.name}: ${examples}.`,
      action: 'Replace contractions and conversational phrases with formal equivalents.',
      requirement: `Replace contractions and conversational phrases (such as ${examples}) with formal wording.`,
      evidence: evidence(found),
    });
  }

  if (issues.length === 0) return passed('formal-tone', 'Formal wording', 'no contractions', 'none found');
  return failed('formal-tone', 'Formal wording', 'no contractions', `${hits} found`, ...issues);
}

function checkAuthorEmail(manuscript, profile) {
  const authorBlockLines = manuscript.frontMatter.split('\n').filter((line) => line.trim());
  if (authorBlockLines.length < 2) return null;

  if (manuscript.hasContactEmail) {
    return passed('author-email', 'Author e-mail', 'present', 'found');
  }
  return failed('author-email', 'Author e-mail', 'present', 'not found', {
    section: 'document',
    severity: 'Review',
    manualOnly: true,
    problem: 'No author e-mail address was found on the first page.',
    action: `${profile.name} papers give an e-mail address for at least the corresponding author. Ignore this for double-blind submissions.`,
  });
}

function checkLength(manuscript, profile) {
  const { max, wordsPerPage, excludedSections = [] } = profile.pages;
  if (!max) return null;

  // Some formats do not count the references (or other closing sections)
  // towards the page limit.
  const excludedWords = manuscript.sections
    .filter((section) => excludedSections.includes(section.name))
    .reduce((total, section) => total + wordCount(section.body), 0);
  const words = manuscript.totalWords - excludedWords;
  if (words < 500) return null;
  const pages = Math.ceil(words / wordsPerPage);
  const observed = `about ${pages} pages`;
  if (pages <= max) return passed('page-estimate', 'Estimated length', `up to ${max} pages`, observed);
  return failed('page-estimate', 'Estimated length', `up to ${max} pages`, observed, {
    section: 'document',
    severity: 'Review',
    manualOnly: true,
    problem: `Estimated length is about ${pages} pages; ${profile.name} papers are usually limited to ${max}.`,
    action: 'The estimate is from word count alone and ignores figures. Check the real page count in the template and your call for papers.',
  });
}

// "1, 3–5" → [1, 3, 4, 5]. Very long ranges are ignored as misreads.
function citedNumbers(group) {
  const numbers = [];
  for (const part of group.split(',')) {
    const [from, to] = part.split(/[-–]/).map((n) => Number(n.trim()));
    if (!Number.isInteger(to)) numbers.push(from);
    else if (to >= from && to - from <= 50) for (let n = from; n <= to; n++) numbers.push(n);
  }
  return numbers.filter(Number.isInteger);
}

const listNumbers = (items) => items.map((n) => `[${n}]`).join(', ');

function numericCitationCoverage(manuscript, references) {
  const listed = new Map();
  for (const line of references.body.split('\n').map((l) => l.trim())) {
    const match = line.match(NUMBERED_REFERENCE);
    if (match) listed.set(Number(match[1] ?? match[2]), line);
  }
  const cited = new Map();
  for (const match of bodyText(manuscript).matchAll(NUMERIC_CITATION_GROUP)) {
    for (const n of citedNumbers(match[1])) if (!cited.has(n)) cited.set(n, match[0]);
  }
  if (listed.size === 0 || cited.size === 0) return null;

  const uncited = [...listed.keys()].filter((n) => !cited.has(n));
  const missing = [...cited.keys()].filter((n) => !listed.has(n));
  return {
    uncited: uncited.map((n) => ({ label: n, phrase: listed.get(n) })),
    missing: missing.map((n) => ({ label: n, phrase: cited.get(n) })),
    total: listed.size,
    describe: listNumbers,
  };
}

// Author–year entries are matched to citations by year plus any capitalised
// name before the year, because formats differ on whether the surname or
// the given name comes first.
function authorYearEntries(body) {
  const blocks = /\n\s*\n/.test(body) ? body.split(/\n\s*\n/) : body.split('\n');
  return blocks
    .map((block) => block.trim())
    .filter((block) => YEAR.test(block))
    .map((block) => {
      const flat = block.replace(/\s+/g, ' ');
      const year = flat.match(YEAR)[0];
      const names = (flat.slice(0, flat.search(YEAR)).match(CAPITALISED_WORD) || []).filter(
        (word) => !NAME_FILLERS.has(word),
      );
      return { first: block.split('\n')[0].trim(), year, names: new Set(names) };
    })
    .filter((entry) => entry.names.size > 0);
}

function authorYearCitations(text) {
  const citations = [];
  for (const phrase of matches(text, PARENTHETICAL_AUTHOR_YEAR)) {
    for (const piece of phrase.slice(1, -1).split(';')) {
      const name = piece.match(CAPITALISED_WORD)?.[0];
      const year = piece.match(YEAR)?.[0];
      if (name && year) citations.push({ name, year, phrase: piece.trim() });
    }
  }
  for (const phrase of matches(text, NARRATIVE_AUTHOR_YEAR)) {
    citations.push({ name: phrase.match(CAPITALISED_WORD)[0], year: phrase.match(YEAR)[0], phrase });
  }
  return citations;
}

function authorYearCitationCoverage(manuscript, references) {
  const entries = authorYearEntries(references.body);
  const citations = authorYearCitations(bodyText(manuscript));
  if (entries.length === 0 || citations.length === 0) return null;

  const pairs = (citation, entry) => entry.year === citation.year && entry.names.has(citation.name);
  const uncited = entries.filter((entry) => !citations.some((citation) => pairs(citation, entry)));
  const seen = new Set();
  const missing = citations.filter((citation) => {
    const key = `${citation.name} ${citation.year}`;
    if (seen.has(key) || entries.some((entry) => pairs(citation, entry))) return false;
    seen.add(key);
    return true;
  });
  return {
    uncited: uncited.map((entry) => ({ label: `${[...entry.names][0]} (${entry.year})`, phrase: entry.first })),
    missing: missing.map((citation) => ({ label: `${citation.name} (${citation.year})`, phrase: citation.phrase })),
    total: entries.length,
    describe: (labels) => labels.join(', '),
  };
}

const shortList = (labels, describe) =>
  labels.length > 6 ? `${describe(labels.slice(0, 6))} and ${labels.length - 6} more` : describe(labels);

function checkCitationCoverage(manuscript, profile) {
  const references = findSection(manuscript, 'references');
  if (!references || !references.body.trim()) return null;

  const coverage =
    profile.citations === 'author-year'
      ? authorYearCitationCoverage(manuscript, references)
      : numericCitationCoverage(manuscript, references);
  if (!coverage) return null;

  const { uncited, missing, total, describe } = coverage;
  const label = 'Citations match references';
  const expected = 'every entry cited, every citation listed';
  if (uncited.length === 0 && missing.length === 0) {
    return passed('citation-coverage', label, expected, `${total} entries, all cited`);
  }

  const issues = [];
  if (uncited.length > 0) {
    const labels = uncited.map((item) => item.label);
    issues.push({
      section: 'references',
      severity: 'Review',
      manualOnly: true,
      problem: `${uncited.length} of ${total} reference ${uncited.length === 1 ? 'entry is' : 'entries are'} never cited in the text: ${shortList(labels, describe)}.`,
      action: 'Cite each one where the work is used, or remove it from the list.',
      evidence: evidence(uncited.map((item) => item.phrase)),
    });
  }
  if (missing.length > 0) {
    const labels = missing.map((item) => item.label);
    issues.push({
      section: 'document',
      severity: 'Review',
      manualOnly: true,
      problem: `${missing.length} ${missing.length === 1 ? 'citation points' : 'citations point'} to no entry in the reference list: ${shortList(labels, describe)}.`,
      action: 'Add the missing entries to the reference list, or correct the citation.',
      evidence: evidence(missing.map((item) => item.phrase)),
    });
  }
  return failed('citation-coverage', label, expected, `${uncited.length} uncited, ${missing.length} not listed`, ...issues);
}

// "1–3 and 5" → ['1', '2', '3', '5']; Roman table numbers are kept as written.
function mentionedNumbers(group) {
  const numbers = [];
  for (const part of group.split(/\s*(?:,|and|&)\s*/)) {
    const [from, to] = part.split(/[-–]/).map((n) => n.trim());
    if (/^\d+$/.test(from) && /^\d+$/.test(to ?? '') && Number(to) - Number(from) <= 50) {
      for (let n = Number(from); n <= Number(to); n++) numbers.push(String(n));
    } else if (from) {
      numbers.push(from.toUpperCase());
    }
  }
  return numbers;
}

function checkFloatMentions(manuscript) {
  const lines = bodyText(manuscript).split('\n').map((line) => line.trim());
  const kinds = [
    { captionLine: FIGURE_CAPTION_LINE, captionNumber: FIGURE_CAPTION_NUMBER, mention: FIGURE_MENTION },
    { captionLine: TABLE_CAPTION_LINE, captionNumber: TABLE_CAPTION_NUMBER, mention: TABLE_MENTION },
  ];

  const captions = [];
  const unmentioned = [];
  for (const kind of kinds) {
    const own = lines.filter((line) => kind.captionLine.test(line));
    if (own.length === 0) continue;
    const prose = lines.filter((line) => !kind.captionLine.test(line)).join('\n');
    const mentioned = new Set([...prose.matchAll(kind.mention)].flatMap((match) => mentionedNumbers(match[1])));
    for (const line of own) {
      const [label, number] = line.match(kind.captionNumber);
      captions.push(line);
      if (!mentioned.has(number.toUpperCase())) unmentioned.push({ label, line });
    }
  }
  if (captions.length === 0) return null;

  const label = 'Figures and tables referred to';
  const expected = 'each one mentioned in the text';
  if (unmentioned.length === 0) {
    return passed('float-mentions', label, expected, `${captions.length} of ${captions.length} mentioned`);
  }
  const names = unmentioned.map((item) => item.label);
  const shown = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0];
  return failed('float-mentions', label, expected, `${unmentioned.length} not mentioned`, {
    section: 'document',
    severity: 'Review',
    manualOnly: true,
    problem: `${shown} ${unmentioned.length === 1 ? 'is' : 'are'} never referred to in the text.`,
    action: 'Refer to every figure and table in the text, e.g. "as shown in Fig. 2", near where it appears.',
    evidence: evidence(unmentioned.map((item) => item.line)),
  });
}

const CHECKS = [
  checkRequiredSections,
  checkSectionOrder,
  checkHeadingNumbering,
  checkHeadingDepth,
  checkAcknowledgementsHeading,
  checkTitle,
  checkAbstractLength,
  checkAbstractCitations,
  checkKeywordCount,
  checkKeywordLabel,
  checkCitationStyle,
  checkReferenceList,
  checkCitationCoverage,
  checkCaptions,
  checkFloatMentions,
  checkAcronyms,
  checkFormalTone,
  checkAuthorEmail,
  checkLength,
];

function summarizeSections(manuscript, profile, issues) {
  const statusOf = (name) => {
    const own = issues.filter((issue) => issue.section === name);
    if (own.some((issue) => issue.severity === 'Critical')) return 'Critical';
    return own.length > 0 ? 'Review' : 'Good';
  };
  const isRequired = (name) => profile.requiredSections.includes(name);

  const title = manuscript.title.trim();
  const rows = [
    {
      name: 'title',
      present: Boolean(title),
      required: isRequired('title'),
      status: title ? statusOf('title') : 'Missing',
      words: wordCount(title),
      refineBlocker: 'The title is never rewritten automatically.',
    },
    ...manuscript.sections.map((section) => ({
      name: section.name,
      present: true,
      required: isRequired(section.name),
      status: statusOf(section.name),
      words: wordCount(section.body),
      refineBlocker: refineBlocker(section),
    })),
  ];

  const missing = profile.requiredSections
    .filter((name) => name !== 'title' && !findSection(manuscript, name))
    .map((name) => ({ name, present: false, required: true, status: 'Missing', words: 0, refineBlocker: 'Section not found.' }));

  return [...rows, ...missing];
}

function evaluateCompliance(manuscript, profile) {
  const results = CHECKS.flatMap((check) => check(manuscript, profile)).filter(Boolean);
  const checks = results.map((result) => result.check);
  const issues = results
    .flatMap((result) => result.issues)
    .sort((a, b) => PENALTY[b.severity] - PENALTY[a.severity]);

  const penalty = issues.reduce((total, issue) => total + PENALTY[issue.severity], 0);

  return {
    profile: { key: profile.key, name: profile.name },
    score: Math.max(0, 100 - penalty),
    issues,
    checks,
    sections: summarizeSections(manuscript, profile, issues),
    manualChecks: profile.manualChecks,
  };
}

module.exports = { evaluateCompliance };
