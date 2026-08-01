"use client";

import { ArrowRight, Eye, EyeOff, LockKeyhole, X } from "lucide-react";
import { FormEvent, useState } from "react";
import { useAuth } from "./AuthContext";

export function AuthGateModal({
  open,
  mode,
  onModeChange,
  onClose,
  onSuccess
}: {
  open: boolean;
  mode: "login" | "register";
  onModeChange: (mode: "login" | "register") => void;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
}) {
  const { login, register } = useAuth();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  if (!open) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    try {
      if (mode === "login") {
        await login(String(form.get("email")), String(form.get("password")));
      } else {
        await register({
          name: String(form.get("name")),
          email: String(form.get("email")),
          password: String(form.get("password")),
          phone: String(form.get("phone") || "") || undefined
        });
      }
      await onSuccess();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Authentication failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-gate-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="auth-gate-card" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="auth-gate-close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
        <div className="auth-form-heading">
          <LockKeyhole size={22} />
          <p className="eyebrow">{mode === "login" ? "Welcome back" : "Create an account"}</p>
          <h2>{mode === "login" ? "Sign in to continue" : "Join to continue"}</h2>
          <p>
            {mode === "login"
              ? "Sign in and we'll pick up right where you left off."
              : "Create an account and we'll pick up right where you left off."}
          </p>
        </div>
        <form className="auth-form" onSubmit={submit}>
          {mode === "register" ? (
            <label>
              <span>Full name</span>
              <input name="name" autoComplete="name" required />
            </label>
          ) : null}
          <label>
            <span>Email address</span>
            <input name="email" type="email" autoComplete="email" required />
          </label>
          {mode === "register" ? (
            <label>
              <span>Phone number</span>
              <input name="phone" autoComplete="tel" />
            </label>
          ) : null}
          <label>
            <span>Password</span>
            <div className="password-input">
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                minLength={8}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>
          {mode === "login" ? <a className="text-link" href="/reset-password">Forgot password?</a> : null}
          {error ? <p className="form-error">{error}</p> : null}
          <button className="primary-action full" type="submit" disabled={submitting}>
            {submitting ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
            <ArrowRight size={18} />
          </button>
        </form>
        <div className="auth-switch">
          <span>{mode === "login" ? "New here?" : "Already have an account?"}</span>
          <button
            type="button"
            className="text-link"
            onClick={() => onModeChange(mode === "login" ? "register" : "login")}
          >
            {mode === "login" ? "Create account" : "Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}
