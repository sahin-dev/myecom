"use client";

import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import {
  AuthUser,
  authStorageKey,
  fetchMe,
  loginUser,
  registerUser,
  updateMe
} from "../lib/catalog";
import { AuthGateModal } from "./AuthGateModal";

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (input: {
    name: string;
    email: string;
    password: string;
    phone?: string;
  }) => Promise<AuthUser>;
  updateProfile: (input: {
    name?: string;
    phone?: string;
    avatarUrl?: string;
  }) => Promise<AuthUser>;
  logout: () => void;
  requireAuth: (onAuthenticated: () => void | Promise<void>) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [gateOpen, setGateOpen] = useState(false);
  const [gateMode, setGateMode] = useState<"login" | "register">("login");
  const pendingAction = useRef<(() => void | Promise<void>) | null>(null);

  useEffect(() => {
    const token = window.localStorage.getItem(authStorageKey);
    if (!token) {
      setLoading(false);
      return;
    }

    fetchMe()
      .then(setUser)
      .catch(() => window.localStorage.removeItem(authStorageKey))
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const session = await loginUser({ email, password });
    window.localStorage.setItem(authStorageKey, session.accessToken);
    setUser(session.user);
    return session.user;
  }

  async function register(input: {
    name: string;
    email: string;
    password: string;
    phone?: string;
  }) {
    const session = await registerUser(input);
    window.localStorage.setItem(authStorageKey, session.accessToken);
    setUser(session.user);
    return session.user;
  }

  async function updateProfile(input: {
    name?: string;
    phone?: string;
    avatarUrl?: string;
  }) {
    const updated = await updateMe(input);
    setUser(updated);
    return updated;
  }

  function logout() {
    window.localStorage.removeItem(authStorageKey);
    setUser(null);
  }

  function requireAuth(onAuthenticated: () => void | Promise<void>) {
    if (user) {
      void onAuthenticated();
      return;
    }
    pendingAction.current = onAuthenticated;
    setGateMode("login");
    setGateOpen(true);
  }

  function closeGate() {
    setGateOpen(false);
    pendingAction.current = null;
  }

  async function handleGateSuccess() {
    const action = pendingAction.current;
    pendingAction.current = null;
    setGateOpen(false);
    if (action) await action();
  }

  const value = useMemo(
    () => ({ user, loading, login, register, updateProfile, logout, requireAuth }),
    [loading, user]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      <AuthGateModal
        open={gateOpen}
        mode={gateMode}
        onModeChange={setGateMode}
        onClose={closeGate}
        onSuccess={handleGateSuccess}
      />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
}
