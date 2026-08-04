import { headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { AppLocale, isAppLocale, messagesFor } from "../lib/i18n";

export default getRequestConfig(async () => {
  const requestHeaders = await headers();
  const requestedLocale = requestHeaders.get("x-site-locale");
  const locale: AppLocale = isAppLocale(requestedLocale) ? requestedLocale : "en";

  return {
    locale,
    messages: messagesFor(locale),
    timeZone: "Asia/Dhaka"
  };
});
