import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { Layout } from "./components/Layout";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { PatientsPage } from "./pages/PatientsPage";
import { PatientDetailPage } from "./pages/PatientDetailPage";
import { EncounterPage } from "./pages/EncounterPage";
import { DashboardPage } from "./pages/DashboardPage";
import { JourneyDashboardPage } from "./pages/JourneyDashboardPage";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ErrorBoundary } from "./components/ErrorBoundary";

function GuestOnly({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading…</div>;
  if (user) return <Navigate to="/patients" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
      <Route path="/register" element={<GuestOnly><RegisterPage /></GuestOnly>} />
      <Route path="/patients" element={<ProtectedRoute><Layout><PatientsPage /></Layout></ProtectedRoute>} />
      <Route path="/patients/:patientId" element={<ProtectedRoute><Layout><PatientDetailPage /></Layout></ProtectedRoute>} />
      <Route path="/patients/:patientId/encounter" element={<ProtectedRoute><Layout><EncounterPage /></Layout></ProtectedRoute>} />
      <Route path="/encounter/:encounterId/dashboard" element={<ProtectedRoute><Layout><DashboardPage /></Layout></ProtectedRoute>} />
      <Route path="/encounter/:encounterId/journey" element={<ProtectedRoute><Layout><JourneyDashboardPage /></Layout></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
