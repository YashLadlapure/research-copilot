const lncsProfile = {
  name: 'Springer LNCS',
  key: 'lncs',
  requiredSections: ['title', 'abstract', 'keywords', 'introduction', 'conclusion', 'references'],
  optionalSections: ['related work', 'background', 'methodology', 'experiments', 'results', 'discussion', 'future work'],
  abstractMinWords: 70,
  abstractMaxWords: 150,
  abstractParagraphs: 1,
  keywordsRequired: true,
  keywordsMinCount: 4,
  keywordsMaxCount: 6,
  keywordsLabel: 'Keywords',
  referenceSectionRequired: true,
  referenceStyle: 'numeric',
  referenceStyleNote: 'Numeric style in square brackets, e.g. [1], ordered by appearance.',
  tone: 'formal academic',
  pageRange: { min: 12, max: 15 },
  notes: 'Abstract must be a single paragraph between 70–150 words. Keywords (4–6) appear directly after the abstract. References use numeric square-bracket style ordered by first citation.'
};

module.exports = lncsProfile;
