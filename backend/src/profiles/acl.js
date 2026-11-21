// *ACL conferences (ACL, EMNLP, NAACL and others using the ACL style files).
// Values follow the ACLPUB formatting guidelines for long papers.
module.exports = {
  key: 'acl',
  name: 'ACL',
  // ACL requires a section titled "Limitations". Keywords are not used.
  requiredSections: ['title', 'abstract', 'introduction', 'limitations', 'references'],
  citations: 'author-year',
  abstract: { minWords: null, maxWords: 200 },
  keywords: null,
  headings: {
    numbering: 'arabic',
    example: '1 Introduction, 6.1 File Format',
    maxNumberedDepth: null,
  },
  captions: {
    figure: { pattern: /^Figure\s?\d+:/, example: 'Figure 1: Caption of the figure.' },
    table: { pattern: /^Table\s?\d+:/, example: 'Table 1: Caption of the table.' },
  },
  references: {
    example: 'Dan Gusfield. 1997. Algorithms on Strings, Trees and Sequences. Cambridge University Press, Cambridge, UK.',
  },
  // Long papers: eight pages of content. References, Limitations and
  // Ethical Considerations do not count.
  pages: {
    max: 8,
    wordsPerPage: 750,
    excludedSections: ['references', 'limitations', 'ethical considerations', 'ethics statement', 'acknowledgements'],
  },
  manualChecks: [
    {
      title: 'Official template',
      rule: 'Use the ACL style files: two columns, A4 paper, Times Roman 11 pt for body text.',
    },
    {
      title: 'Page limits',
      rule: 'Long papers have up to 8 pages of content for review (9 in the final version); short papers 4 (5 final). References are unlimited.',
    },
    {
      title: 'Limitations section',
      rule: 'Put "Limitations" after the conclusion and before the references. It may not contain new experiments, figures or analysis.',
    },
    {
      title: 'Reference list',
      rule: 'References are alphabetical by first author, with full author names, and include DOIs where possible (otherwise ACL Anthology links).',
    },
    {
      title: 'Caption placement',
      rule: 'Captions go below figures and tables. One-line captions are centred; longer ones are left-aligned.',
    },
    {
      title: 'Review version',
      rule: 'The review version prints line numbers and leaves out the acknowledgments. Appendices follow the same anonymity rules as the paper.',
    },
    {
      title: 'Appendices',
      rule: 'Appendices come after the references and are lettered: "Appendix A. Title".',
    },
    {
      title: 'Abstract',
      rule: 'The abstract is plain text with no markup or LaTeX commands.',
    },
  ],
};
