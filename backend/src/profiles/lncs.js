// Springer LNCS proceedings. Limits follow Springer's author guidelines for
// computer science proceedings; individual conferences can be stricter.
module.exports = {
  key: 'lncs',
  name: 'Springer LNCS',
  requiredSections: ['title', 'abstract', 'keywords', 'introduction', 'conclusion', 'references'],
  abstract: { minWords: 150, maxWords: 250 },
  keywords: { min: 4, max: 6, label: 'Keywords' },
  headings: {
    numbering: 'arabic',
    example: '1 Introduction, 1.1 Background',
    maxNumberedDepth: 2,
  },
  captions: {
    figure: { pattern: /^Fig\.\s?\d+\./, example: 'Fig. 1. Overview of the pipeline.' },
    table: { pattern: /^Table\s?\d+\./, example: 'Table 1. Dataset statistics.' },
  },
  references: {
    example:
      '1. Author, A., Author, B.: Title of paper. In: Editor, E. (ed.) CONF 2024. LNCS, vol. 1234, pp. 1–13. Springer, Cham (2024)',
  },
  pages: { max: 15, wordsPerPage: 400 },
  manualChecks: [
    {
      title: 'Official template',
      rule: 'Use llncs.cls or the Springer Word template unchanged. Do not adjust margins, fonts, line spacing or the text area.',
    },
    {
      title: 'Heading capitalisation',
      rule: 'Headings are capitalised: nouns, verbs and all other words except articles, prepositions and conjunctions start with a capital letter.',
    },
    {
      title: 'Lower-level headings',
      rule: 'Only the first two heading levels are numbered. Third- and fourth-level headings are unnumbered run-in headings.',
    },
    {
      title: 'Caption placement',
      rule: 'Figure captions go below the figure, table captions above the table. Every figure and table is referred to in the text.',
    },
    {
      title: 'Equations',
      rule: 'Displayed equations are centred and numbered consecutively in parentheses at the right margin.',
    },
    {
      title: 'Figures',
      rule: 'Line art is embedded as vector graphics and stays legible when printed in black and white.',
    },
    {
      title: 'Reference list',
      rule: 'Every reference is cited in the text, and the list is numbered in the order used by the template bibliography style.',
    },
    {
      title: 'Author block',
      rule: 'Each author has a full affiliation (institution, city, country) and the corresponding author an e-mail address, unless the venue is double-blind.',
    },
  ],
};
