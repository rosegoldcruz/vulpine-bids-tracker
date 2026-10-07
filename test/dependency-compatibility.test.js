const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const XLSX = require('xlsx');
const express = require('express');
const multer = require('multer');
const { extractWorkbookMetrics } = require('../workbook');

test('workbook library preserves bid amounts and unit totals from XLSX files', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tracker-workbook-'));
  try {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      ['Unit Type', 'Qty'],
      ['Type A', 10],
      ['Type B', 20],
      ['Grand Total', 24000],
    ]);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Estimate');
    const filename = path.join(directory, 'estimate.xlsx');
    XLSX.writeFile(workbook, filename);
    assert.deepEqual(extractWorkbookMetrics(filename), { bid_amount: 24000, units: 30 });
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('multipart memory uploads preserve the single-PDF API', async () => {
  const app = express();
  const upload = multer({ storage: multer.memoryStorage() });
  app.post('/upload', upload.single('pdf'), (req, res) => {
    res.json({ size: req.file.size, type: req.file.mimetype, contents: req.file.buffer.toString() });
  });
  app.use((error, req, res, next) => res.status(400).json({ code: error.code }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const endpoint = `http://127.0.0.1:${server.address().port}/upload`;
  try {
    const pdf = '%PDF-1.7\nfixture';
    const valid = new FormData();
    valid.append('pdf', new Blob([pdf], { type: 'application/pdf' }), 'estimate.pdf');
    const accepted = await fetch(endpoint, { method: 'POST', body: valid });
    assert.equal(accepted.status, 200);
    assert.deepEqual(await accepted.json(), { size: Buffer.byteLength(pdf), type: 'application/pdf', contents: pdf });

    const duplicate = new FormData();
    duplicate.append('pdf', new Blob([pdf], { type: 'application/pdf' }), 'one.pdf');
    duplicate.append('pdf', new Blob([pdf], { type: 'application/pdf' }), 'two.pdf');
    const rejected = await fetch(endpoint, { method: 'POST', body: duplicate });
    assert.equal(rejected.status, 400);
    assert.equal((await rejected.json()).code, 'LIMIT_UNEXPECTED_FILE');
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
