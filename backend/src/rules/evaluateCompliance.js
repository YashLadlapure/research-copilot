// ─── helpers ────────────────────────────────────────────────────────────────

function wordCount(text) {
  return text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
}

// Check citation style: numbered [1] vs author-year (Author, 2024)
function detectCitationStyle(fullText) {
  const numbered = (fullText.match(/\[\d+\]/g) || []).length;
  const authorYear = (fullText.match(/\([A-Z][a-z]+,?\s+\d{4}\)/g) || []).length;
  return { numbered, authorYear };
}

// Check if section headings are numbered (1. Introduction, 2. Methodology)
function hasNumberedHeadings(sections) {
  const sectionNames = Object.keys(sections);
  // look for headings in the raw text by checking if any section name appears with a number prefix
  return sectionNames.some(name => /^\d+\.?\s+/i.test(name));
}

// Check figure captions format: Fig. 1. Caption (LNCS) or Fig. 1: / Figure 1:
function checkFigureCaptions(fullText, profile) {
  const hasFigures = /fig(ure)?\.?\s*\d+/i.test(fullText);
  if (!hasFigures) return { hasFigures: false };
  // LNCS expects: Fig. 1. Caption (period after number)
  const lncsStyle = /Fig\.\s*\d+\.\s+\w/g;
  // IEEE expects: Fig. 1. or Figure 1:
  const ieeeStyle = /Fig\.\s*\d+[.:]/g;
  const lncsCount = (fullText.match(lncsStyle) || []).length;
  const ieeeCount = (fullText.match(ieeeStyle) || []).length;
  return { hasFigures: true, lncsCount, ieeeCount };
}

// Check table caption format: Table 1. (LNCS — caption above table)
function checkTableCaptions(fullText) {
  const hasTables = /table\s*\d+/i.test(fullText);
  if (!hasTables) return { hasTables: false };
  const correctStyle = /Table\s+\d+\.\s+\w/g;
  const count = (fullText.match(correctStyle) || []).length;
  return { hasTables: true, correctCount: count };
}

// Check if reference list uses numbered style [1] Author, Title...
function checkReferenceListStyle(refText) {
  if (!refText) return { style: 'unknown' };
  const numbered = /^\s*\[\d+\]/m.test(refText);
  const authorYear = /^\s*[A-Z][a-z]+,\s+[A-Z]/m.test(refText);
  return { style: numbered ? 'numbered' : authorYear ? 'author-year' : 'unknown' };
}

// Detect undefined acronyms: finds ALL_CAPS words not preceded by their expansion
function findUndefinedAcronyms(fullText) {
  const acronyms = [...new Set((fullText.match(/\b[A-Z]{2,6}\b/g) || []))];
  const common = new Set(['AI', 'ML', 'NLP', 'API', 'PDF', 'URL', 'IEEE', 'LNCS', 'IoT', 'ID', 'UI', 'UX', 'DB', 'OS', 'CPU', 'GPU', 'RAM']);
  const undefined_ = [];
  for (const acr of acronyms) {
    if (common.has(acr)) continue;
    // check if expansion appears before or at first use: (ACRONYM) pattern
    const definitionPattern = new RegExp(`\\(${acr}\\)`, 'g');
    if (!definitionPattern.test(fullText)) {
      undefined_.push(acr);
    }
  }
  return undefined_.slice(0, 5); // cap at 5 to avoid noise
}

// Estimate page count from word count (approx 500 words/page for two-column, 400 for single)
function estimatePages(fullText, profile) {
  const wc = wordCount(fullText);
  const wordsPerPage = profile === 'ieee' ? 500 : 400;
  return Math.ceil(wc / wordsPerPage);
}

// Check punctuation before citation: "word[1]" should be "word.[1]" or "word [1]"
function checkCitationPunctuation(fullText) {
  // finds cases like word[1] with no space or punctuation before bracket
  const bad = (fullText.match(/[a-z][\[\(]\d/g) || []).length;
  return bad;
}

// ─── main ────────────────────────────────────────────────────────────────────

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

  // build full text from sections for deep checks
  const sections = structured.sections || {};
  const fullText = Object.values(sections).join('\n') + '\n' + (structured.abstract || '') + '\n' + (structured.title || '');
  const refText = sections['references'] || sections['bibliography'] || '';
  const profile = profileConfig.id || 'lncs';

  // ── 1. Required sections ──────────────────────────────────────────────────
  for (const required of profileConfig.requiredSections) {
    const found = allDetected.includes(required.toLowerCase()) && !allMissing.includes(required.toLowerCase());
    ruleChecks.push({ rule: `section_present_${required}`, passed: found, observedValue: found, expected: 'true' });
    if (!found) {
      issues.push({
        section: required,
        severity: 'Critical',
        problem: `Required section "${required}" was not detected in the manuscript.`,
        recommended_action: `Add a clearly labeled "${required}" section before submission.`,
      });
      sectionStatus.push({ name: required, status: 'Critical', summary: `"${required}" section is missing.` });
    } else {
      sectionStatus.push({ name: required, status: 'Good', summary: `"${required}" section detected.` });
    }
  }

  // ── 2. Abstract word count ────────────────────────────────────────────────
  const abstractText = structured.abstract || '';
  const abstractWords = wordCount(abstractText);
  const minWords = profileConfig.abstractMinWords;
  const maxWords = profileConfig.abstractMaxWords;
  const abstractOk = abstractWords >= minWords && abstractWords <= maxWords;

  ruleChecks.push({ rule: 'abstract_word_count', passed: abstractOk, observedValue: abstractWords, expected: `${minWords}–${maxWords} words` });

  if (abstractWords === 0) {
    issues.push({ section: 'abstract', severity: 'Critical', problem: 'Abstract is empty or could not be extracted.', recommended_action: 'Ensure the abstract is clearly labeled and contains content.' });
  } else if (abstractWords > maxWords) {
    issues.push({ section: 'abstract', severity: 'Critical', problem: `Abstract is ${abstractWords} words, exceeding the ${profileConfig.name} limit of ${maxWords} words.`, recommended_action: `Shorten the abstract to ${maxWords} words or fewer.` });
  } else if (abstractWords < minWords) {
    issues.push({ section: 'abstract', severity: 'Review', problem: `Abstract is ${abstractWords} words, below the ${profileConfig.name} guideline of at least ${minWords} words.`, recommended_action: `Expand the abstract to at least ${minWords} words.` });
  }

  // ── 3. Keywords ───────────────────────────────────────────────────────────
  if (profileConfig.keywordsRequired) {
    const kwCount = Array.isArray(structured.keywords) ? structured.keywords.length : 0;
    const kwOk = kwCount >= profileConfig.keywordsMinCount && kwCount <= profileConfig.keywordsMaxCount;
    const kwLabel = profileConfig.keywordsLabel || 'Keywords';
    ruleChecks.push({ rule: 'keywords_count', passed: kwOk, observedValue: kwCount, expected: `${profileConfig.keywordsMinCount}–${profileConfig.keywordsMaxCount} ${kwLabel}` });
    if (kwCount === 0) {
      issues.push({ section: 'keywords', severity: 'Critical', problem: `No ${kwLabel} were detected.`, recommended_action: `Add ${profileConfig.keywordsMinCount}–${profileConfig.keywordsMaxCount} ${kwLabel} directly after the abstract.` });
    } else if (!kwOk) {
      issues.push({ section: 'keywords', severity: 'Review', problem: `${kwCount} ${kwLabel} detected. ${profileConfig.name} expects ${profileConfig.keywordsMinCount}–${profileConfig.keywordsMaxCount}.`, recommended_action: `Adjust ${kwLabel} to meet the ${profileConfig.name} requirement.` });
    }
  }

  // ── 4. References section ─────────────────────────────────────────────────
  if (profileConfig.referenceSectionRequired) {
    ruleChecks.push({ rule: 'references_present', passed: structured.referencesPresent, observedValue: structured.referencesPresent, expected: 'true' });
    if (!structured.referencesPresent) {
      issues.push({ section: 'references', severity: 'Critical', problem: 'No references section was detected.', recommended_action: `Add a references section using ${profileConfig.referenceStyleNote || profileConfig.referenceStyle + ' style'}.` });
    }
  }

  // ── 5. Citation style check ───────────────────────────────────────────────
  const { numbered, authorYear } = detectCitationStyle(fullText);
  if (numbered === 0 && authorYear === 0 && structured.referencesPresent) {
    issues.push({ section: 'references', severity: 'Review', problem: 'No inline citations detected in the manuscript body.', recommended_action: `Add numbered citations [1] in the text for every reference listed.` });
  } else if (profile === 'lncs' || profile === 'ieee') {
    if (authorYear > numbered && (numbered + authorYear) > 3) {
      issues.push({
        section: 'references',
        severity: 'Critical',
        problem: `${profileConfig.name} requires numbered citations [1][2][3], but author-year style (Author, 2024) was detected.`,
        recommended_action: 'Switch all inline citations to numbered format [1] and update reference list accordingly.',
      });
    }
  }
  ruleChecks.push({ rule: 'citation_style', passed: authorYear <= numbered, observedValue: `numbered:${numbered} author-year:${authorYear}`, expected: 'numbered style' });

  // ── 6. Citation punctuation ───────────────────────────────────────────────
  const badPunctCount = checkCitationPunctuation(fullText);
  if (badPunctCount > 2) {
    issues.push({
      section: 'references',
      severity: 'Review',
      problem: `${badPunctCount} citation(s) appear without proper spacing or punctuation (e.g. "word[1]" should be "word [1]" or "word.[1]").`,
      recommended_action: 'Add a space or punctuation mark before each citation bracket.',
    });
  }
  ruleChecks.push({ rule: 'citation_punctuation', passed: badPunctCount <= 2, observedValue: badPunctCount, expected: '≤2 issues' });

  // ── 7. Reference list style ───────────────────────────────────────────────
  const refStyle = checkReferenceListStyle(refText);
  if (refText && refStyle.style === 'author-year' && (profile === 'lncs' || profile === 'ieee')) {
    issues.push({
      section: 'references',
      severity: 'Critical',
      problem: `Reference list appears to use author-year format. ${profileConfig.name} requires numbered references [1] Author, Title, Venue, Year.`,
      recommended_action: 'Reformat all references to numbered style as required by ' + profileConfig.name + '.',
    });
  }
  ruleChecks.push({ rule: 'reference_list_style', passed: refStyle.style !== 'author-year', observedValue: refStyle.style, expected: 'numbered' });

  // ── 8. Numbered section headings (LNCS strict requirement) ───────────────
  if (profile === 'lncs') {
    const sectionKeys = Object.keys(sections);
    const anyNumbered = sectionKeys.some(k => /^\d+[. ]/.test(k));
    // also scan fullText for heading patterns
    const headingPattern = /^\d+\.?\s+[A-Z][a-z]/m;
    const hasNumbered = anyNumbered || headingPattern.test(fullText);
    ruleChecks.push({ rule: 'numbered_headings', passed: hasNumbered, observedValue: hasNumbered, expected: 'true' });
    if (!hasNumbered) {
      issues.push({
        section: 'structure',
        severity: 'Review',
        problem: 'Springer LNCS requires numbered section headings (e.g. "1 Introduction", "2 Methodology").',
        recommended_action: 'Add sequential numbers to all section and subsection headings.',
      });
    }
  }

  // ── 9. Figure caption format ──────────────────────────────────────────────
  const figCheck = checkFigureCaptions(fullText, profile);
  if (figCheck.hasFigures) {
    if (profile === 'lncs' && figCheck.lncsCount === 0) {
      issues.push({
        section: 'figures',
        severity: 'Review',
        problem: 'Figures detected but no captions in LNCS format ("Fig. 1. Caption text") were found.',
        recommended_action: 'Format all figure captions as "Fig. 1. Description" — period after number, caption below figure.',
      });
    } else if (profile === 'ieee' && figCheck.ieeeCount === 0) {
      issues.push({
        section: 'figures',
        severity: 'Review',
        problem: 'Figures detected but captions do not follow IEEE format ("Fig. 1." or "Figure 1:").',
        recommended_action: 'Format all figure captions as "Fig. 1." followed by description.',
      });
    }
    ruleChecks.push({ rule: 'figure_caption_format', passed: profile === 'lncs' ? figCheck.lncsCount > 0 : figCheck.ieeeCount > 0, observedValue: JSON.stringify(figCheck), expected: 'correct format' });
  }

  // ── 10. Table caption format ──────────────────────────────────────────────
  const tableCheck = checkTableCaptions(fullText);
  if (tableCheck.hasTables && tableCheck.correctCount === 0) {
    issues.push({
      section: 'tables',
      severity: 'Review',
      problem: 'Tables detected but no captions in required format ("Table 1. Caption") were found.',
      recommended_action: profile === 'lncs'
        ? 'LNCS requires table captions ABOVE the table, formatted as "Table 1. Description".'
        : 'IEEE requires table captions ABOVE the table, formatted as "TABLE I. Description" in all caps.',
    });
    ruleChecks.push({ rule: 'table_caption_format', passed: false, observedValue: 0, expected: 'Table N. format' });
  }

  // ── 11. Undefined acronyms ────────────────────────────────────────────────
  const undefinedAcr = findUndefinedAcronyms(fullText);
  if (undefinedAcr.length > 0) {
    issues.push({
      section: 'language',
      severity: 'Review',
      problem: `${undefinedAcr.length} acronym(s) used without definition on first use: ${undefinedAcr.join(', ')}.`,
      recommended_action: 'Define each acronym on first use, e.g. "Convolutional Neural Network (CNN)".',
    });
  }
  ruleChecks.push({ rule: 'acronym_definitions', passed: undefinedAcr.length === 0, observedValue: undefinedAcr.join(', ') || 'none', expected: 'all defined' });

  // ── 12. Page length estimate ──────────────────────────────────────────────
  if (fullText.trim().length > 100) {
    const estimatedPages = estimatePages(fullText, profile);
    const minPages = profileConfig.minPages || (profile === 'lncs' ? 10 : 4);
    const maxPages = profileConfig.maxPages || (profile === 'lncs' ? 15 : 6);
    ruleChecks.push({ rule: 'page_estimate', passed: estimatedPages >= minPages && estimatedPages <= maxPages, observedValue: `~${estimatedPages} pages`, expected: `${minPages}–${maxPages} pages` });
    if (estimatedPages > maxPages) {
      issues.push({
        section: 'structure',
        severity: 'Review',
        problem: `Estimated length is ~${estimatedPages} pages, which may exceed the ${profileConfig.name} limit of ${maxPages} pages.`,
        recommended_action: 'Review and trim content. Check actual page count in your formatted document.',
      });
    } else if (estimatedPages < minPages) {
      issues.push({
        section: 'structure',
        severity: 'Review',
        problem: `Estimated length is ~${estimatedPages} pages, which may be below the ${profileConfig.name} minimum of ${minPages} pages.`,
        recommended_action: 'Ensure sufficient depth in methodology, results, and discussion sections.',
      });
    }
  }

  // ── 13. Conclusion check — no new results ────────────────────────────────
  const conclusionText = sections['conclusion'] || sections['conclusions'] || '';
  if (conclusionText.length > 50) {
    const newResultPatterns = /we (found|discovered|show|demonstrate|prove|introduce|present a novel)/i;
    if (newResultPatterns.test(conclusionText)) {
      issues.push({
        section: 'conclusion',
        severity: 'Review',
        problem: 'Conclusion may be introducing new results or claims not presented earlier.',
        recommended_action: 'Conclusion should only summarize findings already discussed. Move any new claims to the results or discussion section.',
      });
    }
    ruleChecks.push({ rule: 'conclusion_no_new_results', passed: !newResultPatterns.test(conclusionText), observedValue: 'scanned', expected: 'no new claims' });
  }

  // ── Score ─────────────────────────────────────────────────────────────────
  const criticalCount = issues.filter(i => i.severity === 'Critical').length;
  const reviewCount = issues.filter(i => i.severity === 'Review').length;
  const overallScore = Math.max(0, 100 - criticalCount * 20 - reviewCount * 5);

  return {
    overallScore,
    issues,
    sectionStatus,
    ruleChecks,
    recommendedActions: issues.map(i => i.recommended_action),
  };
}

module.exports = { evaluateCompliance };
