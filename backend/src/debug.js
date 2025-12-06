// -----------------------------
//  SIMPLE ARDUINO SERIAL DEBUGGER
// -----------------------------

const { SerialPort } = require("serialport");
const { ReadlineParser } = require("@serialport/parser-readline");

// --------- CONFIG -----------
const PORT = process.env.PORT_NAME || "COM5";     // Change for Raspberry Pi e.g. "/dev/ttyUSB0"
const BAUD = parseInt(process.env.BAUD_RATE || 9600);
const TIMEOUT_MS = 10000;

// ----------------------------

console.log(`🔵 Opening serial port ${PORT} at ${BAUD} baud...`);

const serialPort = new SerialPort(
  { path: PORT, baudRate: BAUD },
  (err) => {
    if (err) {
      console.error("❌ Failed to open port:", err.message);
    } else {
      console.log("✅ Serial port opened successfully.");
    }
  }
);

const parser = serialPort.pipe(new ReadlineParser({ delimiter: "\n" }));

// -----------------------------
// SEND COMMAND + WAIT FOR RESPONSE
// -----------------------------
async function sendCommand(cmd) {
  console.log(`\n🚀 Sending command: "${cmd}"`);

  return new Promise((resolve, reject) => {
    let timeoutHandle;

    const onData = (data) => {
      console.log("📥 Received from Arduino:", JSON.stringify(data));
      clearTimeout(timeoutHandle);
      parser.off("data", onData);
      resolve(data.trim());
    };

    parser.on("data", onData);

    serialPort.write(cmd + "\r", (err) => {
      if (err) {
        parser.off("data", onData);
        clearTimeout(timeoutHandle);
        return reject("❌ Write error: " + err.message);
      }
      console.log("📤 Command written.");
    });

    timeoutHandle = setTimeout(() => {
      parser.off("data", onData);
      reject("⏳ TIMEOUT: No response from Arduino.");
    }, TIMEOUT_MS);
  });
}

// -----------------------------
// MAIN DEBUG TEST
// -----------------------------
async function run() {
  console.log("⏳ Waiting 2 seconds for Arduino to reset...");
  await new Promise((r) => setTimeout(r, 2000));

  try {
    const response = await sendCommand("AMPLITUDES");
    console.log("🎉 FINAL RESPONSE:", response);
  } catch (err) {
    console.error("❌ ERROR:", err);
  }

  console.log("🔴 Closing serial port...");
  serialPort.close(() => console.log("🔴 Port closed."));
}

run();

// -----------------------------
// CLEAN EXIT HANDLER
// -----------------------------
process.on("SIGINT", () => {
  console.log("\n🔴 Ctrl+C received. Closing port...");
  serialPort.close(() => process.exit(0));
});
