const { splitKeywords } = require('./text');

// Sections longer than this are not sent for refinement: the model is asked to
// return the whole section, and long outputs are where it starts dropping text.
const MAX_REFINABLE_CHARS = 12000;

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

module.exports = { findSection, listKeywords, replaceSectionBody, insertSection, refineBlocker };
