"use client";

import { ArrowRight, Eye, EyeOff, LockKeyhole, ShieldCheck } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { requestPasswordReset, resetPassword } from "../lib/catalog";
import { BrandIdentity } from "./PageChrome";
import { useSiteSettings } from "./SiteSettingsContext";

export function ResetPassword() {
  const { settings } = useSiteSettings();
  const [token, setToken] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token"));
  }, []);

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const form = new FormData(event.currentTarget);
      await requestPasswordReset(String(form.get("email")));
      setDone(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "This link could not be sent.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setError("");
    setSubmitting(true);
    try {
      const form = new FormData(event.currentTarget);
      await resetPassword(token, String(form.get("newPassword")));
      setDone(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "This reset link is invalid or has expired.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <BrandIdentity settings={settings} className="auth-brand" />
      <div className="auth-visual">
        <img src="/images/auth-pantry.png" alt="A calm, organized home pantry" />
        <div>
          <p className="eyebrow">Account recovery</p>
          <h1>Back into your account.</h1>
          <p>We&apos;ll get you a secure link to choose a new password.</p>
        </div>
      </div>
      <section className="auth-form-panel">
        <div className="auth-form-heading">
          <LockKeyhole size={24} />
          <p className="eyebrow">{token ? "Choose a new password" : "Forgot your password?"}</p>
          <h2>{token ? "Set a new password" : "Reset your password"}</h2>
          <p>
            {token
              ? "Choose a new password for your account."
              : "Enter your account email and we'll send you a reset link."}
          </p>
        </div>

        {done ? (
          <p className="form-note">
            {token
              ? "Your password has been updated. You can now sign in with your new password."
              : "If an account exists for that email, a reset link is on its way. It's valid for 1 hour."}
          </p>
        ) : token ? (
          <form className="auth-form" onSubmit={submitReset}>
            <label>
              <span>New password</span>
              <div className="password-input">
                <input
                  name="newPassword"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
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
            {error ? <p className="form-error">{error}</p> : null}
            <button className="primary-action full" type="submit" disabled={submitting}>
              {submitting ? "Please wait..." : "Set new password"}
              <ArrowRight size={18} />
            </button>
          </form>
        ) : (
          <form className="auth-form" onSubmit={submitRequest}>
            <label>
              <span>Email address</span>
              <input name="email" type="email" autoComplete="email" required />
            </label>
            {error ? <p className="form-error">{error}</p> : null}
            <button className="primary-action full" type="submit" disabled={submitting}>
              {submitting ? "Please wait..." : "Send reset link"}
              <ArrowRight size={18} />
            </button>
          </form>
        )}

        <div className="auth-switch">
          <span>Remembered your password?</span>
          <a href="/login">Sign in</a>
        </div>
        <p className="auth-secure">
          <ShieldCheck size={16} />
          Passwords are securely hashed and never stored as plain text.
        </p>
      </section>
    </main>
  );
}
