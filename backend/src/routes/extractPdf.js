const express = require('express');
const multer = require('multer');
const { PDFParse, PasswordException } = require('pdf-parse');
const { HttpError } = require('../errors');
const { cleanPdfText } = require('../manuscript/pdfText');

const MAX_PDF_BYTES = 10 * 1024 * 1024;
const MAX_PAGES = 40;
const MIN_TEXT_CHARS = 200;

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PDF_BYTES, files: 1 },
});

async function readPages(buffer) {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText({ first: MAX_PAGES, pageJoiner: '' });
    return { pages: result.pages.map((page) => page.text), total: result.total };
  } catch (err) {
    if (err instanceof PasswordException) {
      throw new HttpError(422, 'This PDF is password-protected. Remove the password or paste the text instead.');
    }
    throw new HttpError(422, 'This PDF could not be read. It may be damaged. Paste the text instead.');
  } finally {
    await parser.destroy();
  }
}

router.post('/', upload.single('pdf'), async (req, res) => {
  if (!req.file) {
    throw new HttpError(400, 'No file was uploaded.');
  }
  // The MIME type is whatever the client claims, so check the file signature.
  if (!req.file.buffer.subarray(0, 1024).includes('%PDF-')) {
    throw new HttpError(415, 'That file is not a PDF. Export the document as PDF or paste the text.');
  }

  const { pages, total } = await readPages(req.file.buffer);
  const text = cleanPdfText(pages);
  if (text.replace(/\s/g, '').length < MIN_TEXT_CHARS) {
    throw new HttpError(422, 'No selectable text was found in this PDF. Scanned papers are not supported; paste the text instead.');
  }

  res.json({ text, pages: total, truncated: total > MAX_PAGES });
});

module.exports = router;
