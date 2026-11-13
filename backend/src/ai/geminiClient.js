const { GoogleGenerativeAI } = require('@google/generative-ai');

const PRIMARY_MODEL = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || 'gemini-2.5-flash-lite';
const REQUEST_TIMEOUT_MS = 30000;

class GeminiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

let client;

function isConfigured() {
  return Boolean(process.env.GEMINI_API_KEY);
}

async function requestJson(modelName, { system, prompt, schema }) {
  client ??= new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = client.getGenerativeModel(
    {
      model: modelName,
      systemInstruction: system,
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
        responseSchema: schema,
      },
    },
    { timeout: REQUEST_TIMEOUT_MS },
  );
  const result = await model.generateContent(prompt);
  return JSON.parse(result.response.text());
}

function isAuthError(err) {
  return err.status === 401 || err.status === 403 || /api key/i.test(err.message || '');
}

function toGeminiError(err) {
  if (err instanceof SyntaxError) {
    return new GeminiError('Gemini returned a response that could not be read. Try again.', 502);
  }
  if (isAuthError(err)) {
    return new GeminiError('Gemini rejected this server\'s API key.', 503);
  }
  if (err.status === 429) {
    return new GeminiError('The Gemini rate limit has been reached. Try again in a minute.', 503);
  }
  return new GeminiError('Gemini is unavailable right now. Try again shortly.', 503);
}

// Malformed JSON is retried once on the same model. API failures such as
// quota, overload or a timeout go straight to the fallback model, since
// repeating the same call rarely helps.
async function generateJson(request) {
  if (!isConfigured()) {
    throw new GeminiError('Gemini is not configured on this server.', 503);
  }

  let lastError;
  for (const modelName of [PRIMARY_MODEL, FALLBACK_MODEL]) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        return await requestJson(modelName, request);
      } catch (err) {
        lastError = err;
        console.error(`[gemini] ${modelName} attempt ${attempt} failed: ${err.status || ''} ${err.message}`);
        if (isAuthError(err)) throw toGeminiError(err);
        if (!(err instanceof SyntaxError)) break;
      }
    }
  }
  throw toGeminiError(lastError);
}

module.exports = { generateJson, isConfigured, GeminiError };
