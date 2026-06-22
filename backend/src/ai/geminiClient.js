const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// gemini-2.0-flash-lite was shut down June 1, 2026. Use gemini-3.1-flash-lite as default.
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';

const EXTRACTION_SCHEMA = `{
  "title": "string",
  "abstract": "string",
  "keywords": ["string"],
  "sections_detected": ["string"],
  "sections_missing": ["string"],
  "references_present": true
}`;

function buildExtractionPrompt(text, profile) {
  return `You are a research manuscript analyzer. Analyze the following research paper text and extract its structure.

Target publication profile: ${profile.toUpperCase()}

Extract and return ONLY a valid JSON object with exactly these keys:
${EXTRACTION_SCHEMA}

Rules:
- "title": the paper title as a string, or empty string if not found
- "abstract": the full abstract text as a string, or empty string if not found
- "keywords": array of keyword strings, or empty array if not found
- "sections_detected": array of section names that are clearly present (e.g. ["introduction", "methodology", "conclusion"])
- "sections_missing": array of section names that are expected but not found
- "references_present": true if a references or bibliography section exists, false otherwise
- Do NOT invent content. If a section is absent, list it in sections_missing.
- Return JSON only. No explanation, no markdown, no code blocks.

Manuscript text:
${text.slice(0, 12000)}`;
}

function buildRetryPrompt(text) {
  return `Extract the structure of this research paper as a JSON object.
Return ONLY raw JSON with no markdown, no code fences, no explanation.
Required keys: title (string), abstract (string), keywords (array of strings), sections_detected (array of strings), sections_missing (array of strings), references_present (boolean).

Manuscript:
${text.slice(0, 8000)}`;
}

async function extractSections(text, profile) {
  const model = genAI.getGenerativeModel({ model: MODEL });

  // First attempt
  try {
    const result = await model.generateContent(buildExtractionPrompt(text, profile));
    const raw = result.response.text().trim();
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
    return JSON.parse(cleaned);
  } catch (firstError) {
    console.error('[Gemini] First attempt error:', firstError?.message || firstError);

    // Check for quota exhaustion — no point retrying with same model
    if (firstError?.message?.includes('429') || firstError?.message?.includes('quota')) {
      throw new Error('Gemini quota exceeded. Please check your API key and model quota at https://ai.dev/rate-limit');
    }

    // Retry with stricter prompt for other errors
    try {
      const retryResult = await model.generateContent(buildRetryPrompt(text));
      const raw = retryResult.response.text().trim();
      const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
      return JSON.parse(cleaned);
    } catch (retryError) {
      console.error('[Gemini] Retry attempt error:', retryError?.message || retryError);
      throw new Error('Gemini section extraction failed after retry. Please try again.');
    }
  }
}

module.exports = { extractSections };
