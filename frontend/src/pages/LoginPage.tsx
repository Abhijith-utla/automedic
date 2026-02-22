import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Logo } from "@/components/Logo";

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/patients");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Login failed";
      setError(msg.includes("fetch") || msg.includes("Failed") ? "Cannot reach server. Is the backend running on port 8000?" : msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-clinical-bg px-4">
      <div className="w-full max-w-sm">
        <Logo variant="inline" className="mb-6" />
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Sign in</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border border-clinical-border px-3 py-2 text-gray-900"
              autoComplete="email"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-lg border border-clinical-border px-3 py-2 text-gray-900"
              autoComplete="current-password"
            />
          </div>
          {error && <p className="text-sm text-clinical-danger">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-clinical-primary text-white py-2.5 font-medium hover:bg-clinical-primaryHover disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="mt-4 text-sm text-clinical-muted">
          No account? <Link to="/register" className="text-clinical-primary hover:underline">Register</Link>
        </p>
      </div>
    </div>
  );
}
