const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';

const MODE_INSTRUCTIONS = {
  strict:
    'Preserve the original meaning exactly. Do not add new claims. Do not change any numbers, percentages, or citations. Only fix grammar and awkward phrasing.',
  balanced:
    'Improve clarity and flow with small edits. Keep all original claims and meaning intact. Do not introduce new scientific statements.',
  aggressive:
    'Polish the writing style more thoroughly. Improve academic tone, sentence structure, and conciseness. Do not add new scientific claims or alter cited results.',
};

function buildRefinePrompt(sectionText, profile, mode) {
  const instruction = MODE_INSTRUCTIONS[mode.toLowerCase()] || MODE_INSTRUCTIONS.balanced;

  return `You are a research manuscript editor helping an author prepare their paper for ${profile.toUpperCase()} submission.

Refinement mode: ${mode.toUpperCase()}
Instruction: ${instruction}

Refine the following section text according to the instruction above.

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
- confidence is a number between 0 and 1 reflecting how confident you are the revision is safe and accurate
- Return JSON only. No markdown, no code fences, no explanation outside the JSON.

Section text:
${sectionText.slice(0, 6000)}`;
}

function buildRefineRetryPrompt(sectionText, profile, mode) {
  return `Refine this research paper section for ${profile.toUpperCase()} submission in ${mode} mode.
Return ONLY raw JSON with no markdown or code fences.
Required keys: original_text (string), revised_text (string), change_summary (string), rationale (string), safety_note (string), confidence (number 0-1).

Section:
${sectionText.slice(0, 4000)}`;
}

async function refineSectionText(sectionText, profile, mode) {
  const model = genAI.getGenerativeModel({ model: MODEL });

  try {
    const result = await model.generateContent(buildRefinePrompt(sectionText, profile, mode));
    const raw = result.response.text().trim();
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
    return JSON.parse(cleaned);
  } catch (firstError) {
    console.error('[Gemini Refine] First attempt error:', firstError?.message || firstError);

    if (firstError?.message?.includes('429') || firstError?.message?.includes('quota')) {
      throw new Error('Gemini quota exceeded. Check your API key quota at https://ai.dev/rate-limit');
    }

    try {
      const retryResult = await model.generateContent(buildRefineRetryPrompt(sectionText, profile, mode));
      const raw = retryResult.response.text().trim();
      const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
      return JSON.parse(cleaned);
    } catch (retryError) {
      console.error('[Gemini Refine] Retry error:', retryError?.message || retryError);
      throw new Error('Gemini section refinement failed after retry. Please try again.');
    }
  }
}

module.exports = { refineSectionText };
