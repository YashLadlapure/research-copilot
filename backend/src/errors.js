class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function notFound(req, res) {
  res.status(404).json({ error: `No route for ${req.method} ${req.path}.` });
}

// Express identifies error middleware by its four-argument signature.
function errorHandler(err, req, res, _next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, code: err.code });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Request body is not valid JSON.' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body is too large.' });
  }
  if (err.name === 'MulterError') {
    const tooLarge = err.code === 'LIMIT_FILE_SIZE';
    return res.status(tooLarge ? 413 : 400).json({
      error: tooLarge ? 'That PDF is too large. The limit is 10 MB.' : 'Upload a single PDF in the "pdf" field.',
    });
  }

  console.error(err);
  return res.status(500).json({ error: 'Something went wrong on the server.' });
}

module.exports = { HttpError, notFound, errorHandler };
