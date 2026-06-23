const express = require('express');
const cors = require('cors');
require('dotenv').config();

const analyzeRouter = require('./routes/analyze');
const refineSectionRouter = require('./routes/refineSection');
const applySuggestionRouter = require('./routes/applySuggestion');
const extractPdfRouter = require('./routes/extractPdf');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/health', (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

app.use('/api/analyze', analyzeRouter);
app.use('/api/refine-section', refineSectionRouter);
app.use('/api/apply-suggestion', applySuggestionRouter);
app.use('/api/extract-pdf', extractPdfRouter);

app.listen(PORT, () => {
  console.log(`[Research Copilot] Server running on http://localhost:${PORT}`);
});

module.exports = app;
