const express = require('express');
const cors = require('cors');
const { rateLimit } = require('express-rate-limit');

const { GeminiError } = require('./ai/geminiClient');
const { HttpError, notFound, errorHandler } = require('./errors');
const analyzeRouter = require('./routes/analyze');
const reanalyzeRouter = require('./routes/reanalyze');
const refineSectionRouter = require('./routes/refineSection');
const applySuggestionRouter = require('./routes/applySuggestion');
const extractPdfRouter = require('./routes/extractPdf');

const TEN_MINUTES = 10 * 60 * 1000;

const allowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean),
);

function limiter(limit) {
  return rateLimit({
    windowMs: TEN_MINUTES,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many requests. Wait a few minutes and try again.' },
  });
}

const app = express();

// Render terminates TLS at one proxy; trusting it gives the limiter real client IPs.
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(cors({ origin: (origin, done) => done(null, !origin || allowedOrigins.has(origin)) }));
app.use(express.json({ limit: '1mb' }));

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

// Routes that call Gemini spend API quota, so they get the tighter limit.
app.use('/api', limiter(120));
app.use('/api/analyze', limiter(20), analyzeRouter);
app.use('/api/refine-section', limiter(30), refineSectionRouter);
app.use('/api/reanalyze', reanalyzeRouter);
app.use('/api/apply-suggestion', applySuggestionRouter);
app.use('/api/extract-pdf', extractPdfRouter);

app.use(notFound);
app.use((err, req, res, next) => {
  next(err instanceof GeminiError ? new HttpError(err.status, err.message) : err);
});
app.use(errorHandler);

module.exports = app;
