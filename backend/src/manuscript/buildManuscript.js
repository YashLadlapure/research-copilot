const { parseManuscript } = require('./parseSections');
const { normalizeManuscript, wordCount } = require('./text');
const { findSection, listKeywords, replaceSectionBody, insertSection } = require('./sections');
const { extractFrontMatter } = require('../ai/extractFrontMatter');
const { GeminiError } = require('../ai/geminiClient');

// A rule-parsed abstract longer than this has almost certainly swallowed the
// introduction because the next heading was not recognised.
const MAX_PLAUSIBLE_ABSTRACT_WORDS = 600;

// The rule-based parse is the baseline. Gemini's answer fills in what the
// rules could not find: a title buried in an author block, or an abstract
// and keywords that carry no label.
function mergeFrontMatter(manuscript, found) {
  let merged = { ...manuscript, title: found.title || manuscript.title };

  const abstract = findSection(merged, 'abstract');
  const parsedWords = abstract ? wordCount(abstract.body) : 0;
  if (found.abstract && (parsedWords === 0 || parsedWords > MAX_PLAUSIBLE_ABSTRACT_WORDS)) {
    merged = abstract
      ? replaceSectionBody(merged, 'abstract', found.abstract)
      : insertSection(merged, 0, { name: 'abstract', heading: 'Abstract', numbering: 'none', body: found.abstract });
  }

  if (found.keywords.length > 0 && listKeywords(merged).length === 0) {
    const body = found.keywords.join(', ');
    merged = findSection(merged, 'keywords')
      ? replaceSectionBody(merged, 'keywords', body)
      : insertSection(merged, findSection(merged, 'abstract') ? 1 : 0, {
          name: 'keywords',
          heading: 'Keywords',
          numbering: 'none',
          body,
        });
  }
  return merged;
}

async function buildManuscript(rawText) {
  const text = normalizeManuscript(rawText);
  const parsed = { ...parseManuscript(text), totalWords: wordCount(text) };

  try {
    const found = await extractFrontMatter(text);
    return { manuscript: mergeFrontMatter(parsed, found), extraction: 'gemini' };
  } catch (err) {
    if (!(err instanceof GeminiError)) throw err;
    return { manuscript: parsed, extraction: 'rules' };
  }
}

module.exports = { buildManuscript, mergeFrontMatter };
