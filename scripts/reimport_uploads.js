const fs = require('fs');
const path = require('path');
const db = require('../db');
const { extractFromPdf } = require('../extract');
const { loadProfitIndex, enrichBidFromProfitIndex } = require('../profit');
const { loadWorkbookIndex, enrichBidFromWorkbookIndex } = require('../workbook');

const PDF_DIR = path.join(__dirname, '..', 'uploads', 'vulpine_pdfs');

function qualitySummary() {
  const rows = db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN raw_text IS NULL OR trim(raw_text) = '' THEN 1 ELSE 0 END) AS empty_text,
      SUM(CASE WHEN project_name IS NULL OR trim(project_name) = '' THEN 1 ELSE 0 END) AS empty_project,
      SUM(CASE WHEN company_name IS NULL OR trim(company_name) = '' OR company_name = 'Unknown — edit me' THEN 1 ELSE 0 END) AS unknown_company,
      SUM(CASE WHEN bid_amount IS NULL THEN 1 ELSE 0 END) AS missing_bid,
      SUM(CASE WHEN units IS NULL THEN 1 ELSE 0 END) AS missing_units,
      SUM(CASE WHEN projected_profit IS NULL THEN 1 ELSE 0 END) AS missing_profit
    FROM bids
  `).get();
  return rows;
}

async function run() {
  if (!fs.existsSync(PDF_DIR)) {
    throw new Error(`Missing PDF directory: ${PDF_DIR}`);
  }

  const files = fs
    .readdirSync(PDF_DIR)
    .filter((name) => name.toLowerCase().endsWith('.pdf'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const profitIndex = loadProfitIndex();
  const workbookIndex = loadWorkbookIndex();

  console.log(`Found ${files.length} PDF files.`);
  db.prepare('DELETE FROM bids').run();

  const insert = db.prepare(`
    INSERT INTO bids (project_name, company_name, units, bid_amount, sent_date, status, filename, raw_text, projected_profit)
    VALUES (?, ?, ?, ?, ?, 'Sent', ?, ?, ?)
  `);

  let imported = 0;
  let errors = 0;
  for (const name of files) {
    try {
      const full = path.join(PDF_DIR, name);
      const buffer = fs.readFileSync(full);
      const extracted = await extractFromPdf(buffer, name);
      const withProfit = enrichBidFromProfitIndex(extracted, name, profitIndex);
      const row = enrichBidFromWorkbookIndex(withProfit, name, workbookIndex);
      insert.run(
        row.project_name,
        row.company_name,
        row.units,
        row.bid_amount,
        new Date().toISOString().slice(0, 10),
        name,
        row.raw_text,
        row.projected_profit
      );
      imported += 1;
    } catch (error) {
      errors += 1;
      console.error(`Failed on ${name}:`, error.message);
    }
  }

  console.log({ imported, errors });
  console.log('Quality summary:', qualitySummary());
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
