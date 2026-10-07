const multer = require('multer');

// Match the existing API upload contract; one PDF is accepted per request.
const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 250 * 1024 * 1024, files: 1, fields: 16, fieldSize: 1024 * 1024, parts: 17 },
  fileFilter(_request, file, callback) {
    if (!file.originalname.toLowerCase().endsWith('.pdf') || file.mimetype !== 'application/pdf') {
      const error = new Error('A PDF file is required.');
      error.code = 'INVALID_PDF';
      return callback(error);
    }
    callback(null, true);
  },
});

function hasPdfSignature(buffer) {
  return Buffer.isBuffer(buffer) && buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-';
}

module.exports = { pdfUpload, hasPdfSignature };
