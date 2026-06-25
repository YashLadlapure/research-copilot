const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

const EXTRACTION_SCHEMA = `{
  "title": "string",
  "abstract": "string",
  "keywords": ["string"],
  "sections_detected": ["string"],
  "sections_missing": ["string"],
  "references_present": true
}`;

function buildExtractionPrompt(text, profile) {
  return `You are a research manuscript structure analyzer.

Target publication profile: ${profile.toUpperCase()}

The manuscript below may be plain text extracted from a PDF. Section headings may appear as:
- Numbered headings: "1 Introduction", "2. Methodology", "3 Results"
- Unnumbered headings: "Introduction", "Abstract", "Conclusion"
- Bold or ALL-CAPS labels without markdown formatting
- "Keywords:" or "Index Terms:" inline before the keyword list
- "Abstract" as a standalone line or paragraph label

Extract and return ONLY a valid JSON object with exactly these keys:
${EXTRACTION_SCHEMA}

Rules:
- "title": the paper title (usually the first prominent line), or empty string
- "abstract": full abstract text as a single string, or empty string if not found
- "keywords": array of keyword strings extracted from the Keywords or Index Terms line, or empty array
- "sections_detected": lowercase array of section names clearly present, e.g. ["introduction", "methodology", "conclusion"]
- "sections_missing": lowercase array of sections expected for ${profile.toUpperCase()} but not found
- "references_present": true if a References or Bibliography section exists, false otherwise
- Do NOT invent content. If a section is absent, list it in sections_missing.
- Return JSON only. No explanation, no markdown, no code blocks.

Manuscript text:
${text.slice(0, 12000)}`;
}

function buildRetryPrompt(text) {
  return `Extract the structure of this research paper as a JSON object.
Return ONLY raw JSON with no markdown, no code fences, no explanation.
Required keys: title (string), abstract (string), keywords (array of strings), sections_detected (array of lowercase strings), sections_missing (array of lowercase strings), references_present (boolean).
Note: Section headings may be numbered like "1 Introduction" or "2. Methodology" — detect them.

Manuscript:
${text.slice(0, 12000)}`;
}

async function extractSections(text, profile) {
  const primaryModel = genAI.getGenerativeModel({ model: MODEL });
  const fallbackModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });

  async function tryModel(model, prompt) {
    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim();
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
    return JSON.parse(cleaned);
  }

  try {
    return await tryModel(primaryModel, buildExtractionPrompt(text, profile));
  } catch (firstError) {
    console.error('[Gemini] First attempt error:', firstError?.message || firstError);

    if (firstError?.message?.includes('429') || firstError?.message?.includes('quota')) {
      throw new Error('Gemini quota exceeded. Please check your API key and model quota at https://ai.dev/rate-limit');
    }

    try {
      return await tryModel(primaryModel, buildRetryPrompt(text));
    } catch (retryError) {
      console.error('[Gemini] Retry attempt error:', retryError?.message || retryError);
      // 503 overload — try fallback model
      if (retryError?.message?.includes('503') || firstError?.message?.includes('503')) {
        try {
          return await tryModel(fallbackModel, buildRetryPrompt(text));
        } catch (fallbackError) {
          console.error('[Gemini] Fallback error:', fallbackError?.message || fallbackError);
        }
      }
      throw new Error('Gemini section extraction failed after retry. Please try again.');
    }
  }
}

module.exports = { extractSections };
