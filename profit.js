const fs = require('fs');
const path = require('path');

const STOP_WORDS = new Set([
  'VULPINE',
  'THE',
  'AT',
  'CABINET',
  'CABINETS',
  'SUPPLY',
  'BID',
  'QUOTE',
  'PROPOSAL',
  'FINAL',
  'REVISED',
  'PREMIUM',
  'PACKAGE',
  'PROJECT',
  'TURNKEY',
  'FRAMED',
  'WHITE',
  'SHAKER',
  'PDF',
]);

function cleanupName(raw) {
  return String(raw || '')
    .replace(/\.pdf$/i, '')
    .replace(/([A-Za-z])(\d)/g, '$1 $2')
    .replace(/(\d)([A-Za-z])/g, '$1 $2')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeForMatch(raw) {
  const clean = cleanupName(raw)
    .toUpperCase()
    .replace(/&/g, ' AND ')
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const tokens = clean.split(' ').filter(Boolean).filter((token) => !STOP_WORDS.has(token));
  return tokens.join(' ');
}

function tokenize(value) {
  return new Set(normalizeForMatch(value).split(' ').filter(Boolean));
}

function scoreCandidate(left, right) {
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) return 0.95;

  const a = tokenize(left);
  const b = tokenize(right);
  if (a.size === 0 || b.size === 0) return 0;

  let overlap = 0;
  for (const token of a) {
    if (b.has(token)) overlap += 1;
  }

  const maxRatio = overlap / Math.max(a.size, b.size);
  const minRatio = overlap / Math.min(a.size, b.size);
  return Math.max(maxRatio, minRatio * 0.92);
}

function loadProfitIndex(csvPath = path.join(__dirname, 'uploads', 'project_profits.csv')) {
  if (!fs.existsSync(csvPath)) {
    return [];
  }

  const raw = fs.readFileSync(csvPath, 'utf8').split(/\r?\n/).filter(Boolean);
  const rows = [];

  for (let i = 1; i < raw.length; i += 1) {
    const line = raw[i].trim();
    if (!line) continue;

    const match = line.match(/^(.*?),\s*(-?\d+(?:\.\d+)?)$/);
    if (!match) continue;

    const projectName = match[1].trim();
    const profit = Number.parseFloat(match[2]);
    if (!Number.isFinite(profit)) continue;

    rows.push({
      project_name: projectName,
      normalized: normalizeForMatch(projectName),
      profit,
    });
  }

  return rows;
}

function findProfitMatch(index, projectName, filename) {
  const projectNorm = normalizeForMatch(projectName);
  const fileNorm = normalizeForMatch(filename);

  let best = null;
  let bestScore = 0;

  for (const row of index) {
    const projectScore = scoreCandidate(projectNorm, row.normalized);
    const fileScore = scoreCandidate(fileNorm, row.normalized);
    const score = Math.max(projectScore, fileScore);

    if (score > bestScore) {
      best = row;
      bestScore = score;
    }
  }

  if (!best || bestScore < 0.45) {
    return null;
  }

  return { ...best, score: bestScore };
}

function enrichBidFromProfitIndex(extractedBid, filename, index) {
  const match = findProfitMatch(index, extractedBid.project_name, filename);
  if (!match) {
    return { ...extractedBid, projected_profit: null };
  }

  return {
    ...extractedBid,
    project_name: match.project_name,
    projected_profit: match.profit,
  };
}

module.exports = {
  cleanupName,
  normalizeForMatch,
  loadProfitIndex,
  findProfitMatch,
  enrichBidFromProfitIndex,
};
