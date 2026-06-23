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

  for (const required of profileConfig.requiredSections) {
    const found = allDetected.includes(required.toLowerCase()) && !allMissing.includes(required.toLowerCase());

    ruleChecks.push({
      rule: `section_present_${required}`,
      passed: found,
      observedValue: found,
      expected: 'true',
    });

    if (!found) {
      issues.push({
        section: required,
        severity: 'Critical',
        problem: `Required section "${required}" was not detected in the manuscript.`,
        recommended_action: `Add a clearly labeled "${required}" section before submission.`,
      });
      sectionStatus.push({
        name: required,
        status: 'Critical',
        summary: `"${required}" section is missing.`,
      });
    } else {
      sectionStatus.push({
        name: required,
        status: 'Good',
        summary: `"${required}" section detected.`,
      });
    }
  }

  const abstractText = structured.abstract || '';
  const abstractWords = abstractText.trim() === '' ? 0 : abstractText.trim().split(/\s+/).length;
  const minWords = profileConfig.abstractMinWords;
  const maxWords = profileConfig.abstractMaxWords;
  const abstractOk = abstractWords >= minWords && abstractWords <= maxWords;

  ruleChecks.push({
    rule: 'abstract_word_count',
    passed: abstractOk,
    observedValue: abstractWords,
    expected: `${minWords}\u2013${maxWords} words`,
  });

  if (abstractWords === 0) {
    issues.push({
      section: 'abstract',
      severity: 'Critical',
      problem: 'Abstract is empty or could not be extracted.',
      recommended_action: 'Ensure the abstract is clearly labeled and contains content.',
    });
  } else if (abstractWords > maxWords) {
    issues.push({
      section: 'abstract',
      severity: 'Critical',
      problem: `Abstract is ${abstractWords} words, exceeding the ${profileConfig.name} limit of ${maxWords} words.`,
      recommended_action: `Shorten the abstract to ${maxWords} words or fewer.`,
    });
  } else if (abstractWords < minWords) {
    issues.push({
      section: 'abstract',
      severity: 'Review',
      problem: `Abstract is ${abstractWords} words, below the ${profileConfig.name} guideline of at least ${minWords} words.`,
      recommended_action: `Expand the abstract to at least ${minWords} words.`,
    });
  }

  if (profileConfig.keywordsRequired) {
    const kwCount = Array.isArray(structured.keywords) ? structured.keywords.length : 0;
    const kwOk = kwCount >= profileConfig.keywordsMinCount && kwCount <= profileConfig.keywordsMaxCount;
    const kwLabel = profileConfig.keywordsLabel || 'Keywords';

    ruleChecks.push({
      rule: 'keywords_count',
      passed: kwOk,
      observedValue: kwCount,
      expected: `${profileConfig.keywordsMinCount}\u2013${profileConfig.keywordsMaxCount} ${kwLabel}`,
    });

    if (kwCount === 0) {
      issues.push({
        section: 'keywords',
        severity: 'Critical',
        problem: `No ${kwLabel} were detected.`,
        recommended_action: `Add ${profileConfig.keywordsMinCount}\u2013${profileConfig.keywordsMaxCount} ${kwLabel} directly after the abstract.`,
      });
    } else if (!kwOk) {
      issues.push({
        section: 'keywords',
        severity: 'Review',
        problem: `${kwCount} ${kwLabel} detected. ${profileConfig.name} expects ${profileConfig.keywordsMinCount}\u2013${profileConfig.keywordsMaxCount}.`,
        recommended_action: `Adjust ${kwLabel} to meet the ${profileConfig.name} requirement.`,
      });
    }
  }

  if (profileConfig.referenceSectionRequired) {
    ruleChecks.push({
      rule: 'references_present',
      passed: structured.referencesPresent,
      observedValue: structured.referencesPresent,
      expected: 'true',
    });

    if (!structured.referencesPresent) {
      issues.push({
        section: 'references',
        severity: 'Critical',
        problem: 'No references section was detected.',
        recommended_action: `Add a references section using ${profileConfig.referenceStyleNote || profileConfig.referenceStyle + ' style'}.`,
      });
    }
  }

  const criticalCount = issues.filter(i => i.severity === 'Critical').length;
  const reviewCount = issues.filter(i => i.severity === 'Review').length;
  const overallScore = Math.max(0, 100 - criticalCount * 20 - reviewCount * 8);

  return {
    overallScore,
    issues,
    sectionStatus,
    ruleChecks,
    recommendedActions: issues.map(i => i.recommended_action),
  };
}

module.exports = { evaluateCompliance };
