const ieeeProfile = {
  name: 'IEEE Conference',
  key: 'ieee',
  requiredSections: ['title', 'abstract', 'keywords', 'introduction', 'conclusion', 'references'],
  optionalSections: ['related work', 'background', 'methodology', 'experiments', 'results', 'discussion', 'future work'],
  abstractMinWords: 100,
  abstractMaxWords: 250,
  abstractParagraphs: 1,
  keywordsRequired: true,
  keywordsMinCount: 3,
  keywordsMaxCount: 10,
  keywordsLabel: 'Index Terms',
  referenceSectionRequired: true,
  referenceStyle: 'numeric_brackets',
  referenceStyleNote: 'IEEE numeric brackets [1], [2] ordered by appearance. Author names in first-last format.',
  tone: 'formal academic',
  pageRange: { min: 4, max: 6 },
  notes: 'Keywords are labeled "Index Terms" in IEEE style. Abstract must not exceed 250 words. References use numbered brackets ordered by citation. Typical conference paper is 4–6 pages.'
};

module.exports = ieeeProfile;
