import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import HomePage from './pages/HomePage';
import Dashboard from './pages/Dashboard';
import AppointmentsPage from './pages/AppointmentsPage';
import PatientsPage from './pages/PatientsPage';
import DoctorsPage from './pages/DoctorsPage';
import ExportImportPage from './pages/ExportImportPage';
import PatientRecordsPage from './pages/PatientRecordsPage';
import AdminPage from './pages/AdminPage';
import Layout from './components/Layout';

const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }
  
  return user ? <>{children}</> : <Navigate to="/login" />;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      
      <Route
        path="/dashboard"
        element={
          <PrivateRoute>
            <Layout>
              <Dashboard />
            </Layout>
          </PrivateRoute>
        }
      />
      
      <Route
        path="/appointments"
        element={
          <PrivateRoute>
            <Layout>
              <AppointmentsPage />
            </Layout>
          </PrivateRoute>
        }
      />
      
      <Route
        path="/patients"
        element={
          <PrivateRoute>
            <Layout>
              <PatientsPage />
            </Layout>
          </PrivateRoute>
        }
      />
      
      <Route
        path="/doctors"
        element={
          <PrivateRoute>
            <Layout>
              <DoctorsPage />
            </Layout>
          </PrivateRoute>
        }
      />
      
      <Route
        path="/records"
        element={
          <PrivateRoute>
            <Layout>
              <PatientRecordsPage />
            </Layout>
          </PrivateRoute>
        }
      />
      
      <Route
        path="/export-import"
        element={
          <PrivateRoute>
            <Layout>
              <ExportImportPage />
            </Layout>
          </PrivateRoute>
        }
      />
      
      <Route
        path="/admin"
        element={
          <PrivateRoute>
            <Layout>
              <AdminPage />
            </Layout>
          </PrivateRoute>
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}

export default App;
