export function tourSeen(key) {
  try {
    return localStorage.getItem(key) === 'done';
  } catch {
    return false;
  }
}

export function rememberTour(key) {
  try {
    localStorage.setItem(key, 'done');
  } catch {
    // Private windows can refuse storage. The tour then shows again next time.
  }
}

// Each step points at an element by CSS selector. A step whose element is not
// on screen (for example no issue is marked) is skipped.

export const START_TOUR = {
  key: 'research-copilot-tour-start',
  steps: [
    {
      target: '[data-tour="composer"]',
      title: 'Add your paper',
      body: 'Paste the full text here, starting with the title. You can also drop a PDF anywhere on this box.',
    },
    {
      target: '[data-tour="format"]',
      title: 'Pick the target format',
      body: 'Springer LNCS, IEEE, ACM or ACL. The same paper is checked against that format’s rules. You can switch later without pasting again.',
    },
    {
      target: '[data-tour="pdf"]',
      title: 'Or upload a PDF',
      body: 'The text is pulled out of the file and shown in the box so you can check it before running the checks. Scanned PDFs are not supported.',
    },
    {
      target: '[data-tour="check"]',
      title: 'Run the checks',
      body: 'Formatting problems are found by fixed rules, not guessed by an AI. Nothing in your paper is changed.',
    },
    {
      target: '[data-tour="sample"]',
      title: 'No paper to hand?',
      body: 'This loads a made-up paper with deliberate mistakes and checks it straight away. It is the fastest way to see everything.',
    },
  ],
};

export const REPORT_TOUR = {
  key: 'research-copilot-tour-report',
  steps: [
    {
      target: '.summary',
      title: 'Your score',
      body: 'It starts at 100 and loses 20 for each critical issue and 5 for each issue to review. Layout is not scored, because it cannot be read from text.',
    },
    {
      target: '.mark',
      title: 'Problems are marked in the text',
      body: 'Underlined phrases are where a rule failed. Point at one to light up its note, or click it to jump there.',
    },
    {
      target: '.note',
      title: 'Notes explain each issue',
      body: 'Each note says what is wrong and how to fix it. Wording problems have a Refine button: Gemini proposes a rewrite as tracked changes, and you accept or discard it. Other issues need your own edit, so you can Mark as done.',
    },
    {
      target: '.report > .tabs',
      title: 'Other views',
      body: 'Checks lists every automated rule with pass or fail. Manual checklist covers layout rules. Revisions keeps the text you accepted, ready to copy back into your document.',
    },
    {
      target: '.toolbar .switch',
      title: 'Try the other format',
      body: 'Switching re-scores the same paper straight away, with no new upload.',
    },
    {
      target: '[data-tour="print"]',
      title: 'Save the report',
      body: 'Opens your browser’s print dialog. Choose Save as PDF to keep the report with any revisions you accepted.',
    },
  ],
};
