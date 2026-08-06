import { ConfigService } from "@nestjs/config";

/** Never a name a locale/analytics cookie would collide with. */
export const AUTH_COOKIE_NAME = "my_ecom_session";

/**
 * httpOnly so an XSS bug can no longer read the session token out of client
 * storage the way it could with localStorage. SameSite=Lax is the safe default
 * for a same-site deployment (web and API as subdomains of one domain): the
 * browser withholds the cookie on cross-site POST/PATCH/DELETE, which is
 * exactly where CSRF would otherwise bite, without needing a separate CSRF
 * token. If the web app and API ever move to genuinely separate domains,
 * SameSite=Lax stops helping and this needs revisiting alongside a CSRF token.
 *
 * `secure` is derived from whether the API is actually served over HTTPS
 * (API_PUBLIC_URL), not NODE_ENV — the platform running this process isn't
 * guaranteed to set NODE_ENV, but a Secure cookie is rejected outright by the
 * browser on plain HTTP, so getting this wrong breaks either local dev or
 * production silently.
 */
export function authCookieOptions(config: ConfigService) {
  const apiOrigin = config.get<string>("API_PUBLIC_URL") ?? "";
  return {
    httpOnly: true,
    secure: apiOrigin.startsWith("https://"),
    sameSite: "lax" as const,
    path: "/",
    // Matches the JWT's own expiry (app.module.ts JwtModule signOptions), so
    // the cookie never outlives the token it holds.
    maxAge: 7 * 24 * 60 * 60 * 1000
  };
}
