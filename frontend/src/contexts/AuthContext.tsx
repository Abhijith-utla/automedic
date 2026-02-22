import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { getMe, login as apiLogin, logout as apiLogout, register as apiRegister, type User } from "@/api/client";

interface AuthState {
  user: User | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });

  const refresh = useCallback(async () => {
    try {
      const user = await getMe();
      setState({ user, loading: false });
    } catch {
      setState({ user: null, loading: false });
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const user = await apiLogin(email, password);
    setState((s) => ({ ...s, user }));
  }, []);

  const register = useCallback(async (email: string, password: string, fullName: string) => {
    await apiRegister(email, password, fullName);
    const user = await apiLogin(email, password);
    setState((s) => ({ ...s, user }));
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setState({ user: null, loading: false });
  }, []);

  const value: AuthContextValue = {
    ...state,
    login,
    register,
    logout,
    refresh,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
