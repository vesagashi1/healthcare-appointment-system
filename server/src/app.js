require("dotenv").config(); // MUST be first

const express = require("express");
const cors = require("cors");

const patientRoutes = require("./routes/patient.routes");


const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.status(200).send("Healthcare API is running");
});

// ROUTES FIRST
const authRoutes = require("./routes/auth.routes");
const testRoutes = require("./routes/test.routes");

app.use("/api/auth", authRoutes);
app.use("/api/test", testRoutes);
app.use("/api/patients", patientRoutes);


// LISTEN LAST
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
