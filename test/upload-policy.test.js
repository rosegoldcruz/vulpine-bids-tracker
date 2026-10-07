const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { pdfUpload, hasPdfSignature } = require('../upload-policy');

test('PDF signatures are checked before archive or processing', () => {
  assert.equal(hasPdfSignature(Buffer.from('%PDF-1.7\n')), true);
  assert.equal(hasPdfSignature(Buffer.from('<svg>')), false);
  assert.equal(hasPdfSignature(Buffer.alloc(0)), false);
});

test('multipart policy rejects mislabeled files and excessive fields', async () => {
  const app = express();
  app.post('/upload', pdfUpload.single('pdf'), (req, res) => res.json({ accepted: hasPdfSignature(req.file?.buffer) }));
  app.use((err, req, res, next) => res.status(400).json({ code: err.code }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const url = `http://127.0.0.1:${server.address().port}/upload`;
    for (const [name, type] of [['payload.svg', 'application/pdf'], ['payload.pdf', 'image/svg+xml']]) {
      const form = new FormData(); form.set('pdf', new Blob(['%PDF-1.7'], { type }), name);
      const response = await fetch(url, { method: 'POST', body: form });
      assert.equal(response.status, 400);
    }
    const form = new FormData();
    for (let i = 0; i < 17; i++) form.set(`field${i}`, 'value');
    assert.equal((await fetch(url, { method: 'POST', body: form })).status, 400);
    const valid = new FormData(); valid.set('pdf', new Blob(['%PDF-1.7'], { type: 'application/pdf' }), 'safe.pdf');
    const response = await fetch(url, { method: 'POST', body: valid });
    assert.equal(response.status, 200); assert.deepEqual(await response.json(), { accepted: true });
  } finally { await new Promise(resolve => server.close(resolve)); }
});
