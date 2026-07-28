"use client";

import { ArrowRight, Eye, EyeOff, LockKeyhole, ShieldCheck } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthContext";
import { BrandIdentity } from "./PageChrome";
import { useSiteSettings } from "./SiteSettingsContext";

function destination(role: string, requested?: string | null) {
  const safeRequested =
    requested?.startsWith("/") && !requested.startsWith("//") ? requested : null;
  return safeRequested ?? (role === "CUSTOMER" ? "/account" : "/admin");
}

export function AuthPage({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const { user, login, register } = useAuth();
  const { settings } = useSiteSettings();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (user) {
      const next = new URLSearchParams(window.location.search).get("next");
      router.replace(destination(user.role, next));
    }
  }, [router, user]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    const form = new FormData(event.currentTarget);

    try {
      const signedIn =
        mode === "login"
          ? await login(String(form.get("email")), String(form.get("password")))
          : await register({
              name: String(form.get("name")),
              email: String(form.get("email")),
              password: String(form.get("password")),
              phone: String(form.get("phone") || "") || undefined
            });
      const next = new URLSearchParams(window.location.search).get("next");
      router.replace(destination(signedIn.role, next));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Authentication failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="top-note auth-site-note">
        <span>{settings.announcement}</span>
        <a href={settings.announcementLinkHref}>{settings.announcementLinkLabel}</a>
      </div>
      <BrandIdentity settings={settings} className="auth-brand" />
      <div className="auth-visual">
        <img src="/images/auth-pantry.png" alt="A calm, organized home pantry" />
        <div>
          <p className="eyebrow">Thoughtful grocery shopping</p>
          <h1>Your pantry, remembered.</h1>
          <p>Save time at checkout, keep orders together, and follow every delivery.</p>
        </div>
      </div>
      <section className="auth-form-panel">
        <div className="auth-form-heading">
          <LockKeyhole size={24} />
          <p className="eyebrow">{mode === "login" ? "Welcome back" : "Create an account"}</p>
          <h2>{mode === "login" ? "Sign in" : `Join ${settings.title}`}</h2>
          <p>
            {mode === "login"
              ? "Access your orders and saved items."
              : "A faster checkout starts here."}
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
          {mode === "login" ? (
            <a className="text-link" href="/reset-password">Forgot password?</a>
          ) : null}
          {error ? <p className="form-error">{error}</p> : null}
          <button className="primary-action full" type="submit" disabled={submitting}>
            {submitting ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
            <ArrowRight size={18} />
          </button>
        </form>
        <div className="auth-switch">
          <span>{mode === "login" ? "New to My Ecom?" : "Already have an account?"}</span>
          <a href={mode === "login" ? "/register" : "/login"}>
            {mode === "login" ? "Create account" : "Sign in"}
          </a>
        </div>
        <p className="auth-secure">
          <ShieldCheck size={16} />
          Passwords are securely hashed and never stored as plain text.
        </p>
      </section>
    </main>
  );
}
