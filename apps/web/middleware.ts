import { NextRequest, NextResponse } from "next/server";
import { localeCookie } from "./lib/i18n";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isBengaliPath = pathname === "/bn" || pathname.startsWith("/bn/");
  const savedLocale = request.cookies.get(localeCookie)?.value;

  if (!isBengaliPath && savedLocale === "bn" && !pathname.startsWith("/admin")) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = `/bn${pathname === "/" ? "" : pathname}`;
    return NextResponse.redirect(redirectUrl);
  }

  const locale = isBengaliPath ? "bn" : "en";
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-site-locale", locale);

  if (isBengaliPath) {
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = pathname === "/bn" ? "/" : pathname.slice(3) || "/";
    const response = NextResponse.rewrite(rewriteUrl, { request: { headers: requestHeaders } });
    response.cookies.set(localeCookie, "bn", { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
    return response;
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!api|uploads|_next|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)"]
};
