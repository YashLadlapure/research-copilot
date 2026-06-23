const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

/**
 * POST /api/analyze
 * @param {string} text  - raw manuscript text
 * @param {string} profile - 'springer_lncs' | 'ieee_conference'
 * @returns {{ sessionId, structuredManuscript, complianceReport }}
 */
export async function analyzeManuscript(text, profile) {
  const res = await fetch(`${BASE}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, profile }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Analysis failed');
  return data;
}

/**
 * POST /api/refine-section
 * @param {string} sessionId
 * @param {string} targetSection - section name to refine
 * @param {'strict'|'balanced'|'aggressive'} mode
 * @returns {{ suggestion }}
 */
export async function refineSection(sessionId, targetSection, mode = 'strict') {
  const res = await fetch(`${BASE}/api/refine-section`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, targetSection, mode }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Refinement failed');
  return data;
}

/**
 * POST /api/apply-suggestion
 * @param {string} sessionId
 * @param {string} targetSection
 * @param {string} revisedText
 * @returns {{ ok, applied }}
 */
export async function applySuggestion(sessionId, targetSection, revisedText) {
  const res = await fetch(`${BASE}/api/apply-suggestion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, targetSection, revisedText }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Apply failed');
  return data;
}
