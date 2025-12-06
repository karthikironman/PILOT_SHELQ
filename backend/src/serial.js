require("dotenv-flow").config();
const { ReadlineParser } = require("@serialport/parser-readline");
const { SerialPort } = require("serialport");

const db = require("./db");

const PORT_NAME = process.env.PORT_NAME;
const BAUD_RATE = parseInt(process.env.BAUD_RATE || 9600);
const TIMEOUT_MS = parseInt(process.env.TIMEOUT_MS || 10000);
const PING = parseInt(process.env.PING || 10000);

console.log(
  `🔵 Connecting to serial port ${PORT_NAME} at baud rate ${BAUD_RATE}...`
);
const serialPort = new SerialPort(
  { path: PORT_NAME, baudRate: BAUD_RATE },
  (err) => {
    if (err) {
      console.error("❌ Error opening serial port:", err.message);
      // process.exit(1);
    }
  }
);

const parser = serialPort.pipe(new ReadlineParser({ delimiter: "\n" }));

async function applyCalibration(values) {
  const output = [];

  for (let i = 0; i < values.length; i++) {
    const row = await db.getLoadCell(i + 1);
    if (!row) {
      console.log("no calibration data for load cell", i + 1);
      output.push(0);
      continue;
    }

    const weight = (values[i] - row.offset) / row.multiplier;
    // console.log(`LoadCell ${i + 1}: Raw=${values[i]}, Offset=${row.offset}, Multiplier=${row.multiplier}, Calibrated=${weight}`);
    output.push(weight);
  }
  // console.log("Calibrated Weights:", output);
  return output;
}

async function sendNReadSerialData(command) {
  console.log("sendNReadSerialData command = ", command);
  return new Promise((resolve, reject) => {
    let receivedData = "";

    const onData = (data) => {
      receivedData = data.trim();
      parser.off("data", onData);
      resolve(receivedData);
    };

    parser.on("data", onData);
    serialPort.write(command.trim() + "\r", (err) => {
      if (err) {
        parser.off("data", onData);
        return reject("Error sending command: " + err.message);
      }
    });

    setTimeout(() => {
      parser.off("data", onData);
      reject("Timeout: No response from Arduino");
    }, TIMEOUT_MS);
  });
}

function extractDataInArray(response) {
  const match = response.match(/>([^<]*)<END>/);
  if (match && match[1]) {
    return match[1].split(",").map(Number);
  }
  return [];
}
async function pingAmplitudes(offset = false) {
  try {
    let amplitudes = await sendNReadSerialData("AMPLITUDES");
    console.log("Raw amplitudes response:", amplitudes);
    amplitudes = extractDataInArray(amplitudes);
    if (amplitudes.length > 0) {
      if (offset === false) {
        let calibratedAmp = await applyCalibration(amplitudes);
        for (let i = 0; i < calibratedAmp.length; i++) {
          // console.log(`Updating LoadCell ${i + 1} with weight ${calibratedAmp[i]}`);
          await db.updateWeight(i + 1, calibratedAmp[i]);
        }
      } else {
        return await updateAllOffsets(amplitudes, db);
      }
    } else {
      console.log("No valid amplitude data received.");
    }
  } catch (err) {
    console.error("Error reading amplitudes:", err);
  }
}

// Function signature assumed to be async
async function updateAllOffsets(amplitudes, db) {
  // 1. Create an array of Promises for all update operations.
  // We map each amplitude to an update call, which returns a Promise.
  const updatePromises = amplitudes.map((offset, index) => {
    const id = index + 1; // LoadCell IDs are 1-based
    
    // Log before starting the operation (optional)
    console.log(`Starting update for LoadCell ${id} with offset ${offset}`); 
    
    // Return the Promise object
    return db.updateOffset(id, offset);
  });

  // 2. Wait for ALL promises to complete.
  // This executes all database calls concurrently.
  try {
    await Promise.all(updatePromises);
    console.log(`Successfully updated all ${amplitudes.length} LoadCells.`);
  } catch (error) {
    console.error("One or more load cell updates failed:", error);
    // You can handle partial successes or rethrow the error here
    throw error;
  }
}

let running = false;
async function loopMeasurements(offset = false) {
  running = true;
  while (running) {
    try {
      await pingAmplitudes((offset = false));
    } catch (err) {
      console.error("❌ Error reading amplitudes:", err);
    }
    await new Promise((resolve) => setTimeout(resolve, PING)); // Small delay}
  }
}

function startCollectingMeasurements(offset = false) {
  if (!running) {
    // console.log("Sensor Processing Started");
    loopMeasurements(offset).catch((err) => {
      console.error("Error in measurement loop:", err);
      running = false;
    });
  }
}

function stopCollectingMeasurements() {
  console.log("🔴 Stopping Sensor Processing...");
  running = false;
}

// Handle process termination
process.on("SIGINT", async () => {
  console.log("🔴 Closing connections...");
  serialPort.close(() => console.log("🔴 Serial port closed."));
  process.exit(0);
});

module.exports = {
  startCollectingMeasurements,
  stopCollectingMeasurements,
  pingAmplitudes
};
