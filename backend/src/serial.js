require("dotenv-flow").config();
const { SerialPort } = require("serialport");
const { ReadlineParser } = require("@serialport/parser-readline");
const db = require("./db");

const PORT_NAME = process.env.PORT_NAME;
const BAUD_RATE = parseInt(process.env.BAUD_RATE || "115200");

let port, parser;

function initSerial(onData) {
    console.log("Opening serial:", PORT_NAME);

    port = new SerialPort({
        path: PORT_NAME,
        baudRate: BAUD_RATE
    });

    parser = port.pipe(new ReadlineParser({ delimiter: "</END>" }));

    parser.on("data", async (raw) => {
        console.log("RAW:", raw);

        if (!raw.includes("<AMPLITUDES>")) return;

        const dataPart = raw.replace("<AMPLITUDES>", "").trim();
        const values = dataPart.split(",").map(Number);

        const calibrated = await applyCalibration(values);

        onData(calibrated);
    });

    port.on("error", (err) => console.log("Serial error:", err));
}

async function applyCalibration(values) {
    const output = [];

    for (let i = 0; i < values.length; i++) {
        const row = await db.getLoadCell(i + 1);
        if (!row) {
            output.push(0);
            continue;
        }

        const weight = (values[i] - row.offset) * row.multiplier;
        output.push(weight);
    }

    return output;
}

module.exports = { initSerial };
