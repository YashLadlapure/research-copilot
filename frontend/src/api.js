const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

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

export async function extractPdf(file) {
  const form = new FormData();
  form.append('pdf', file);
  const res = await fetch(`${BASE}/api/extract-pdf`, {
    method: 'POST',
    body: form,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'PDF extraction failed');
  return data;
}
