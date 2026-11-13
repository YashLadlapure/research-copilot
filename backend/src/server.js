require('dotenv').config();

const app = require('./app');
const { isConfigured } = require('./ai/geminiClient');

const port = process.env.PORT || 4000;

app.listen(port, () => {
  console.log(`Research Copilot API listening on port ${port}`);
  if (!isConfigured()) {
    console.warn('GEMINI_API_KEY is not set. Analysis will use rule-based parsing only and refinement is disabled.');
  }
});
