const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const TIMEOUT_MS = 90000;

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request(path, options) {
  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, { ...options, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (err) {
    const timedOut = err.name === 'TimeoutError';
    throw new ApiError(
      timedOut
        ? 'The server took too long to respond. Try again.'
        : 'Could not reach the server. Check your connection and try again.',
      0,
    );
  }

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(body?.error || `Request failed (${response.status}).`, response.status, body?.code);
  }
  return body;
}

function post(path, payload) {
  return request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

const RETRY_DELAY_MS = 5000;

// A sleeping instance answers with a 503 that has no CORS headers, so the
// browser reports it as a network failure (status 0). Calls that change
// nothing on the server are safe to repeat until it is awake.
async function retrying(call, attempts) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await call();
    } catch (err) {
      const waking = err.status === 0 || err.status === 503;
      if (!waking || attempt >= attempts) throw err;
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
}

// The API sleeps when idle. Calling this as the page opens starts it waking
// while the visitor is still reading.
export const wakeServer = () => retrying(() => request('/health'), 24);

export const analyzeManuscript = (text, profile) => retrying(() => post('/api/analyze', { text, profile }), 6);
export const switchProfile = (sessionId, profile) => post('/api/reanalyze', { sessionId, profile });
export const refineSection = (sessionId, section) => post('/api/refine-section', { sessionId, section });
export const applySuggestion = (sessionId, section) => post('/api/apply-suggestion', { sessionId, section });
export const revertRevision = (sessionId, section) => post('/api/revert-revision', { sessionId, section });

export function extractPdf(file) {
  const form = new FormData();
  form.append('pdf', file);
  return request('/api/extract-pdf', { method: 'POST', body: form });
}
