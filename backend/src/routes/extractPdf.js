const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const data = await pdfParse(req.file.buffer);
    res.json({ text: data.text });
  } catch (err) {
    console.error('[extract-pdf]', err.message);
    res.status(500).json({ error: 'PDF extraction failed' });
  }
});

module.exports = router;
