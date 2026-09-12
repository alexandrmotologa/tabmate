import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';

let dbInstance: DatabaseSync | null = null;

export function getDatabase(dbPath?: string): DatabaseSync {
  if (dbInstance) {
    return dbInstance;
  }

  const targetPath =
    dbPath ||
    process.env.DATABASE_PATH ||
    path.join(process.cwd(), 'data', 'tabmate.db');

  const dir = path.dirname(targetPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new DatabaseSync(targetPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');

  // Initialize schema
  db.exec(`
    CREATE TABLE IF NOT EXISTS groups (
      id TEXT PRIMARY KEY,
      telegram_chat_id TEXT,
      title TEXT NOT NULL,
      currency TEXT NOT NULL DEFAULT 'EUR',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      telegram_user_id TEXT,
      name TEXT NOT NULL,
      username TEXT,
      revolut_handle TEXT,
      paypal_handle TEXT,
      monzo_handle TEXT,
      iban TEXT,
      avatar_color TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      paid_by_member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'EUR',
      category TEXT NOT NULL DEFAULT 'general',
      split_type TEXT NOT NULL DEFAULT 'equal',
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS expense_splits (
      id TEXT PRIMARY KEY,
      expense_id TEXT NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
      member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      amount REAL NOT NULL,
      share_count REAL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS settlements (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      from_member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      to_member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      amount REAL NOT NULL,
      payment_method TEXT DEFAULT 'revolut',
      notes TEXT,
      settled_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_members_group ON members(group_id);
    CREATE INDEX IF NOT EXISTS idx_expenses_group ON expenses(group_id);
    CREATE INDEX IF NOT EXISTS idx_splits_expense ON expense_splits(expense_id);
    CREATE INDEX IF NOT EXISTS idx_settlements_group ON settlements(group_id);
  `);

  // Safe migration for payment_method if table already existed
  try {
    db.exec(`ALTER TABLE settlements ADD COLUMN payment_method TEXT DEFAULT 'revolut';`);
  } catch {
    // Column already exists
  }

  dbInstance = db;
  return dbInstance;
}

export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
