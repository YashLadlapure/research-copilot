const ieeeProfile = {
  name: 'IEEE Conference',
  key: 'ieee',
  requiredSections: ['title', 'abstract', 'keywords', 'introduction', 'conclusion', 'references'],
  optionalSections: ['related work', 'background', 'methodology', 'results', 'discussion', 'future work'],
  abstractMinWords: 100,
  abstractMaxWords: 250,
  keywordsRequired: true,
  keywordsMinCount: 3,
  keywordsMaxCount: 10,
  referenceSectionRequired: true,
  referenceStyle: 'numeric_brackets',
  tone: 'formal academic',
  notes: 'Keywords are labeled as Index Terms in IEEE. Abstract must not exceed 250 words. References use numbered brackets [1], [2] style.'
};

module.exports = ieeeProfile;
