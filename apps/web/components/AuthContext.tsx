"use client";

import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
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
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

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

  const value = useMemo(
    () => ({ user, loading, login, register, updateProfile, logout }),
    [loading, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
}
