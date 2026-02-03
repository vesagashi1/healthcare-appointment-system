import { Navigate, Route, Routes } from "react-router-dom";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { ProtectedRoute } from "./shared/auth/ProtectedRoute";
import { DoctorDashboardPage } from "./pages/doctor/DoctorDashboardPage";
import { DoctorPatientRecordsPage } from "./pages/doctor/DoctorPatientRecordsPage";
import { DoctorApproveAppointmentPage } from "./pages/doctor/DoctorApproveAppointmentPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route element={<ProtectedRoute requireRole="doctor" />}>
        <Route path="/doctor" element={<DoctorDashboardPage />} />
        <Route
          path="/doctor/patient-records"
          element={<DoctorPatientRecordsPage />}
        />
        <Route
          path="/doctor/approve-appointment"
          element={<DoctorApproveAppointmentPage />}
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
