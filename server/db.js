import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, 'database.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Could not connect to database', err);
  } else {
    console.log('Connected to SQLite database');
  }
});

// Initialize Tables
db.serialize(() => {
  // Projects Table
  db.run(`CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    data TEXT,
    updated_at INTEGER
  )`);

  // Global Characters Table
  db.run(`CREATE TABLE IF NOT EXISTS characters (
    id TEXT PRIMARY KEY,
    data TEXT
  )`);

  // Settings Table (Single row)
  db.run(`CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    data TEXT
  )`);
});

export const getProjects = () => {
  return new Promise((resolve, reject) => {
    db.all("SELECT data FROM projects ORDER BY updated_at DESC", [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows.map(row => JSON.parse(row.data)));
    });
  });
};

export const saveProject = (project) => {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare("INSERT OR REPLACE INTO projects (id, data, updated_at) VALUES (?, ?, ?)");
    stmt.run(project.id, JSON.stringify(project), project.updatedAt, (err) => {
      if (err) reject(err);
      else resolve();
    });
    stmt.finalize();
  });
};

export const deleteProject = (id) => {
  return new Promise((resolve, reject) => {
    db.run("DELETE FROM projects WHERE id = ?", [id], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};

export const getCharacters = () => {
  return new Promise((resolve, reject) => {
    db.all("SELECT data FROM characters", [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows.map(row => JSON.parse(row.data)));
    });
  });
};

export const saveCharacters = (chars) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run("DELETE FROM characters"); // Simple replace all for library sync
      const stmt = db.prepare("INSERT INTO characters (id, data) VALUES (?, ?)");
      chars.forEach(char => {
        stmt.run(char.id, JSON.stringify(char));
      });
      stmt.finalize((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
};

export const getSettings = () => {
  return new Promise((resolve, reject) => {
    db.get("SELECT data FROM settings WHERE id = 1", (err, row) => {
      if (err) reject(err);
      else resolve(row ? JSON.parse(row.data) : null);
    });
  });
};

export const saveSettings = (settings) => {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare("INSERT OR REPLACE INTO settings (id, data) VALUES (1, ?)");
    stmt.run(JSON.stringify(settings), (err) => {
      if (err) reject(err);
      else resolve();
    });
    stmt.finalize();
  });
};

export default db;