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
    projected_profit REAL,
    created_at TEXT DEFAULT (datetime('now'))
  )
`);

const columns = db.prepare("PRAGMA table_info(bids)").all().map((c) => c.name);
if (!columns.includes('projected_profit')) {
  db.exec('ALTER TABLE bids ADD COLUMN projected_profit REAL');
}

const emailColumns = {
  sent_time: 'TEXT',
  sent_timezone: 'TEXT',
  recipient_name: 'TEXT',
  recipient_email: 'TEXT',
  email_subject: 'TEXT',
  gmail_message_id: 'TEXT',
  email_match_status: 'TEXT'
};

for (const [name, type] of Object.entries(emailColumns)) {
  if (!columns.includes(name)) db.exec(`ALTER TABLE bids ADD COLUMN ${name} ${type}`);
}

module.exports = db;
