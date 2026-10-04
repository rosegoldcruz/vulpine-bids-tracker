const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { normalizeForMatch, findProfitMatch } = require('./profit');

function cleanupWorkbookName(name) {
  return String(name || '')
    .replace(/\.xlsx$/i, '')
    .replace(/\(\d+\)\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function loadWorkbookIndex(workbookDir = path.join(__dirname, 'uploads', 'vulpine_workbooks')) {
  if (!fs.existsSync(workbookDir)) return [];

  return fs
    .readdirSync(workbookDir)
    .filter((f) => f.toLowerCase().endsWith('.xlsx'))
    .map((file) => {
      const projectName = cleanupWorkbookName(file);
      return {
        project_name: projectName,
        normalized: normalizeForMatch(projectName),
        workbook_path: path.join(workbookDir, file),
        profit: null,
      };
    });
}

function toNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Number.parseFloat(value.replace(/[$,\s]/g, ''));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function extractWorkbookMetrics(workbookPath) {
  try {
    const wb = XLSX.readFile(workbookPath, { cellDates: false });

    const bidCandidates = [];
    const unitCandidates = [];

    for (const sheetName of wb.SheetNames) {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, raw: true });

      for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
        const header = rows[rowIndex];
        if (!Array.isArray(header)) continue;
        const unitTypeIndex = header.findIndex((cell) => String(cell || '').trim().toLowerCase() === 'unit type');
        const qtyIndex = header.findIndex((cell) => String(cell || '').trim().toLowerCase() === 'qty');
        if (unitTypeIndex === -1 || qtyIndex === -1) continue;

        let quantityTotal = 0;
        for (let next = rowIndex + 1; next < Math.min(rows.length, rowIndex + 60); next += 1) {
          const candidateRow = rows[next];
          if (!Array.isArray(candidateRow)) continue;
          const unitType = String(candidateRow[unitTypeIndex] || '').trim();
          const quantity = toNumber(candidateRow[qtyIndex]);
          if (unitType && quantity !== null && Number.isInteger(quantity) && quantity > 0 && quantity <= 5000) {
            quantityTotal += quantity;
          }
        }
        if (quantityTotal > 0 && quantityTotal <= 5000) unitCandidates.push(quantityTotal);
      }

      for (const row of rows) {
        if (!Array.isArray(row)) continue;

        for (let i = 0; i < row.length; i += 1) {
          const cell = row[i];
          if (typeof cell !== 'string') continue;
          const lower = cell.toLowerCase();

          if (/(grand\s*total|contract\s*price|bid\s*total|proposal\s*total|total)/.test(lower)) {
            for (let j = i + 1; j < Math.min(row.length, i + 8); j += 1) {
              const n = toNumber(row[j]);
              if (n !== null && n >= 1000) bidCandidates.push(n);
            }
          }

        }
      }
    }

    const bid_amount = bidCandidates.length ? Math.max(...bidCandidates) : null;
    const units = unitCandidates.length ? Math.max(...unitCandidates) : null;

    return { bid_amount, units };
  } catch {
    return { bid_amount: null, units: null };
  }
}

function enrichBidFromWorkbookIndex(bid, filename, workbookIndex) {
  const match = findProfitMatch(workbookIndex, bid.project_name, filename);
  if (!match || !match.workbook_path) return bid;

  const metrics = extractWorkbookMetrics(match.workbook_path);
  return {
    ...bid,
    bid_amount: bid.bid_amount ?? metrics.bid_amount,
    units: bid.units ?? metrics.units,
  };
}

module.exports = {
  loadWorkbookIndex,
  enrichBidFromWorkbookIndex,
  extractWorkbookMetrics,
};
