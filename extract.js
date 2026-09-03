const { PDFParse } = require('pdf-parse');

// Company suffixes we look for to guess the contractor/GC name
const COMPANY_SUFFIXES = [
  'LLC', 'L.L.C.', 'Inc', 'Inc.', 'Incorporated', 'Corp', 'Corp.', 'Corporation',
  'Company', 'Co.', 'Construction', 'Contracting', 'Builders', 'Group',
  'Homes', 'Communities', 'Development', 'Developments', 'Partners'
];

function guessCompanyName(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const suffixPattern = new RegExp(
    `\\b([A-Z][A-Za-z0-9&.,'\\- ]{2,60}\\b(?:${COMPANY_SUFFIXES.map(s => s.replace('.', '\\.')).join('|')}))\\b`
  );
  for (const line of lines) {
    const match = line.match(suffixPattern);
    if (match) return match[1].trim();
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
  // Find all dollar amounts, prefer ones near "total"
  const totalLine = text.match(/total[^\n$]{0,40}\$\s?([\d,]+\.?\d{0,2})/i);
  if (totalLine) return parseFloat(totalLine[1].replace(/,/g, ''));

  const allAmounts = [...text.matchAll(/\$\s?([\d,]{4,}\.?\d{0,2})/g)]
    .map(m => parseFloat(m[1].replace(/,/g, '')))
    .filter(n => !isNaN(n));

  if (allAmounts.length === 0) return null;
  return Math.max(...allAmounts);
}

function guessUnits(text) {
  const match = text.match(/(\d{1,4})\s*(?:total\s*)?units?\b/i);
  if (match) return parseInt(match[1], 10);
  return null;
}

async function extractFromPdf(buffer, filename) {
  let text = '';
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

  return {
    project_name: guessProjectName(text, filename),
    company_name: guessCompanyName(text),
    units: guessUnits(text),
    bid_amount: guessBidAmount(text),
    raw_text: text.slice(0, 20000), // keep a copy for reference/debugging
    needs_review: text.trim().length === 0
  };
}

module.exports = { extractFromPdf };
