require("dotenv").config(); 

const express = require("express");
const cors = require("cors");
const http = require("http");
const { initSocket } = require("./socket/socketServer");
const { connectMongo } = require("./config/mongo");

const patientRoutes = require("./routes/patient.routes");
const appointmentRoutes = require("./routes/appointment.routes");
const doctorRoutes = require("./routes/doctor.routes");
const wardRoutes = require("./routes/ward.routes");
const nurseRoutes = require("./routes/nurse.routes");
const adminRoutes = require("./routes/admin.routes");
const caregiverRoutes = require("./routes/caregiver.routes");
const exportRoutes = require("./routes/export.routes");
const importRoutes = require("./routes/import.routes");
const notificationRoutes = require("./routes/notification.routes");
const searchRoutes = require("./routes/search.routes");
const reportsRoutes = require("./routes/reports.routes");

const app = express();
const server = http.createServer(app);

const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map((o) => o.trim())
  : ["http://localhost:5173"];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);
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
app.use("/api/export", exportRoutes);
app.use("/api/import", importRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/reports", reportsRoutes);

// 404 handler for unmatched routes
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("UNHANDLED ERROR:", err);
  res.status(err.status || 500).json({
    message: process.env.NODE_ENV === "production" ? "Internal server error" : err.message || "Internal server error",
  });
});

// Process-level error handlers
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  process.exit(1);
});



const PORT = process.env.PORT || 5001;
initSocket(server);
connectMongo().catch((err) => {
  console.error("MONGO CONNECTION ERROR:", err.message);
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
