"use client";

import { Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { AppLocale, localeCookie, localizedHref } from "../lib/i18n";
import { useAuth } from "./AuthContext";

/* Not abbreviated: "বাং" cuts the word mid-cluster and leaves a dangling
   anusvara, which reads as broken text rather than a short form. */
const LABELS: Record<AppLocale, string> = { en: "EN", bn: "বাংলা" };
const FULL: Record<AppLocale, string> = { en: "English", bn: "বাংলা" };

/**
 * With exactly two locales this is a toggle, not a picker. Rendering both
 * options side by side cost roughly double the width and turned the header's
 * right side into a wall of controls; it now shows the active locale and
 * switches to the other on click.
 */
export function LanguageSwitcher() {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("Header");
  const { user, updateProfile } = useAuth();
  const next: AppLocale = locale === "en" ? "bn" : "en";

  async function changeLocale(nextLocale: AppLocale) {
    if (nextLocale === locale) return;
    document.cookie = `${localeCookie}=${nextLocale};path=/;max-age=31536000;samesite=lax`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (user) {
      await updateProfile({ preferredLocale: nextLocale }).catch(() => undefined);
    }
    window.location.assign(localizedHref(current, nextLocale));
  }

  return (
    <button
      type="button"
      className="language-switcher"
      onClick={() => void changeLocale(next)}
      title={`${t("language")}: ${FULL[next]}`}
      aria-label={`${t("language")}: ${FULL[next]}`}
    >
      <Languages size={15} aria-hidden="true" />
      <span>{LABELS[locale]}</span>
    </button>
  );
}
