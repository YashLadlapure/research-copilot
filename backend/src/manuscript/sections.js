const { splitKeywords, squash } = require('./text');

// Sections longer than this are not sent for refinement: the model is asked to
// return the whole section, and long outputs are where it starts dropping text.
const MAX_REFINABLE_CHARS = 12000;

// Text extracted from a PDF can carry a long run of affiliations and notices
// before the abstract. The first few lines are enough to show who wrote it.
const MAX_BYLINE_LINES = 6;

function findSection(manuscript, name) {
  return manuscript.sections.find((section) => section.name === name) || null;
}

function listKeywords(manuscript) {
  const section = findSection(manuscript, 'keywords');
  return section ? splitKeywords(section.body) : [];
}

function replaceSectionBody(manuscript, name, body) {
  return {
    ...manuscript,
    sections: manuscript.sections.map((section) => (section.name === name ? { ...section, body } : section)),
  };
}

function insertSection(manuscript, index, section) {
  const sections = [...manuscript.sections];
  sections.splice(index, 0, section);
  return { ...manuscript, sections };
}

// Returns why a section cannot be refined, or null if it can.
function refineBlocker(section) {
  if (section.name === 'references') return 'References are never rewritten automatically.';
  if (!section.body.trim()) return 'This section has no text to refine.';
  if (section.body.length > MAX_REFINABLE_CHARS) {
    return 'This section is too long to refine in one pass (limit is roughly 1,800 words).';
  }
  return null;
}

// What the client needs to draw the paper: the lines under the title, each
// section's text, and which lines inside a section are sub-headings.
function toDocument(manuscript) {
  const title = squash(manuscript.title);
  const byline = manuscript.frontMatter
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !title.includes(squash(line)))
    .slice(0, MAX_BYLINE_LINES);

  return {
    byline,
    subheadings: manuscript.subheadings.map((heading) => heading.text),
    sections: manuscript.sections.map(({ name, heading, body }) => ({ name, heading, body })),
  };
}

module.exports = { findSection, listKeywords, replaceSectionBody, insertSection, refineBlocker, toDocument };
