// const db = require("./db");

// async function run() {
//     console.log("Setting up DB...");

//     for (let i = 1; i <= 36; i++) {
//         await db.insertLoadCell(i, 0, 1.0, 0); // offset = 0, multiplier = 1
//     }

//     console.log("Loadcells inserted!");
// }

// run();

const fs = require("fs");
const path = require("path");
const db = require("./db");

async function run() {
  console.log("Setting up DB...");

  // Read JSON file - adjust path if needed
  const filePath = path.join(__dirname, "..", "shelq.loadcells.json"); // assuming setup.js is in src/

  let data;
  try {
    const jsonData = fs.readFileSync(filePath, "utf8");
    data = JSON.parse(jsonData);
  } catch (err) {
    console.error("Failed to read or parse JSON file:", err);
    return;
  }

  for (const doc of data) {
    // Use data_order as id, default to some number if missing
    const id = doc.data_order || 0;
    const offset = doc.offset || 0;
    const multiplier = doc.multiplier || 1.0;

    console.log(`Inserting LoadCell id=${id} offset=${offset} multiplier=${multiplier}`);
    await db.insertLoadCell(id, offset, multiplier, 0);
  }

  console.log("Loadcells inserted!");
}

run();
