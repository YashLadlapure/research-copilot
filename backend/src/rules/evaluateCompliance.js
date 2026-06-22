function evaluateCompliance(structured, profileConfig) {
  const issues = [];
  const sectionStatus = [];
  const ruleChecks = [];

  // Check each required section
  for (const required of profileConfig.requiredSections) {
    const detected = structured.sectionsDetected.map(s => s.toLowerCase());
    const missing = structured.sectionsMissing.map(s => s.toLowerCase());
    const found = detected.includes(required.toLowerCase()) && !missing.includes(required.toLowerCase());

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
        action: `Add a clearly labeled "${required}" section before submission.`,
      });
      sectionStatus.push({
        section: required,
        status: 'Critical',
        summary: `"${required}" section is missing.`,
      });
    } else {
      sectionStatus.push({
        section: required,
        status: 'Good',
        summary: `"${required}" section detected.`,
      });
    }
  }

  // Abstract word count check
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
      action: 'Ensure the abstract is clearly labeled and contains content.',
    });
  } else if (abstractWords > maxWords) {
    issues.push({
      section: 'abstract',
      severity: 'Critical',
      problem: `Abstract is ${abstractWords} words, exceeding the ${profileConfig.name} limit of ${maxWords} words.`,
      action: `Shorten the abstract to ${maxWords} words or fewer.`,
    });
  } else if (abstractWords < minWords) {
    issues.push({
      section: 'abstract',
      severity: 'Review',
      problem: `Abstract is ${abstractWords} words, below the ${profileConfig.name} guideline of at least ${minWords} words.`,
      action: `Expand the abstract to at least ${minWords} words.`,
    });
  }

  // Keywords check
  if (profileConfig.keywordsRequired) {
    const kwCount = Array.isArray(structured.keywords) ? structured.keywords.length : 0;
    const kwOk = kwCount >= profileConfig.keywordsMinCount && kwCount <= profileConfig.keywordsMaxCount;

    ruleChecks.push({
      rule: 'keywords_count',
      passed: kwOk,
      observedValue: kwCount,
      expected: `${profileConfig.keywordsMinCount}\u2013${profileConfig.keywordsMaxCount} keywords`,
    });

    if (kwCount === 0) {
      issues.push({
        section: 'keywords',
        severity: 'Critical',
        problem: 'No keywords were detected.',
        action: `Add ${profileConfig.keywordsMinCount}\u2013${profileConfig.keywordsMaxCount} keywords after the abstract.`,
      });
    } else if (!kwOk) {
      issues.push({
        section: 'keywords',
        severity: 'Review',
        problem: `${kwCount} keyword(s) detected. ${profileConfig.name} expects ${profileConfig.keywordsMinCount}\u2013${profileConfig.keywordsMaxCount}.`,
        action: `Adjust keywords to meet the ${profileConfig.name} requirement.`,
      });
    }
  }

  // References presence check
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
        action: 'Add a references section with properly formatted citations.',
      });
    }
  }

  // Compute score
  const criticalCount = issues.filter(i => i.severity === 'Critical').length;
  const reviewCount = issues.filter(i => i.severity === 'Review').length;
  const overallScore = Math.max(0, 100 - criticalCount * 20 - reviewCount * 8);

  return {
    overallScore,
    issues,
    sectionStatus,
    ruleChecks,
    recommendedActions: issues.map(i => i.action),
  };
}

module.exports = { evaluateCompliance };
