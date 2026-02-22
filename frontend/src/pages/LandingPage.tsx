import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Logo } from "@/components/Logo";
import { APP_NAME } from "@/config/brand";

export function LandingPage() {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading…</div>;
  if (user) return <Navigate to="/patients" replace />;
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-clinical-bg px-4">
      <div className="flex flex-col items-center max-w-lg w-full">
        <Logo variant="landing" linkToHome={false} className="mb-6" />
        <h1 className="text-4xl font-bold text-gray-900 tracking-tight text-center mb-2">
          {APP_NAME}
        </h1>
        <p className="text-clinical-muted text-center mb-10">
          Diagnostic Assistant for clinicians
        </p>
        <div className="flex flex-col sm:flex-row gap-3 w-full">
          <Link
            to="/login"
            className="flex-1 inline-flex items-center justify-center rounded-xl bg-clinical-primary text-white py-3.5 font-medium hover:bg-clinical-primaryHover transition"
          >
            Sign in
          </Link>
          <Link
            to="/register"
            className="flex-1 inline-flex items-center justify-center rounded-xl border-2 border-clinical-primary text-clinical-primary py-3.5 font-medium hover:bg-clinical-primary/5 transition"
          >
            Register
          </Link>
        </div>
      </div>
    </div>
  );
}
