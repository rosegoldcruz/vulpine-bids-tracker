const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'data', 'bids.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS bids (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_name TEXT,
    company_name TEXT,
    units INTEGER,
    bid_amount REAL,
    sent_date TEXT,
    status TEXT DEFAULT 'Sent',
    filename TEXT,
    raw_text TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )
`);

module.exports = db;
