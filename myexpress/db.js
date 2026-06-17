import path from 'path';
import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const databasePath = path.join(__dirname, 'database.sqlite');

const sqlite3Verbose = sqlite3.verbose();
const db = new sqlite3Verbose.Database(databasePath, (error) => {
  if (error) {
    console.error('Failed to connect to SQLite:', error.message);
    return;
  }
  console.log(`Connected to SQLite database at ${databasePath}`);
});

db.run('PRAGMA foreign_keys = ON');

export default db;