require("dotenv-flow").config();
const express = require("express");
const cors = require("cors");
const { initSerial } = require("./serial");

const PORT = process.env.API_PORT || 3001;

const app = express();
app.use(cors());
app.use(express.json());

let latestWeights = [];

initSerial((weights) => {
    latestWeights = weights;
    console.log("WEIGHTS:", weights);
});

app.get("/weights", (req, res) => {
    res.json({ values: latestWeights });
});

app.listen(PORT, () => {
    console.log("API running at http://localhost:" + PORT);
});
