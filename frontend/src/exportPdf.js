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

// Estimate how tall a warning card will be before drawing it
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

  // card background — alternate light amber tint
  const bgColor = index % 2 === 0 ? [255, 251, 235] : [255, 255, 255];
  doc.setFillColor(...bgColor);
  doc.setDrawColor(220, 180, 60);
  doc.roundedRect(MARGIN, y, TEXT_W, cardH, 2, 2, 'FD');

  // index badge
  doc.setFillColor(160, 110, 10);
  doc.roundedRect(MARGIN + 4, y + cardPad - 2, 7, 5.5, 1, 1, 'F');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(String(index + 1), MARGIN + 5.6, y + cardPad + 1.8);

  // title
  let cy = y + cardPad + 1;
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 60, 0);
  titleLines.forEach(line => {
    doc.text(line, MARGIN + 14, cy);
    cy += LINE_H;
  });

  cy += 2;

  // rule text — indented, lighter
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 60, 20);
  ruleLines.forEach(line => {
    doc.text(line, MARGIN + cardPad + 8, cy);
    cy += LINE_H;
  });

  return y + cardH + 4;
}

export function generateRevisionPdf(exportText, revisedSections, profile, score, manualWarnings = []) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const profileLabel = profile === 'lncs' ? 'Springer LNCS' : 'IEEE Conference';
  const tips = PUBLICATION_TIPS[profile] || PUBLICATION_TIPS.lncs;
  const revisions = Object.entries(revisedSections || {});
  const date = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  let y = MARGIN;

  // ── Header ────────────────────────────────────────────────────────────────
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

  // ── Section 1: Changes made by Gemini ─────────────────────────────────────
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

  // ── Section 2: Publication tips ───────────────────────────────────────────
  if (y > PAGE_H - 80) { doc.addPage(); y = MARGIN + 6; }
  y += 4;
  y = writeLine(doc, `2. How to improve your chances of publishing in ${profileLabel}`, MARGIN, y, { size: 13, bold: true, color: [15, 15, 20] });
  y += 2;
  tips.forEach((tip, i) => {
    if (y > PAGE_H - 20) { doc.addPage(); y = MARGIN + 6; }
    y = writeWrapped(doc, `${i + 1}.  ${tip}`, MARGIN, y, TEXT_W, { size: 10, color: [30, 30, 30] });
    y += 2;
  });

  // ── Section 3: Manual layout warnings ────────────────────────────────────
  if (manualWarnings.length > 0) {
    if (y > PAGE_H - 60) { doc.addPage(); y = MARGIN + 6; }
    y += 6;
    y = drawDivider(doc, y);
    y += 2;

    // Section header bar
    doc.setFillColor(120, 80, 10);
    doc.roundedRect(MARGIN, y, TEXT_W, 11, 2, 2, 'F');
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 220, 100);
    doc.text('3. Warnings (Manual Check Required)', MARGIN + 4, y + 7.5);
    y += 15;

    // Subtitle
    y = writeWrapped(
      doc,
      `These layout rules cannot be verified from extracted text. Check each item manually in your ${profileLabel} DOCX/LaTeX template before final submission.`,
      MARGIN, y, TEXT_W,
      { size: 8.5, color: [100, 100, 100] }
    );
    y += 5;

    // One card per warning
    manualWarnings.forEach((warning, i) => {
      const estH = estimateWarningHeight(doc, warning);
      if (y + estH > PAGE_H - MARGIN) { doc.addPage(); y = MARGIN + 6; }
      y = drawWarningCard(doc, warning, i, y);
    });
  }

  // ── Footer ────────────────────────────────────────────────────────────────
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
