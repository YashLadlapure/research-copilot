import jsPDF from 'jspdf';

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 18;
const TEXT_W = PAGE_W - MARGIN * 2;
const LINE_H = 6.5;

const PUBLICATION_TIPS = {
  lncs: [
    'Abstract must be between 70–150 words — this is a hard limit for Springer LNCS.',
    'Use exactly 4–6 keywords; avoid generic terms like "deep learning" alone.',
    'Springer LNCS requires numbered sections (1 Introduction, 2 Methodology…).',
    'Figures and tables must have captions and be cross-referenced in the text.',
    'References must follow LNCS numbered style [1], [2], [3].',
    'Avoid footnotes — LNCS discourages them; fold content into body text.',
    'Paper length is typically 12–15 pages including references.',
    'Author affiliations must include institution, city, country, and email.',
  ],
  ieee: [
    'Abstract must be 150–250 words — IEEE requires a structured summary.',
    'Use 4–6 Index Terms from the IEEE Thesaurus for discoverability.',
    'Two-column layout is required; ensure figures fit within a single column.',
    'IEEE style uses numbered references in order of appearance [1], [2].',
    'Conclusion section must not introduce new results or claims.',
    'Spell out acronyms on first use, even common ones like CNN or LSTM.',
    'Page limit is typically 4–6 pages for conference; check CFP for exact limit.',
    'Authors should declare funding/conflict of interest in acknowledgements.',
  ],
};

const REFERENCE_GUIDE = {
  lncs: [
    'Format: [1] Author, A., Author, B.: Title of paper. In: Conference Name, pp. xx–xx. Publisher, City (Year)',
    'Format: [2] Author, A.: Title of Book. Publisher, City (Year)',
    'Format: [3] Author, A., Author, B.: Article title. Journal Name vol(issue), pp. xx–xx (Year)',
    'List references in order of citation in the text — [1] first, [2] second, etc.',
    'Use LNCS abbreviation style for conference names (e.g., LNCS, LNAI).',
    'Do not include URLs unless strictly necessary; prefer DOI.',
    'All references must be cited in the text body.',
  ],
  ieee: [
    'Format: [1] A. Author and B. Author, "Title of paper," in Proc. Conf. Name, City, Year, pp. xx–xx.',
    'Format: [2] A. Author, "Article title," Journal Name, vol. x, no. x, pp. xx–xx, Month Year.',
    'Format: [3] A. Author, Title of Book. City: Publisher, Year.',
    'Number references in order of first appearance in the text [1], [2], [3]…',
    'Use abbreviated journal and conference names per IEEE style.',
    'Include DOI where available: doi: 10.xxxx/xxxxx',
    'All references must be cited at least once in the body text.',
  ],
};

const PAGE_LIMIT_GUIDE = {
  lncs: [
    'Springer LNCS typical page limit: 12–15 pages including references.',
    'Check your specific Call for Papers — some venues cap at 10 or 16 pages.',
    'Remove redundant content: shorten related work, trim experimental tables.',
    'Merge short sections (e.g., fold a 1-paragraph Future Work into Conclusion).',
    'Reduce figure whitespace and tighten caption wording.',
    'Appendices may not count toward page limit — verify with the venue.',
  ],
  ieee: [
    'IEEE conference typical page limit: 4–6 pages; check your specific CFP.',
    'Over-length pages may incur a fee (usually $200/page) — check CFP policy.',
    'Shorten abstract to ~150 words and remove self-evident content.',
    'Use the official IEEE two-column template — do not adjust margins.',
    'Combine related figures into subfigure layouts to save space.',
    'Move implementation details to a technical report linked via URL if needed.',
  ],
};

function writeLine(doc, text, x, y, opts = {}) {
  const { size = 10, bold = false, color = [30, 30, 30] } = opts;
  doc.setFontSize(size);
  doc.setFont('helvetica', bold ? 'bold' : 'normal');
  doc.setTextColor(...color);
  doc.text(text, x, y);
  return y + LINE_H;
}

function writeWrapped(doc, text, x, y, maxW, opts = {}) {
  const { size = 10, bold = false, color = [30, 30, 30] } = opts;
  doc.setFontSize(size);
  doc.setFont('helvetica', bold ? 'bold' : 'normal');
  doc.setTextColor(...color);
  const lines = doc.splitTextToSize(String(text || ''), maxW);
  lines.forEach(line => {
    if (y > PAGE_H - MARGIN - 10) { doc.addPage(); y = MARGIN + 10; }
    doc.text(line, x, y);
    y += LINE_H;
  });
  return y;
}

function drawDivider(doc, y) {
  doc.setDrawColor(200, 200, 200);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  return y + 5;
}

function estimateWarningHeight(doc, warning) {
  const titleLines = doc.splitTextToSize(warning.title, TEXT_W - 10);
  const ruleLines = doc.splitTextToSize(warning.rule, TEXT_W - 14);
  return 6 + titleLines.length * LINE_H + 3 + ruleLines.length * LINE_H + 6;
}

function drawWarningCard(doc, warning, index, y) {
  const cardPad = 5;
  const innerW = TEXT_W - cardPad * 2;

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  const titleLines = doc.splitTextToSize(warning.title, innerW);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  const ruleLines = doc.splitTextToSize(warning.rule, innerW - 6);

  const cardH = cardPad + titleLines.length * LINE_H + 3 + ruleLines.length * LINE_H + cardPad;

  const bgColor = index % 2 === 0 ? [255, 251, 235] : [255, 255, 255];
  doc.setFillColor(...bgColor);
  doc.setDrawColor(220, 180, 60);
  doc.roundedRect(MARGIN, y, TEXT_W, cardH, 2, 2, 'FD');

  doc.setFillColor(160, 110, 10);
  doc.roundedRect(MARGIN + 4, y + cardPad - 2, 7, 5.5, 1, 1, 'F');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(String(index + 1), MARGIN + 5.6, y + cardPad + 1.8);

  let cy = y + cardPad + 1;
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 60, 0);
  titleLines.forEach(line => {
    doc.text(line, MARGIN + 14, cy);
    cy += LINE_H;
  });

  cy += 2;

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 60, 20);
  ruleLines.forEach(line => {
    doc.text(line, MARGIN + cardPad + 8, cy);
    cy += LINE_H;
  });

  return y + cardH + 4;
}

function drawManualIssueSection(doc, issues, profile, sectionNum, y) {
  const profileLabel = profile === 'lncs' ? 'Springer LNCS' : 'IEEE Conference';

  if (y > PAGE_H - 60) { doc.addPage(); y = MARGIN + 6; }
  y += 6;
  y = drawDivider(doc, y);
  y += 2;

  doc.setFillColor(180, 30, 30);
  doc.roundedRect(MARGIN, y, TEXT_W, 11, 2, 2, 'F');
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 220, 220);
  doc.text(`${sectionNum}. Issues Requiring Manual Fix`, MARGIN + 4, y + 7.5);
  y += 15;

  y = writeWrapped(
    doc,
    `These issues were detected by the compliance engine but cannot be auto-corrected. Fix each one directly in your ${profileLabel} manuscript before submission.`,
    MARGIN, y, TEXT_W,
    { size: 8.5, color: [100, 100, 100] }
  );
  y += 4;

  issues.forEach((issue, i) => {
    if (y > PAGE_H - MARGIN - 40) { doc.addPage(); y = MARGIN + 6; }

    const sec = (issue.section || '').toLowerCase();
    const isRef = sec === 'references' || sec === 'bibliography';
    const isPage = issue.manualOnly && (issue.problem || '').toLowerCase().includes('page');

    // Issue card
    const bg = i % 2 === 0 ? [255, 242, 242] : [255, 255, 255];
    doc.setFillColor(...bg);
    doc.setDrawColor(200, 60, 60);

    // Estimate card height first
    const problemLines = doc.splitTextToSize(issue.problem || '', TEXT_W - 20);
    const actionLines = issue.recommended_action
      ? doc.splitTextToSize(issue.recommended_action, TEXT_W - 20)
      : [];
    const cardH = 8 + problemLines.length * LINE_H + (actionLines.length ? 4 + actionLines.length * LINE_H : 0) + 6;
    doc.roundedRect(MARGIN, y, TEXT_W, cardH, 2, 2, 'FD');

    // Severity badge
    const badgeColor = issue.severity === 'Critical' ? [180, 30, 30] : [180, 120, 0];
    doc.setFillColor(...badgeColor);
    doc.roundedRect(MARGIN + 4, y + 3, 18, 5, 1, 1, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(issue.severity || 'Review', MARGIN + 5, y + 7);

    // Section label
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(120, 30, 30);
    doc.text((issue.section || 'General').toUpperCase(), MARGIN + 26, y + 7);

    let cy = y + 10;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(60, 20, 20);
    problemLines.forEach(line => { doc.text(line, MARGIN + 6, cy); cy += LINE_H; });

    if (actionLines.length) {
      cy += 2;
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 40, 40);
      actionLines.forEach(line => { doc.text(line, MARGIN + 6, cy); cy += LINE_H; });
    }

    y += cardH + 4;

    // Inline fix guide for references or page count
    if (isRef) {
      const guide = REFERENCE_GUIDE[profile] || REFERENCE_GUIDE.lncs;
      if (y > PAGE_H - MARGIN - 60) { doc.addPage(); y = MARGIN + 6; }
      y = writeWrapped(doc, `How to fix ${profileLabel} references:`, MARGIN, y, TEXT_W, { size: 9, bold: true, color: [30, 30, 30] });
      guide.forEach((line, gi) => {
        if (y > PAGE_H - MARGIN - 10) { doc.addPage(); y = MARGIN + 6; }
        y = writeWrapped(doc, `  ${gi + 1}.  ${line}`, MARGIN, y, TEXT_W, { size: 8.5, color: [40, 40, 40] });
        y += 1;
      });
      y += 4;
    }

    if (isPage) {
      const guide = PAGE_LIMIT_GUIDE[profile] || PAGE_LIMIT_GUIDE.lncs;
      if (y > PAGE_H - MARGIN - 60) { doc.addPage(); y = MARGIN + 6; }
      y = writeWrapped(doc, `How to fix page count for ${profileLabel}:`, MARGIN, y, TEXT_W, { size: 9, bold: true, color: [30, 30, 30] });
      guide.forEach((line, gi) => {
        if (y > PAGE_H - MARGIN - 10) { doc.addPage(); y = MARGIN + 6; }
        y = writeWrapped(doc, `  ${gi + 1}.  ${line}`, MARGIN, y, TEXT_W, { size: 8.5, color: [40, 40, 40] });
        y += 1;
      });
      y += 4;
    }
  });

  return y;
}

export function generateRevisionPdf(exportText, revisedSections, profile, score, manualWarnings = [], manualIssues = []) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const profileLabel = profile === 'lncs' ? 'Springer LNCS' : 'IEEE Conference';
  const tips = PUBLICATION_TIPS[profile] || PUBLICATION_TIPS.lncs;
  const revisions = Object.entries(revisedSections || {});
  const date = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  let y = MARGIN;

  // Header
  doc.setFillColor(15, 15, 20);
  doc.rect(0, 0, PAGE_W, 38, 'F');
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('Research Copilot', MARGIN, 16);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(180, 180, 180);
  doc.text(`Revision Report  ·  ${profileLabel}  ·  ${date}`, MARGIN, 24);
  doc.text(`Compliance score at export: ${score || '—'}%`, MARGIN, 31);
  y = 48;

  // Section 1: Gemini changes
  y = writeLine(doc, '1. Changes made by Gemini', MARGIN, y, { size: 13, bold: true, color: [15, 15, 20] });
  y += 2;

  if (revisions.length === 0) {
    y = writeWrapped(doc, 'No revisions were applied in this session.', MARGIN, y, TEXT_W, { color: [100, 100, 100] });
  } else {
    const whyMap = {};
    if (exportText) {
      exportText.split(/\[\d+\]/).forEach(block => {
        const secMatch = block.match(/^\s*([A-Z]+)/);
        const whyMatch = block.match(/WHY:\s*(.+)/);
        if (secMatch && whyMatch) whyMap[secMatch[1].toLowerCase()] = whyMatch[1].trim();
      });
    }

    revisions.forEach(([section, revisedText]) => {
      if (y > PAGE_H - 60) { doc.addPage(); y = MARGIN + 6; }
      doc.setFillColor(30, 30, 40);
      doc.roundedRect(MARGIN, y - 4, 36, 7, 2, 2, 'F');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(160, 220, 160);
      doc.text(section.toUpperCase(), MARGIN + 3, y + 1);
      y += 8;
      const why = whyMap[section.toLowerCase()] || 'Revised for improved publication compliance and academic clarity.';
      y = writeWrapped(doc, `Why: ${why}`, MARGIN, y, TEXT_W, { size: 9, color: [60, 100, 60] });
      y += 2;
      y = writeWrapped(doc, 'Revised text:', MARGIN, y, TEXT_W, { size: 9, bold: true, color: [40, 40, 40] });
      const preview = revisedText.slice(0, 500) + (revisedText.length > 500 ? '…' : '');
      y = writeWrapped(doc, preview, MARGIN + 3, y, TEXT_W - 3, { size: 9, color: [40, 40, 40] });
      y += 4;
      y = drawDivider(doc, y);
      y += 2;
    });
  }

  // Section 2: Manual issues that need fixing
  if (manualIssues.length > 0) {
    y = drawManualIssueSection(doc, manualIssues, profile, 2, y);
    y += 4;
  }

  // Section 3 (or 2 if no manual issues): Publication tips
  const tipsSectionNum = manualIssues.length > 0 ? 3 : 2;
  if (y > PAGE_H - 80) { doc.addPage(); y = MARGIN + 6; }
  y += 4;
  y = writeLine(doc, `${tipsSectionNum}. How to improve your chances of publishing in ${profileLabel}`, MARGIN, y, { size: 13, bold: true, color: [15, 15, 20] });
  y += 2;
  tips.forEach((tip, i) => {
    if (y > PAGE_H - 20) { doc.addPage(); y = MARGIN + 6; }
    y = writeWrapped(doc, `${i + 1}.  ${tip}`, MARGIN, y, TEXT_W, { size: 10, color: [30, 30, 30] });
    y += 2;
  });

  // Layout warnings section
  if (manualWarnings.length > 0) {
    const warningSectionNum = tipsSectionNum + 1;
    if (y > PAGE_H - 60) { doc.addPage(); y = MARGIN + 6; }
    y += 6;
    y = drawDivider(doc, y);
    y += 2;

    doc.setFillColor(120, 80, 10);
    doc.roundedRect(MARGIN, y, TEXT_W, 11, 2, 2, 'F');
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 220, 100);
    doc.text(`${warningSectionNum}. Layout Warnings (Manual Check Required)`, MARGIN + 4, y + 7.5);
    y += 15;

    y = writeWrapped(
      doc,
      `These layout rules cannot be verified from extracted text. Check each item manually in your ${profileLabel} DOCX/LaTeX template before final submission.`,
      MARGIN, y, TEXT_W,
      { size: 8.5, color: [100, 100, 100] }
    );
    y += 5;

    manualWarnings.forEach((warning, i) => {
      const estH = estimateWarningHeight(doc, warning);
      if (y + estH > PAGE_H - MARGIN) { doc.addPage(); y = MARGIN + 6; }
      y = drawWarningCard(doc, warning, i, y);
    });
  }

  // Footer
  y += 8;
  if (y > PAGE_H - 24) { doc.addPage(); y = MARGIN + 6; }
  drawDivider(doc, y);
  y += 6;
  writeWrapped(
    doc,
    'This report was generated by Research Copilot. AI was used only for language refinement — all changes were reviewed and accepted by the author. Final editorial responsibility remains with the authors.',
    MARGIN, y, TEXT_W,
    { size: 8, color: [120, 120, 120] }
  );

  doc.save('revision-report.pdf');
}
