const lncsProfile = {
  name: 'Springer LNCS',
  key: 'lncs',
  requiredSections: ['title', 'abstract', 'keywords', 'introduction', 'conclusion', 'references'],
  optionalSections: ['related work', 'background', 'methodology', 'results', 'discussion', 'future work'],
  abstractMinWords: 70,
  abstractMaxWords: 150,
  keywordsRequired: true,
  keywordsMinCount: 4,
  keywordsMaxCount: 6,
  referenceSectionRequired: true,
  referenceStyle: 'numeric',
  tone: 'formal academic',
  notes: 'Abstract should be a single paragraph. Keywords must appear after the abstract. References use numeric style in square brackets.'
};

module.exports = lncsProfile;
