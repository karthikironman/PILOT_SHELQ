require("dotenv-flow").config();
const sqlite3 = require("sqlite3").verbose();

const DB_PATH = process.env.DB_PATH || "./data/app.db";

const dummyCalibrationData = [
  { load_cell_id: 1, offset: 10, multiplier: 0.5 },
  { load_cell_id: 2, offset: 20, multiplier: 0.6 },
  { load_cell_id: 3, offset: 15, multiplier: 0.55 },
  { load_cell_id: 4, offset: 18, multiplier: 0.52 },
  { load_cell_id: 5, offset: 12, multiplier: 0.58 },
  { load_cell_id: 6, offset: 22, multiplier: 0.6 },
  { load_cell_id: 7, offset: 25, multiplier: 0.62 },
  { load_cell_id: 8, offset: 14, multiplier: 0.54 },
  { load_cell_id: 9, offset: 16, multiplier: 0.53 },
  { load_cell_id: 10, offset: 19, multiplier: 0.59 },
];

async function insertDummyData() {
  const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
      console.error("❌ Could not connect to database:", err.message);
      process.exit(1);
    }
  });

  // Wrap sqlite3 calls with Promise to use async/await
  function runAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve(this);
      });
    });
  }

  try {
    // Create table if not exists (adjust columns to match your schema)
    await runAsync(`
      CREATE TABLE IF NOT EXISTS load_cells (
        load_cell_id INTEGER PRIMARY KEY,
        offset REAL NOT NULL,
        multiplier REAL NOT NULL
      )
    `);

    // Clear existing data (optional)
    await runAsync(`DELETE FROM load_cells`);

    // Insert dummy data
    for (const { load_cell_id, offset, multiplier } of dummyCalibrationData) {
      await runAsync(
        `INSERT INTO load_cells (load_cell_id, offset, multiplier) VALUES (?, ?, ?)`,
        [load_cell_id, offset, multiplier]
      );
      console.log(`Inserted calibration for load cell ${load_cell_id}`);
    }

    console.log("✅ Dummy calibration data inserted successfully.");
  } catch (err) {
    console.error("❌ Error inserting dummy data:", err.message);
  } finally {
    db.close();
  }
}

// Run the insertion script
insertDummyData();
