const express = require('express');
const cors = require('cors');
require('dotenv').config();

const analyzeRouter = require('./routes/analyze');
const reanalyzeRouter = require('./routes/reanalyze');
const refineSectionRouter = require('./routes/refineSection');
const applySuggestionRouter = require('./routes/applySuggestion');
const extractPdfRouter = require('./routes/extractPdf');
const bonusTipsRouter = require('./routes/bonusTips');
const exportSummaryRouter = require('./routes/exportSummary');

const app = express();
const PORT = process.env.PORT || 4000;

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://localhost:3000'];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.some(o => origin.startsWith(o.trim()))) {
      cb(null, true);
    } else {
      cb(new Error(`CORS: origin ${origin} not allowed`));
    }
  },
}));
app.use(express.json({ limit: '10mb' }));

app.get('/health', (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

app.use('/api/analyze', analyzeRouter);
app.use('/api/reanalyze', reanalyzeRouter);
app.use('/api/refine-section', refineSectionRouter);
app.use('/api/apply-suggestion', applySuggestionRouter);
app.use('/api/extract-pdf', extractPdfRouter);
app.use('/api/bonus-tips', bonusTipsRouter);
app.use('/api/export-summary', exportSummaryRouter);

app.listen(PORT, () => {
  console.log(`[Research Copilot] Server running on http://localhost:${PORT}`);
});

module.exports = app;
