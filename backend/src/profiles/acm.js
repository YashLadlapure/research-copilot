// ACM conference proceedings (acmart class, sigconf format). The values follow
// the acmart user guide. ACM sets no abstract length or page limit of its
// own; each conference states those in its call for papers.
module.exports = {
  key: 'acm',
  name: 'ACM Conference',
  // CCS concepts and keywords are required for papers over two pages.
  requiredSections: ['title', 'abstract', 'keywords', 'introduction', 'references'],
  // Numeric citations are the acmart default for most formats.
  citations: 'numeric',
  abstract: { minWords: null, maxWords: null },
  keywords: { min: null, max: null, label: 'Keywords' },
  headings: {
    numbering: 'arabic',
    example: '1 Introduction, 1.1 Background',
    maxNumberedDepth: 3,
  },
  // sigconf sets captions with a colon after the label.
  captions: {
    figure: { pattern: /^Figure\s?\d+:/, example: 'Figure 1: Overview of the pipeline.' },
    table: { pattern: /^Table\s?\d+:/, example: 'Table 1: Dataset statistics.' },
  },
  references: {
    example:
      '[1] Ana Author and Ben Author. 2024. Title of Paper. In Proceedings of the Conference (CONF \'24). ACM, New York, NY, USA, 1–10. https://doi.org/10.1145/...',
  },
  pages: { max: null, wordsPerPage: null },
  manualChecks: [
    {
      title: 'Official template',
      rule: 'Use the acmart class with the sigconf format (or the ACM Word template) unchanged.',
    },
    {
      title: 'CCS concepts',
      rule: 'Papers over two pages need CCS concepts chosen with the ACM tool at dl.acm.org/ccs, given both as CCSXML and \\ccsdesc commands.',
    },
    {
      title: 'ACM Reference Format',
      rule: 'Papers over one page print the ACM Reference Format block on the first page. Keep it on (printacmref).',
    },
    {
      title: 'Caption placement',
      rule: 'Figure captions are entered after the figure body and table captions before the table body, so table captions sit above tables.',
    },
    {
      title: 'Figure descriptions',
      rule: 'Every figure carries a \\Description with a text alternative for readers who cannot see the image.',
    },
    {
      title: 'Acknowledgments',
      rule: 'Put thanks in the acks environment, which is left out in anonymous mode for review.',
    },
    {
      title: 'Bibliography style',
      rule: 'Use the ACM-Reference-Format BibTeX style. Other styles are not recommended and can delay processing.',
    },
    {
      title: 'Length',
      rule: 'Page limits and abstract length are set by each conference. Check the call for papers.',
    },
  ],
};
