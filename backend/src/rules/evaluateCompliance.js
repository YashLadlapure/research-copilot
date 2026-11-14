const { wordCount } = require('../manuscript/text');
const { findSection, listKeywords, refineBlocker } = require('../manuscript/sections');

const PENALTY = { Critical: 20, Review: 5 };

const NUMERIC_CITATION = /\[\d+(?:\s*[-–,]\s*\d+)*\]/g;
const PARENTHETICAL_AUTHOR_YEAR = /\([A-Z][^()\d]{1,60}?,?\s(?:19|20)\d{2}[a-z]?(?:;[^()]*)?\)/g;
const NARRATIVE_AUTHOR_YEAR = /\b[A-Z][a-z]+(?:\set\sal\.|\sand\s[A-Z][a-z]+)?\s\((?:19|20)\d{2}[a-z]?\)/g;

const FIGURE_CAPTION_LINE = /^(?:Fig\.?|Figure|FIGURE)\s*\d+(?:[.:]|\s*$|\s+[A-Z])/;
const TABLE_CAPTION_LINE = /^(?:Table|TABLE)\s+(?:\d+|[IVXLC]+)(?:[.:]|\s*$|\s+[A-Z])/;

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

function missingSectionIssue(name, profile) {
  const { label, min, max } = profile.keywords;
  const advice = {
    title: ['No title was detected.', 'Put the paper title on the first line of the manuscript.'],
    abstract: ['No abstract was found.', 'Add an abstract introduced by the label "Abstract".'],
    keywords: [
      `No ${label.toLowerCase()} were found.`,
      `Add ${min}–${max} ${label.toLowerCase()} directly after the abstract, introduced by "${label}".`,
    ],
    references: ['No reference list was found.', 'Add a "References" section with a numbered list of sources.'],
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
  const expected = `${minWords}–${maxWords} words`;
  const observed = `${words} words`;

  if (words > maxWords) {
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
  if (words < minWords) {
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
  if (keywords.length === 0) return null;

  const { min, max, label } = profile.keywords;
  const expected = `${min}–${max}`;
  if (keywords.length >= min && keywords.length <= max) {
    return passed('keyword-count', `Number of ${label.toLowerCase()}`, expected, String(keywords.length));
  }
  const tooMany = keywords.length > max;
  return failed('keyword-count', `Number of ${label.toLowerCase()}`, expected, String(keywords.length), {
    section: 'keywords',
    severity: 'Review',
    problem: `${keywords.length} ${label.toLowerCase()} listed; ${profile.name} expects ${expected}.`,
    action: tooMany
      ? `Remove at least ${keywords.length - max}. Refinement keeps the most specific terms.`
      : `Add at least ${min - keywords.length}. Refinement suggests terms taken from your abstract.`,
    requirement: `Return between ${min} and ${max} keywords as a comma-separated list, using only terms that appear in the abstract or in the current list.`,
  });
}

function checkKeywordLabel(manuscript, profile) {
  if (!manuscript.keywordsLabel) return null;

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
  const numbered = lines.filter((line) => /^(?:\[\d+\]|\d{1,3}\.\s)/.test(line)).length;
  const authorFirst = lines.filter((line) => /^[A-Z][A-Za-z'’-]+,\s+[A-Z]\./.test(line)).length;

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
  if (manuscript.totalWords < 500) return null;

  const { max, wordsPerPage } = profile.pages;
  const pages = Math.ceil(manuscript.totalWords / wordsPerPage);
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
  checkCaptions,
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
