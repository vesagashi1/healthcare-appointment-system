const path = require("path");
require("dotenv").config({
  path: path.resolve(__dirname, "..", ".env"),
});

const express = require("express");
const cors = require("cors");

const patientRoutes = require("./routes/patient.routes");
const appointmentRoutes = require("./routes/appointment.routes");
const doctorRoutes = require("./routes/doctor.routes");
const wardRoutes = require("./routes/ward.routes");
const nurseRoutes = require("./routes/nurse.routes");
const adminRoutes = require("./routes/admin.routes");
const caregiverRoutes = require("./routes/caregiver.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const exportRoutes = require("./routes/export.routes");
const importRoutes = require("./routes/import.routes");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.status(200).send("Healthcare API is running");
});

const authRoutes = require("./routes/auth.routes");
const testRoutes = require("./routes/test.routes");

app.use("/api/auth", authRoutes);
app.use("/api/test", testRoutes);
app.use("/api/patients", patientRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/doctors", doctorRoutes);
app.use("/api/wards", wardRoutes);
app.use("/api/nurses", nurseRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/caregivers", caregiverRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/export", exportRoutes);
app.use("/api/import", importRoutes);



const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
