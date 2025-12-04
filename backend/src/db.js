require("dotenv-flow").config();
const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");
const path = require("path");

const DB_PATH = process.env.DB_PATH;

// Ensure data folder exists
const folder = path.dirname(DB_PATH);
if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) console.error("DB Connection Error:", err);
  else console.log("SQLite connected:", DB_PATH);
});

// Create table if not exists
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS loadcells (
      id INTEGER PRIMARY KEY,
      offset REAL NOT NULL,
      multiplier REAL NOT NULL,
      weight REAL DEFAULT 0
    )
    `);
});

function getLoadCell(id) {
  return new Promise((resolve, reject) => {
    db.get("SELECT * FROM loadcells WHERE id = ?", [id], (err, row) => {
      if (err) reject(err);
      resolve(row);
    });
  });
}

function insertLoadCell(id, offset, multiplier, weight) {
  return new Promise((resolve, reject) => {
    db.run(
      "INSERT OR REPLACE INTO loadcells (id, offset, multiplier, weight) VALUES (?, ?, ?, ?)",
      [id, offset, multiplier, weight],
      (err) => {
        if (err) reject(err);
        resolve();
      }
    );
  });
}

function updateWeight(id, weight) {
  return new Promise((resolve, reject) => {
    db.run(
      "UPDATE loadcells SET weight = ? WHERE id = ?",
      [weight, id],
      function (err) {
        if (err) reject(err);
        else resolve(this.changes);  // number of rows updated
      }
    );
  });
}

function updateOffset(id, offset) {
  return new Promise((resolve, reject) => {
    db.run(
      "UPDATE loadcells SET offset = ? WHERE id = ?",
      [offset, id],
      function (err) {
        if (err) reject(err);
        else resolve(this.changes);
      }
    );
  });
}


module.exports = {
  getLoadCell,
  insertLoadCell,
  updateOffset,
  updateWeight
};
