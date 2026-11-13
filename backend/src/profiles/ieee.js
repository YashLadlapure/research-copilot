// IEEE conference proceedings (two-column template). Page limits vary by
// conference; six pages is the common default.
module.exports = {
  key: 'ieee',
  name: 'IEEE Conference',
  requiredSections: ['title', 'abstract', 'keywords', 'introduction', 'conclusion', 'references'],
  abstract: { minWords: 150, maxWords: 250 },
  keywords: { min: 3, max: 10, label: 'Index Terms' },
  headings: {
    numbering: 'roman',
    example: 'I. INTRODUCTION, then A. Subsection',
    maxNumberedDepth: null,
  },
  captions: {
    figure: { pattern: /^Fig\.\s?\d+\./, example: 'Fig. 1. Overview of the pipeline.' },
    table: { pattern: /^TABLE\s?[IVXLC]+\b/, example: 'TABLE I, with the title on the next line' },
  },
  references: {
    example:
      '[1] A. Author and B. Author, "Title of paper," in Proc. Conf. Name, City, Country, 2024, pp. 1–10.',
  },
  pages: { max: 6, wordsPerPage: 850 },
  manualChecks: [
    {
      title: 'Official template',
      rule: 'Use the IEEE conference template (US Letter or A4) unchanged. Do not adjust margins, column widths or spacing.',
    },
    {
      title: 'Title and abstract',
      rule: 'No symbols, special characters, footnotes or math in the paper title or abstract.',
    },
    {
      title: 'Caption placement',
      rule: 'Figure captions go below the figure. Table headings go above the table and use Roman numerals (TABLE I).',
    },
    {
      title: 'Figures and columns',
      rule: 'Figures and tables fit within one column unless they deliberately span both.',
    },
    {
      title: 'Equations',
      rule: 'Equations are numbered consecutively in parentheses flush with the right margin.',
    },
    {
      title: 'Abbreviations',
      rule: 'Abbreviations are defined the first time they appear in the text, even if already defined in the abstract.',
    },
    {
      title: 'Reference list',
      rule: 'References are numbered in order of first citation and cited by number in square brackets, e.g. [3].',
    },
    {
      title: 'Page furniture',
      rule: 'No page numbers, headers or footers unless the conference asks for them.',
    },
  ],
};
