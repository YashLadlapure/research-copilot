/**
 * @typedef {Object} StructuredManuscript
 * @property {string} title
 * @property {string} abstract
 * @property {string[]} keywords
 * @property {string[]} sectionsDetected
 * @property {string[]} sectionsMissing
 * @property {boolean} referencesPresent
 */

/**
 * @typedef {Object} ComplianceIssue
 * @property {string} section
 * @property {'Critical'|'Review'|'Good'} severity
 * @property {string} problem
 * @property {string} action
 */

/**
 * @typedef {Object} SectionStatus
 * @property {string} section
 * @property {'Critical'|'Review'|'Good'} status
 * @property {string} summary
 */

/**
 * @typedef {Object} RuleCheck
 * @property {string} rule
 * @property {boolean} passed
 * @property {number|string|boolean} [observedValue]
 * @property {string} [expected]
 */

/**
 * @typedef {Object} ComplianceReport
 * @property {number} overallScore
 * @property {ComplianceIssue[]} issues
 * @property {SectionStatus[]} sectionStatus
 * @property {RuleCheck[]} ruleChecks
 * @property {string[]} recommendedActions
 */

/**
 * @typedef {Object} RevisionSuggestion
 * @property {string} targetSection
 * @property {string} originalText
 * @property {string} revisedText
 * @property {string} changeSummary
 * @property {string} rationale
 * @property {string} safetyNote
 * @property {'Strict'|'Balanced'|'Aggressive'} mode
 * @property {number} confidence
 */

/**
 * @typedef {Object} ManuscriptSession
 * @property {string} id
 * @property {string} profile
 * @property {string} originalText
 * @property {string} normalizedText
 * @property {StructuredManuscript|null} structuredManuscript
 * @property {ComplianceReport|null} complianceReport
 * @property {RevisionSuggestion[]} revisions
 */

module.exports = {};
