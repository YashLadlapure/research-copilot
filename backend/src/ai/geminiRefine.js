const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

const MODE_INSTRUCTIONS = {
  strict:
    'Preserve the original meaning exactly. Do not add new claims. Do not change any numbers, percentages, or citations. Only fix grammar and awkward phrasing.',
  balanced:
    'Improve clarity and flow with small edits. Keep all original claims and meaning intact. Do not introduce new scientific statements.',
  aggressive:
    'Polish the writing style more thoroughly. Improve academic tone, sentence structure, and conciseness. Do not add new scientific claims or alter cited results.',
};

function buildPrompt(sectionText, profile, mode, constraints) {
  const instruction = MODE_INSTRUCTIONS[mode.toLowerCase()] || MODE_INSTRUCTIONS.balanced;
  const constraintBlock = constraints && constraints.length > 0
    ? `\nCompliance constraints you MUST satisfy in your revision:\n${constraints.map(c => `- ${c}`).join('\n')}\n`
    : '';

  return `You are a research manuscript editor helping an author prepare their paper for ${profile.toUpperCase()} submission.

Refinement mode: ${mode.toUpperCase()}
Instruction: ${instruction}
${constraintBlock}
Refine the following section text according to the instruction and all compliance constraints above.

Return ONLY a valid JSON object with exactly these keys:
{
  "original_text": "the input text unchanged",
  "revised_text": "your refined version",
  "change_summary": "one sentence describing what was changed",
  "rationale": "why these changes improve the section for ${profile.toUpperCase()}",
  "safety_note": "confirmation that no claims, citations, or numbers were altered",
  "confidence": 0.0
}

Rules:
- confidence is a number between 0 and 1
- Return JSON only. No markdown, no code fences, no explanation outside the JSON.

Section text:
${sectionText.slice(0, 6000)}`;
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

async function refineSectionText(sectionText, profile, mode, constraints = []) {
  const model = genAI.getGenerativeModel({ model: MODEL });
  try {
    const result = await model.generateContent(buildPrompt(sectionText, profile, mode, constraints));
    return parseJSON(result.response.text());
  } catch (err) {
    if (err?.message?.includes('429') || err?.message?.includes('quota')) {
      throw new Error('Gemini quota exceeded. Check your API key at https://aistudio.google.com');
    }
    try {
      const retry = await model.generateContent(
        `Refine this text for ${profile} (${mode} mode). Return raw JSON only with keys: original_text, revised_text, change_summary, rationale, safety_note, confidence.\n\n${sectionText.slice(0, 3000)}`
      );
      return parseJSON(retry.response.text());
    } catch (retryErr) {
      throw new Error('Gemini refinement failed. Please try again.');
    }
  }
}

module.exports = { refineSectionText };
