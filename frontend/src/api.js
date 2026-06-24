const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

export async function analyzeManuscript(text, profile) {
  return post('/api/analyze', { text, profile });
}

export async function reanalyzeManuscript(sessionId) {
  return post('/api/reanalyze', { sessionId });
}

export async function refineSection(sessionId, section) {
  return post('/api/refine-section', { sessionId, section });
}

export async function applySuggestion(sessionId, targetSection, revisedText) {
  return post('/api/apply-suggestion', { sessionId, targetSection, revisedText });
}

export async function extractPdf(file) {
  const formData = new FormData();
  formData.append('pdf', file);
  const res = await fetch(`${BASE}/api/extract-pdf`, { method: 'POST', body: formData });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'PDF extraction failed');
  return data;
}

export async function fetchBonusTips(sessionId, profile) {
  return post('/api/bonus-tips', { sessionId, profile });
}

export async function fetchExportData(sessionId, revisedSections) {
  const data = await post('/api/export-summary', { sessionId, revisedSections });
  return data.exportText || '';
}
