// ─── helpers ─────────────────────────────────────────────────────────────────

function wordCount(text) {
  return text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
}

function detectCitationStyle(fullText) {
  const numbered = (fullText.match(/\[\d+\]/g) || []).length;
  const authorYear = (fullText.match(/\([A-Z][a-z]+,?\s+\d{4}\)/g) || []).length;
  return { numbered, authorYear };
}

function checkFigureCaptions(fullText, profile) {
  const hasFigures = /fig(ure)?\.?\s*\d+/i.test(fullText);
  if (!hasFigures) return { hasFigures: false };
  const lncsCount = (fullText.match(/Fig\.\s*\d+\.\s+\w/g) || []).length;
  const ieeeCount = (fullText.match(/Fig\.\s*\d+[.:]/g) || []).length;
  return { hasFigures: true, lncsCount, ieeeCount };
}

function checkTableCaptions(fullText) {
  const hasTables = /table\s*\d+/i.test(fullText);
  if (!hasTables) return { hasTables: false };
  const correctCount = (fullText.match(/Table\s+\d+\.\s+\w/g) || []).length;
  return { hasTables: true, correctCount };
}

function checkReferenceListStyle(refText) {
  if (!refText) return { style: 'unknown' };
  const numbered = /^\s*\[\d+\]/m.test(refText);
  const authorYear = /^\s*[A-Z][a-z]+,\s+[A-Z]/m.test(refText);
  return { style: numbered ? 'numbered' : authorYear ? 'author-year' : 'unknown' };
}

function stripReferencesBlock(text) {
  const refHeading = /\n\s*(?:references|bibliography)\s*\n/i;
  const idx = text.search(refHeading);
  return idx !== -1 ? text.slice(0, idx) : text;
}

function findUndefinedAcronyms(fullText) {
  const bodyText = stripReferencesBlock(fullText);
  const acronyms = [...new Set((bodyText.match(/\b[A-Z]{2,6}\b/g) || []))];
  const common = new Set([
    'AI', 'ML', 'NLP', 'API', 'PDF', 'URL', 'IEEE', 'LNCS', 'IoT',
    'ID', 'UI', 'UX', 'DB', 'OS', 'CPU', 'GPU', 'RAM', 'RDA', 'GPT',
    'DOI', 'ISBN', 'ISSN', 'ACM', 'CRC', 'MIT', 'ETH', 'NSF', 'NIH',
    'RDA', 'NRC', 'WHO', 'UN', 'USA', 'UK', 'EU', 'IN', 'IT',
    'IFCT', 'DHARA', 'AYUSH',
    'SQL', 'CSV', 'JSON', 'XML', 'HTML', 'CSS', 'HTTP', 'REST',
    'GAN', 'CNN', 'RNN', 'LSTM', 'BERT', 'LLM', 'SVM', 'KNN',
  ]);
  return acronyms
    .filter(acr => !common.has(acr) && !new RegExp(`\\(${acr}\\)`).test(bodyText))
    .slice(0, 5);
}

function estimatePages(fullText, profile) {
  const wc = wordCount(fullText);
  return Math.ceil(wc / (profile === 'ieee' ? 500 : 400));
}

function checkCitationPunctuation(fullText) {
  return (fullText.match(/[a-z][\[\(]\d/g) || []).length;
}

function titleEndsWithPeriod(title) {
  return /\.\s*$/.test((title || '').trim());
}

function checkAffiliationCompleteness(fullText) {
  const hasInstitution = /university|institute|college|lab|department|school/i.test(fullText);
  const hasCountry = /india|usa|germany|china|uk|france|canada|australia|japan|italy|spain/i.test(fullText);
  return { hasInstitution, hasCountry, passed: hasInstitution && hasCountry };
}

function checkHeadingDepth(fullText) {
  const level3 = (fullText.match(/^\d+\.\d+\.\d+\s+[A-Z]/m) || []).length;
  const level4 = (fullText.match(/^\d+\.\d+\.\d+\.\d+\s+[A-Z]/m) || []).length;
  return { level3, level4, tooDeep: level4 > 0 };
}

function checkAcknowledgements(fullText) {
  const present = /acknowledgements?\s*\n|acknowledgements?\./i.test(fullText);
  const numbered = /\d+\.?\s+acknowledgements?/i.test(fullText);
  return { present, numbered };
}

function checkEmailPresence(rawText) {
  const emails = rawText.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) || [];
  return { count: emails.length, hasEmail: emails.length > 0 };
}

// ─── manual warnings per profile ─────────────────────────────────────────────

const MANUAL_WARNINGS = {
  lncs: [
    { title: 'Font sizes', rule: 'LNCS requires: Title — 14pt bold; Level-1 headings — 12pt bold; Level-2 headings — 10pt bold; Body text — 10pt; Abstract — 9pt. Verify all font sizes in your DOCX/LaTeX template before final submission.' },
    { title: 'Margins', rule: 'LNCS page margins: Top 4.2 cm, Bottom 4.2 cm, Left 4.2 cm, Right 4.2 cm (A5 paper). Final check must be done in the formatted DOCX or LaTeX template.' },
    { title: 'Paragraph indentation', rule: 'The first paragraph after a section heading must be flush left (no indent). All subsequent paragraphs must have a 0.4 cm (11pt) first-line indent. Blank lines between paragraphs are not permitted — spacing is handled by the template stylesheet.' },
    { title: 'Equation alignment and numbering', rule: 'Displayed equations must be centered on their own line. Equation numbers must be in parentheses, right-aligned to the text column margin. Equations that conclude a sentence should carry a period before the equation number.' },
    { title: 'Caption centering and justification', rule: 'Short captions (single line) must be centered. Long captions (two or more lines) must be fully justified. Table captions must appear ABOVE the table. Figure captions must appear BELOW the figure.' },
    { title: 'Reference hanging indent', rule: 'Each reference entry in the list must have a hanging indent: first line flush left, subsequent lines indented. This is a template-level style and must be verified in the final formatted document.' },
    { title: 'Vector graphics for line art', rule: 'All schematic drawings, charts, and graphs must be embedded as vector graphics (.pdf or .eps). Raster images (.png, .jpg) are not acceptable for line art in LNCS proceedings.' },
    { title: 'Level 3 and Level 4 run-in headings', rule: 'Level-3 headings must be 10pt bold, unnumbered, and run-in — i.e., the heading ends with a period and the paragraph text starts on the same line. Level-4 headings follow the same rule but use 10pt italic.' },
  ],
  ieee: [
    { title: 'Font sizes', rule: 'IEEE requires: Paper title — 24pt; Author names — 11pt; Body text — 10pt Times New Roman; Abstract and Index Terms — 9pt. Verify in the official IEEE conference template.' },
    { title: 'Margins', rule: 'IEEE US Letter margins: Top 0.75in, Bottom 1.69in, Left/Right 0.625in. For A4: Top 19mm, Bottom 43mm, Left/Right 13mm. Never reduce margins below these values.' },
    { title: 'Two-column layout', rule: 'IEEE conference papers use a strict two-column layout. Ensure all figures, tables, and equations fit within a single column unless explicitly spanning both columns using the appropriate template macro.' },
    { title: 'Paragraph indentation', rule: 'Body paragraphs must use a 3.5mm (0.14in) first-line indent. Text must be fully justified (flush left and right). Verify paragraph styles in the IEEE Word or LaTeX template.' },
    { title: 'Equation alignment and numbering', rule: 'Equations must be centered on their own line. Equation numbers must appear in parentheses at the right margin. Equations ending a sentence take a period immediately before the closing parenthesis of the equation number.' },
    { title: 'Caption centering and justification', rule: 'Table captions (TABLE I. format, all caps for TABLE) appear ABOVE the table. Figure captions appear BELOW the figure. Short captions are centered; long captions are justified.' },
    { title: 'Reference hanging indent', rule: 'Each IEEE reference entry must have a hanging indent. The first line is flush left; all subsequent lines are indented. Verify this in the final formatted document.' },
  ],
};

// ─── section tag → nearest real refinable section ────────────────────────────
const SYNTHETIC_SECTION_MAP = {
  language:        'introduction',
  metadata:        'title',
  structure:       'introduction',
  figures:         'methodology',
  tables:          'methodology',
  acknowledgements:'acknowledgements',
};

function resolveSection(rawSection, sectionsDetected) {
  if (!rawSection) return rawSection;
  const lower = rawSection.toLowerCase();
  if (SYNTHETIC_SECTION_MAP[lower]) {
    const preferred = SYNTHETIC_SECTION_MAP[lower];
    const exists = (sectionsDetected || []).some(s => s.toLowerCase() === preferred);
    return exists ? preferred : (sectionsDetected && sectionsDetected[0]) || preferred;
  }
  return rawSection;
}

// ─── main ─────────────────────────────────────────────────────────────────────

function evaluateCompliance(structured, profileConfig) {
  const issues = [];
  const sectionStatus = [];
  const ruleChecks = [];

  const implicitSections = [];
  if (structured.title && structured.title.trim()) implicitSections.push('title');
  if (structured.abstract && structured.abstract.trim()) implicitSections.push('abstract');
  if (Array.isArray(structured.keywords) && structured.keywords.length > 0) implicitSections.push('keywords');
  if (structured.referencesPresent) implicitSections.push('references');

  const allDetected = [
    ...structured.sectionsDetected.map(s => s.toLowerCase()),
    ...implicitSections,
  ];
  const allMissing = structured.sectionsMissing.map(s => s.toLowerCase()).filter(s => !implicitSections.includes(s));

  const sections = structured.sections || {};
  const fullText = Object.values(sections).join('\n') + '\n' + (structured.abstract || '') + '\n' + (structured.title || '');
  const rawText = structured.rawText || fullText;
  const refText = sections['references'] || sections['bibliography'] || '';
  const profile = profileConfig.id || 'lncs';
  const title = structured.title || '';

  function addIssue(issue) {
    issues.push({
      ...issue,
      section: resolveSection(issue.section, structured.sectionsDetected),
    });
  }

  for (const required of profileConfig.requiredSections) {
    const found = allDetected.includes(required.toLowerCase()) && !allMissing.includes(required.toLowerCase());
    ruleChecks.push({ rule: `section_present_${required}`, passed: found, observedValue: found, expected: 'true' });
    if (!found) {
      addIssue({ section: required, severity: 'Critical', problem: `Required section "${required}" was not detected.`, recommended_action: `Add a clearly labeled "${required}" section before submission.` });
      sectionStatus.push({ name: required, status: 'Critical', summary: `"${required}" section is missing.` });
    } else {
      sectionStatus.push({ name: required, status: 'Good', summary: `"${required}" section detected.` });
    }
  }

  const abstractText = structured.abstract || '';
  const abstractWords = wordCount(abstractText);
  const minWords = profileConfig.abstractMinWords;
  const maxWords = profileConfig.abstractMaxWords;
  ruleChecks.push({ rule: 'abstract_word_count', passed: abstractWords >= minWords && abstractWords <= maxWords, observedValue: abstractWords, expected: `${minWords}\u2013${maxWords} words` });
  if (abstractWords === 0) {
    addIssue({ section: 'abstract', severity: 'Critical', problem: 'Abstract is empty or could not be extracted.', recommended_action: 'Ensure the abstract is clearly labeled and contains content.' });
  } else if (abstractWords > maxWords) {
    addIssue({ section: 'abstract', severity: 'Critical', problem: `Abstract is ${abstractWords} words \u2014 exceeds the ${profileConfig.name} limit of ${maxWords} words.`, recommended_action: `Shorten the abstract to ${maxWords} words or fewer.` });
  } else if (abstractWords < minWords) {
    addIssue({ section: 'abstract', severity: 'Review', problem: `Abstract is ${abstractWords} words \u2014 below the ${profileConfig.name} minimum of ${minWords} words.`, recommended_action: `Expand the abstract to at least ${minWords} words.` });
  }

  if (profileConfig.keywordsRequired) {
    const kwCount = Array.isArray(structured.keywords) ? structured.keywords.length : 0;
    const kwOk = kwCount >= profileConfig.keywordsMinCount && kwCount <= profileConfig.keywordsMaxCount;
    const kwLabel = profileConfig.keywordsLabel || 'Keywords';
    ruleChecks.push({ rule: 'keywords_count', passed: kwOk, observedValue: kwCount, expected: `${profileConfig.keywordsMinCount}\u2013${profileConfig.keywordsMaxCount} ${kwLabel}` });
    if (kwCount === 0) {
      addIssue({ section: 'keywords', severity: 'Critical', problem: `No ${kwLabel} detected.`, recommended_action: `Add ${profileConfig.keywordsMinCount}\u2013${profileConfig.keywordsMaxCount} ${kwLabel} directly after the abstract.` });
    } else if (!kwOk) {
      addIssue({ section: 'keywords', severity: 'Review', problem: `${kwCount} ${kwLabel} found. ${profileConfig.name} expects ${profileConfig.keywordsMinCount}\u2013${profileConfig.keywordsMaxCount}.`, recommended_action: `Adjust to ${profileConfig.keywordsMinCount}\u2013${profileConfig.keywordsMaxCount} ${kwLabel}.` });
    }
  }

  if (profileConfig.referenceSectionRequired) {
    ruleChecks.push({ rule: 'references_present', passed: structured.referencesPresent, observedValue: structured.referencesPresent, expected: 'true' });
    if (!structured.referencesPresent) {
      addIssue({ section: 'references', severity: 'Critical', problem: 'No references section detected.', recommended_action: `Add a references section in ${profileConfig.referenceStyle || 'numbered'} style.` });
    }
  }

  const { numbered, authorYear } = detectCitationStyle(fullText);
  if (numbered === 0 && authorYear === 0 && structured.referencesPresent) {
    addIssue({ section: 'references', severity: 'Review', problem: 'No inline citations detected in the manuscript body.', recommended_action: 'Add numbered citations [1] in the body text for every listed reference.' });
  } else if ((profile === 'lncs' || profile === 'ieee') && authorYear > numbered && (numbered + authorYear) > 3) {
    addIssue({ section: 'references', severity: 'Critical', problem: `${profileConfig.name} requires numbered citations [1][2], but author-year style (Author, 2024) was detected.`, recommended_action: 'Switch all inline citations to numbered format [1] and reformat the reference list.' });
  }
  ruleChecks.push({ rule: 'citation_style', passed: authorYear <= numbered, observedValue: `numbered:${numbered} author-year:${authorYear}`, expected: 'numbered' });

  const badPunctCount = checkCitationPunctuation(fullText);
  if (badPunctCount > 2) {
    addIssue({ section: 'references', severity: 'Review', problem: `${badPunctCount} citations appear without a space or punctuation before the bracket (e.g. "word[1]" \u2014 should be "word [1]" or "word.[1]").`, recommended_action: 'Add a space or period before each citation bracket.' });
  }
  ruleChecks.push({ rule: 'citation_punctuation', passed: badPunctCount <= 2, observedValue: badPunctCount, expected: '\u22642' });

  const refStyle = checkReferenceListStyle(refText);
  if (refText && refStyle.style === 'author-year' && (profile === 'lncs' || profile === 'ieee')) {
    addIssue({ section: 'references', severity: 'Critical', problem: `Reference list uses author-year format. ${profileConfig.name} requires numbered references: [1] Author, Title, Venue, Year.`, recommended_action: `Reformat all references to numbered style as required by ${profileConfig.name}.` });
  }
  ruleChecks.push({ rule: 'reference_list_style', passed: refStyle.style !== 'author-year', observedValue: refStyle.style, expected: 'numbered' });

  const titleHasPeriod = titleEndsWithPeriod(title);
  ruleChecks.push({ rule: 'title_no_trailing_period', passed: !titleHasPeriod, observedValue: titleHasPeriod ? 'ends with period' : 'ok', expected: 'no trailing period' });
  if (title && titleHasPeriod) {
    addIssue({ section: 'title', severity: 'Critical', problem: 'The paper title must not end with a period.', recommended_action: 'Remove the trailing period from the paper title.' });
  }

  const affiliation = checkAffiliationCompleteness(rawText);
  ruleChecks.push({ rule: 'affiliation_completeness', passed: affiliation.passed, observedValue: JSON.stringify(affiliation), expected: 'institution + country' });
  if (!affiliation.passed) {
    addIssue({ section: 'metadata', severity: 'Review', problem: `Author affiliation appears incomplete. ${profileConfig.name} requires institution name, town/city, and country for every author.`, recommended_action: 'Add full affiliation including Department, University, City, and Country for each author.' });
  }

  const emailCheck = checkEmailPresence(rawText);
  ruleChecks.push({ rule: 'email_present', passed: emailCheck.hasEmail, observedValue: `${emailCheck.count} email(s)`, expected: '\u22651 email' });
  if (!emailCheck.hasEmail) {
    addIssue({ section: 'metadata', severity: 'Review', problem: 'No author email address detected.', recommended_action: `${profileConfig.name} requires at least the corresponding author\u2019s email address to be listed under the affiliation.` });
  }

  const headingDepth = checkHeadingDepth(fullText);
  ruleChecks.push({ rule: 'heading_depth', passed: !headingDepth.tooDeep, observedValue: headingDepth.level4 > 0 ? 'Level 4+ detected' : 'ok', expected: 'max 3 numbered levels' });
  if (headingDepth.tooDeep) {
    addIssue({ section: 'structure', severity: 'Review', problem: 'Heading depth exceeds the recommended maximum. LNCS and IEEE allow a maximum of 3 numbered heading levels.', recommended_action: 'Reduce heading depth to 3 levels or fewer. Use run-in headings for Level 3 and Level 4.' });
  }

  const ackCheck = checkAcknowledgements(fullText);
  if (ackCheck.present && ackCheck.numbered) {
    addIssue({ section: 'acknowledgements', severity: 'Review', problem: 'Acknowledgements section appears to be numbered. LNCS requires the Acknowledgements section to be unnumbered.', recommended_action: 'Remove the section number from the Acknowledgements heading.' });
    ruleChecks.push({ rule: 'acknowledgements_unnumbered', passed: false, observedValue: 'numbered', expected: 'unnumbered' });
  }

  const figCheck = checkFigureCaptions(fullText, profile);
  if (figCheck.hasFigures) {
    const figOk = profile === 'lncs' ? figCheck.lncsCount > 0 : figCheck.ieeeCount > 0;
    ruleChecks.push({ rule: 'figure_caption_format', passed: figOk, observedValue: JSON.stringify(figCheck), expected: 'correct format' });
    if (!figOk) {
      addIssue({
        section: 'figures',
        severity: 'Review',
        problem: profile === 'lncs'
          ? 'Figure captions should follow LNCS format: "Fig. 1. Description" (period after number, caption placed below figure).'
          : 'Figure captions should follow IEEE format: "Fig. 1." or "Figure 1:" placed below the figure.',
        recommended_action: profile === 'lncs'
          ? 'Format as: Fig. 1. Caption text ending with a period.'
          : 'Format as: Fig. 1. Caption text.',
      });
    }
  }

  const tableCheck = checkTableCaptions(fullText);
  if (tableCheck.hasTables && tableCheck.correctCount === 0) {
    ruleChecks.push({ rule: 'table_caption_format', passed: false, observedValue: 0, expected: 'Table N. format' });
    addIssue({
      section: 'tables',
      severity: 'Review',
      problem: 'Tables detected but captions are not in the required format.',
      recommended_action: profile === 'lncs'
        ? 'LNCS: Place table captions ABOVE the table, formatted as "Table 1. Description ending with period."'
        : 'IEEE: Place table captions ABOVE the table, formatted as "TABLE I. DESCRIPTION" in all caps.',
    });
  }

  const undefinedAcr = findUndefinedAcronyms(fullText);
  ruleChecks.push({ rule: 'acronym_definitions', passed: undefinedAcr.length === 0, observedValue: undefinedAcr.join(', ') || 'none', expected: 'all defined on first use' });
  if (undefinedAcr.length > 0) {
    addIssue({ section: 'language', severity: 'Review', problem: `${undefinedAcr.length} acronym(s) used without definition on first use: ${undefinedAcr.join(', ')}.`, recommended_action: 'Define each acronym on first use, e.g. "Convolutional Neural Network (CNN)".' });
  }

  if (fullText.trim().length > 100) {
    const estimatedPages = estimatePages(fullText, profile);
    const minPages = profileConfig.minPages || (profile === 'lncs' ? 10 : 4);
    const maxPages = profileConfig.maxPages || (profile === 'lncs' ? 15 : 6);
    ruleChecks.push({ rule: 'page_estimate', passed: estimatedPages >= minPages && estimatedPages <= maxPages, observedValue: `~${estimatedPages} pages`, expected: `${minPages}\u2013${maxPages} pages` });
    if (estimatedPages > maxPages) {
      addIssue({ section: 'structure', severity: 'Review', problem: `Estimated length is ~${estimatedPages} pages \u2014 may exceed the ${profileConfig.name} page limit of ${maxPages} pages.`, recommended_action: 'Trim content. Verify actual page count in your formatted document.' });
    } else if (estimatedPages < minPages) {
      addIssue({ section: 'structure', severity: 'Review', problem: `Estimated length is ~${estimatedPages} pages \u2014 may be below the ${profileConfig.name} minimum of ${minPages} pages.`, recommended_action: 'Expand methodology, results, and discussion sections.' });
    }
  }

  const conclusionText = sections['conclusion'] || sections['conclusions'] || '';
  if (conclusionText.length > 50) {
    const newResultPattern = /we (found|discovered|show|demonstrate|prove|introduce|present a novel)/i;
    ruleChecks.push({ rule: 'conclusion_no_new_results', passed: !newResultPattern.test(conclusionText), observedValue: 'scanned', expected: 'no new claims' });
    if (newResultPattern.test(conclusionText)) {
      addIssue({ section: 'conclusion', severity: 'Review', problem: 'Conclusion may be introducing new results or claims not previously discussed.', recommended_action: 'Conclusion should only summarize earlier findings. Move new claims to Results or Discussion.' });
    }
  }

  const criticalCount = issues.filter(i => i.severity === 'Critical').length;
  const reviewCount = issues.filter(i => i.severity === 'Review').length;
  const overallScore = Math.max(0, 100 - criticalCount * 20 - reviewCount * 5);

  const manualWarnings = MANUAL_WARNINGS[profile] || [];

  return {
    overallScore,
    issues,
    sectionStatus,
    ruleChecks,
    manualWarnings,
    recommendedActions: issues.map(i => i.recommended_action),
  };
}

module.exports = { evaluateCompliance };
