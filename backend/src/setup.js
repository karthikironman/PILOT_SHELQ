const db = require("./db");

async function run() {
    console.log("Setting up DB...");

    for (let i = 1; i <= 32; i++) {
        await db.insertLoadCell(i, 0, 1.0); // offset = 0, multiplier = 1
    }

    console.log("Loadcells inserted!");
}

run();
