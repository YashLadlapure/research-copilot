const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

const COMPLIANCE_INSTRUCTION = `You are a strict academic manuscript editor preparing a paper for formal publication.

Your job is to fix this section so it fully satisfies the compliance constraints listed below.
You must also improve academic tone, grammar, and sentence clarity — but you must NEVER:
- Add new scientific claims, findings, or results
- Change any numbers, percentages, statistics, or citations
- Remove or reorder any factual content
- Alter the author's intended meaning in any way

Every change you make must be justified by one of:
1. A compliance constraint listed below
2. A grammar or clarity improvement that does not change meaning`;

function normalizeText(sectionText) {
  if (Array.isArray(sectionText)) return sectionText.join(', ');
  return String(sectionText);
}

function buildPrompt(sectionText, profile, constraints) {
  const constraintBlock = constraints && constraints.length > 0
    ? `\nCompliance constraints you MUST satisfy (these are not optional):\n${constraints.map(c => `- ${c}`).join('\n')}\n`
    : '';

  return `${COMPLIANCE_INSTRUCTION}

Target publication format: ${profile.toUpperCase()}${constraintBlock}
Refine the section below and return ONLY a valid JSON object with exactly these keys:
{
  "original_text": "the input text unchanged",
  "revised_text": "your fully corrected version",
  "change_summary": "one sentence: what was changed and which constraint it addresses",
  "rationale": "why these changes satisfy ${profile.toUpperCase()} requirements",
  "safety_note": "confirmation that no claims, citations, or numbers were altered",
  "confidence": 0.0
}

Rules:
- confidence is a number between 0 and 1 reflecting how well the revision satisfies all constraints
- Return JSON only. No markdown, no code fences, no explanation outside the JSON.

Section text:
${normalizeText(sectionText).slice(0, 6000)}`;
}

function buildRetryPrompt(sectionText, profile, constraints) {
  const constraintBlock = constraints && constraints.length > 0
    ? `Constraints:\n${constraints.map(c => `- ${c}`).join('\n')}\n`
    : '';
  return `Fix this manuscript section for ${profile.toUpperCase()} compliance. Do not alter meaning, claims, or citations.\n${constraintBlock}\nReturn raw JSON only with keys: original_text, revised_text, change_summary, rationale, safety_note, confidence.\n\n${normalizeText(sectionText).slice(0, 3000)}`;
}

function parseJSON(raw) {
  const cleaned = raw
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  return JSON.parse(cleaned);
}

async function refineSectionText(sectionText, profile, _mode, constraints = []) {
  const model = genAI.getGenerativeModel({ model: MODEL });
  try {
    const result = await model.generateContent(buildPrompt(sectionText, profile, constraints));
    return parseJSON(result.response.text());
  } catch (err) {
    if (err?.message?.includes('429') || err?.message?.includes('quota')) {
      throw new Error('Gemini quota exceeded. Check your API key at https://aistudio.google.com');
    }
    try {
      const retry = await model.generateContent(buildRetryPrompt(sectionText, profile, constraints));
      return parseJSON(retry.response.text());
    } catch (retryErr) {
      throw new Error('Gemini refinement failed. Please try again.');
    }
  }
}

module.exports = { refineSectionText };
