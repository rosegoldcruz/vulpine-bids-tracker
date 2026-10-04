const { PDFParse } = require('pdf-parse');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

// Company suffixes we look for to guess the contractor/GC name
const COMPANY_SUFFIXES = [
  'LLC', 'L.L.C.', 'Inc', 'Inc.', 'Incorporated', 'Corp', 'Corp.', 'Corporation',
  'Company', 'Co.', 'Construction', 'Contracting', 'Builders', 'Group',
  'Homes', 'Communities', 'Development', 'Developments', 'Partners'
];

function guessCompanyName(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  for (const line of lines) {
    const preparedFor = line.match(/prepared\s+for\s+(.{2,120})/i);
    if (preparedFor) {
      return preparedFor[1].trim();
    }
  }

  const suffixPattern = new RegExp(
    `\\b([A-Z][A-Za-z0-9&.,'\\- ]{2,60}\\b(?:${COMPANY_SUFFIXES.map(s => s.replace('.', '\\.')).join('|')}))\\b`
  );
  for (const line of lines) {
    const match = line.match(suffixPattern);
    if (match) return match[1].trim();
  }

  for (const line of lines) {
    if (
      /^[A-Z0-9 &.,'\-]{6,80}$/.test(line) &&
      !/cabinet|proposal|quote|bid|project|information|authorization|package|summary|product/i.test(line)
    ) {
      return line.trim();
    }
  }

  return 'Unknown — edit me';
}

function guessProjectName(text, filename) {
  // Try common phrasing Vulpine uses: "proposal for the X project" / "quote for X"
  const patterns = [
    /(?:proposal|quote|bid|package)\s+for\s+(?:the\s+)?([A-Z][A-Za-z0-9&.,'\- ]{3,60}?)(?:\s+project|\s+apartments?|\s+townhomes?|\.|\n)/i,
    /^([A-Z][A-Za-z0-9&.,'\- ]{3,60}?)\s*[-–|]\s*(?:Cabinet|Casework|Vulpine)/i
  ];
  for (const p of patterns) {
    const match = text.match(p);
    if (match) return match[1].trim();
  }
  // Fallback: clean up the filename
  return filename
    .replace(/\.pdf$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function guessBidAmount(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const parseAmount = (raw) => {
    const value = Number.parseFloat(String(raw).replace(/[$,\s]/g, ''));
    return Number.isFinite(value) && value >= 1000 ? value : null;
  };

  const totalLikeValues = [];
  for (const line of lines) {
    if (!/(grand\s+total|contract\s+price|total\s+price|total|investment\s+summary)/i.test(line)) {
      continue;
    }

    const explicitCurrency = [...line.matchAll(/\$\s*([0-9][0-9,]*(?:\.[0-9]{2})?)/g)];
    for (const m of explicitCurrency) {
      const parsed = parseAmount(m[1]);
      if (parsed !== null) totalLikeValues.push(parsed);
    }

    const commaNumbers = [...line.matchAll(/\b([0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]{2})?)\b/g)];
    for (const m of commaNumbers) {
      const parsed = parseAmount(m[1]);
      if (parsed !== null) totalLikeValues.push(parsed);
    }

    const decimals = [...line.matchAll(/\b([0-9]{4,}\.\d{2})\b/g)];
    for (const m of decimals) {
      const parsed = parseAmount(m[1]);
      if (parsed !== null) totalLikeValues.push(parsed);
    }
  }

  if (totalLikeValues.length > 0) {
    return Math.max(...totalLikeValues);
  }

  const currencyValues = [...text.matchAll(/\$\s*([0-9][0-9,]*(?:\.[0-9]{2})?)/g)]
    .map((m) => parseAmount(m[1]))
    .filter((n) => n !== null);
  if (currencyValues.length > 0) {
    return Math.max(...currencyValues);
  }

  const commaValues = [...text.matchAll(/\b([0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]{2})?)\b/g)]
    .map((m) => parseAmount(m[1]))
    .filter((n) => n !== null);
  if (commaValues.length > 0) {
    return Math.max(...commaValues);
  }

  return null;
}

function guessUnits(text) {
  const patterns = [
    /(?<![\d.])(\d{1,4})\s+total\s+units?(?:\s*(?:\/|and|&)\s*(?:amenity\s*)?areas?)?/i,
    /(?:units?\s*\/\s*areas?|total\s+units?\s*\/\s*areas?)\s*:?\s*(\d{1,4})\b/i,
    /(\d{1,4})\s+units?\s*\/\s*(?:amenity\s*)?areas?/i,
    /(\d{1,4})\s+units?\s+and\s+amenity\s+areas?/i,
    /(\d{1,4})-unit\s+takeoff/i,
    /(\d{1,4})\s+residences\b/i,
    /(?:total\s+units?|units?\s+qty)\s*[:\-]?\s*(\d{1,4})\b/i,
    /\btotal\s+(\d{1,4})\s+(?:-|\$)/i,
    /(\d{1,4})\s+units?\b/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return parseInt(match[1], 10);
  }
  return null;
}

function extractWithPdfToText(tmpPdfPath) {
  try {
    return execFileSync('pdftotext', [tmpPdfPath, '-'], {
      encoding: 'utf8',
      maxBuffer: 40 * 1024 * 1024,
    }) || '';
  } catch {
    return '';
  }
}

function extractWithOcr(tmpDir, tmpPdfPath) {
  try {
    const ppmPrefix = path.join(tmpDir, 'page');
    execFileSync('pdftoppm', ['-f', '1', '-l', '4', '-r', '220', '-png', tmpPdfPath, ppmPrefix], {
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
    });

    const pageImages = fs
      .readdirSync(tmpDir)
      .filter((f) => /^page-\d+\.png$/i.test(f))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    let combined = '';
    for (const imageName of pageImages) {
      const imagePath = path.join(tmpDir, imageName);
      try {
        const ocrText = execFileSync('tesseract', [imagePath, 'stdout', '--psm', '6'], {
          encoding: 'utf8',
          maxBuffer: 25 * 1024 * 1024,
        });
        combined += `\n${ocrText}`;
      } catch {
        // Keep going page-by-page; some pages can fail OCR while others work.
      }
    }

    return combined;
  } catch {
    return '';
  }
}

async function extractFromPdf(buffer, filename) {
  let text = '';
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vbt-ocr-'));
  const tmpPdfPath = path.join(tmpDir, 'upload.pdf');

  fs.writeFileSync(tmpPdfPath, buffer);

  try {
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    text = result.text || '';
    await parser.destroy();
  } catch (err) {
    // PDF had no extractable text layer (likely a scanned image).
    // Flagged for manual entry rather than failing the upload.
    text = '';
  }

  if (text.trim().length < 80) {
    text = extractWithPdfToText(tmpPdfPath);
  }

  if (text.trim().length < 80) {
    text = extractWithOcr(tmpDir, tmpPdfPath);
  }

  fs.rmSync(tmpDir, { recursive: true, force: true });

  return {
    project_name: guessProjectName(text, filename),
    company_name: guessCompanyName(text),
    units: guessUnits(text),
    bid_amount: guessBidAmount(text),
    raw_text: text.slice(0, 20000), // keep a copy for reference/debugging
    needs_review: text.trim().length === 0
  };
}

module.exports = { extractFromPdf, guessUnits };
