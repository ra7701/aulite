import Database from "better-sqlite3";
import { logger } from "../utils/logger.js";

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS audit_entries (
  id              TEXT PRIMARY KEY,
  sequence        INTEGER NOT NULL UNIQUE,
  timestamp       TEXT NOT NULL,
  prev_hash       TEXT NOT NULL,
  entry_hash      TEXT NOT NULL,

  request_body    TEXT NOT NULL,
  response_body   TEXT,

  provider        TEXT NOT NULL,
  model           TEXT,

  risk_score      REAL NOT NULL DEFAULT 0,
  risk_level      TEXT NOT NULL DEFAULT 'none',
  action_taken    TEXT NOT NULL DEFAULT 'pass',
  checks_json     TEXT NOT NULL DEFAULT '[]',
  domains         TEXT NOT NULL DEFAULT '[]',

  client_id       TEXT,
  metadata        TEXT
);

CREATE INDEX IF NOT EXISTS idx_timestamp ON audit_entries(timestamp);
CREATE INDEX IF NOT EXISTS idx_risk_level ON audit_entries(risk_level);
CREATE INDEX IF NOT EXISTS idx_action ON audit_entries(action_taken);
CREATE INDEX IF NOT EXISTS idx_sequence ON audit_entries(sequence);
CREATE INDEX IF NOT EXISTS idx_risk_score ON audit_entries(risk_score);
CREATE INDEX IF NOT EXISTS idx_provider_model ON audit_entries(provider, model);

-- Normalized check details for efficient dashboard queries
CREATE TABLE IF NOT EXISTS check_details (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  audit_entry_id  TEXT NOT NULL,
  check_type      TEXT NOT NULL,
  category        TEXT NOT NULL,
  risk_score      REAL NOT NULL,
  article_ref     TEXT,
  flagged_content TEXT,
  FOREIGN KEY (audit_entry_id) REFERENCES audit_entries(id)
);

CREATE INDEX IF NOT EXISTS idx_check_entry ON check_details(audit_entry_id);
CREATE INDEX IF NOT EXISTS idx_check_category ON check_details(category);
CREATE INDEX IF NOT EXISTS idx_check_type ON check_details(check_type);
CREATE INDEX IF NOT EXISTS idx_check_score ON check_details(risk_score);
`;

const MIGRATIONS = [
  "ALTER TABLE audit_entries ADD COLUMN domains TEXT NOT NULL DEFAULT '[]'",
];

export function initDatabase(dbPath: string): Database.Database {
  const db = new Database(dbPath);

  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("foreign_keys = ON");

  db.exec(SCHEMA_SQL);

  for (const sql of MIGRATIONS) {
    try {
      db.exec(sql);
    } catch {
      // Column/table already exists — ignore
    }
  }

  logger.debug("Database initialized", { path: dbPath });
  return db;
}
