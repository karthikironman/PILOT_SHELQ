require("dotenv-flow").config();
const express = require("express");
const cors = require("cors");
const { startCollectingMeasurements, stopCollectingMeasurements, pingAmplitudes } = require("./serial");

const PORT = process.env.API_PORT || 3001;

const app = express();

// CORS settings: allow all origins
app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
}));

app.options("*", cors());
app.use(express.json());


startCollectingMeasurements()


app.listen(PORT, () => {
    console.log(`API running at http://localhost:${PORT}`);
});
//i wanted a route to get weights
const db = require("./db");
app.get("/weights", async (req, res) => {
    try {
        const weights = [];
        for (let i = 1; i <= 36; i++) {
            const row = await db.getLoadCell(i);
            // console.log(`LoadCell ${i}: Weight=${row ? row.weight : null}`);
            weights.push({
                load_cell_id: i,
                weight: row ? row.weight : null,
                offset: row ? row.offset : null,
            });
        }   
        // console.log("Weights fetched:", weights);
        res.json(weights);
    } catch (err) {
        console.error("Error fetching weights:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.post("/calibrate", async (req, res) => {
    try {
        stopCollectingMeasurements();
        await pingAmplitudes(true);
        startCollectingMeasurements();
        res.json({ message: "Calibration triggered" });
    } catch (err) {
        console.error("Error during calibration:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }       
});