"use client";

import { ArrowRight, Eye, EyeOff, LockKeyhole, ShieldCheck } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { AppLocale, localizedHref } from "../lib/i18n";
import { useAuth } from "./AuthContext";
import { BrandIdentity } from "./PageChrome";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useSiteSettings } from "./SiteSettingsContext";

function destination(role: string, requested?: string | null) {
  const safeRequested =
    requested?.startsWith("/") && !requested.startsWith("//") ? requested : null;
  return safeRequested ?? (role === "CUSTOMER" ? "/account" : "/admin");
}

export function AuthPage({ mode }: { mode: "login" | "register" }) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("Auth");
  const router = useRouter();
  const { user, login, register } = useAuth();
  const { settings } = useSiteSettings();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (user) {
      const next = new URLSearchParams(window.location.search).get("next");
      const target = destination(user.role, next);
      router.replace(user.role === "CUSTOMER" ? localizedHref(target, locale) : target);
    }
  }, [locale, router, user]);

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
      const target = destination(signedIn.role, next);
      router.replace(signedIn.role === "CUSTOMER" ? localizedHref(target, locale) : target);
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
      <div className="auth-language"><LanguageSwitcher /></div>
      <div className="auth-visual">
        <img src="/images/auth-pantry.png" alt={t("visualAlt")} />
        <div>
          <p className="eyebrow">{t("visualEyebrow")}</p>
          <h1>{t("visualTitle")}</h1>
          <p>{t("visualDetail")}</p>
        </div>
      </div>
      <section className="auth-form-panel">
        <div className="auth-form-heading">
          <LockKeyhole size={24} />
          <p className="eyebrow">{mode === "login" ? t("welcome") : t("create")}</p>
          <h2>{mode === "login" ? t("signIn") : t("join", { brand: settings.title })}</h2>
          <p>
            {mode === "login"
              ? t("loginDetail")
              : t("registerDetail")}
          </p>
        </div>
        <form className="auth-form" onSubmit={submit}>
          {mode === "register" ? (
            <label>
              <span>{t("fullName")}</span>
              <input name="name" autoComplete="name" required />
            </label>
          ) : null}
          <label>
            <span>{t("email")}</span>
            <input name="email" type="email" autoComplete="email" required suppressHydrationWarning />
          </label>
          {mode === "register" ? (
            <label>
              <span>{t("phone")}</span>
              <input name="phone" autoComplete="tel" />
            </label>
          ) : null}
          <label>
            <span>{t("password")}</span>
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
                aria-label={showPassword ? t("hidePassword") : t("showPassword")}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>
          {mode === "login" ? (
            <a className="text-link" href={localizedHref("/reset-password", locale)}>{t("forgot")}</a>
          ) : null}
          {error ? <p className="form-error">{error}</p> : null}
          <button className="primary-action full" type="submit" disabled={submitting}>
            {submitting ? t("waiting") : mode === "login" ? t("signIn") : t("create")}
            <ArrowRight size={18} />
          </button>
        </form>
        <div className="auth-switch">
          <span>{mode === "login" ? t("newCustomer") : t("existingCustomer")}</span>
          <a href={localizedHref(mode === "login" ? "/register" : "/login", locale)}>
            {mode === "login" ? t("create") : t("signIn")}
          </a>
        </div>
        <p className="auth-secure">
          <ShieldCheck size={16} />
          {t("secure")}
        </p>
      </section>
    </main>
  );
}
