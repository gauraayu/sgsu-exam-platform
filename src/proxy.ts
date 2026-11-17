import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/constants";

const PROTECTED = ["/admin", "/student", "/attempt"];

/**
 * Optimistic gate: requests to protected pages without a session cookie are sent to the login page
 * with their original destination preserved. Full session and role checks happen on the server
 * in each layout and API route.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const headers = new Headers(request.headers);
  headers.set("x-pathname", pathname + search);
  if (PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`)) && !request.cookies.get(SESSION_COOKIE)?.value) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|branding|questions|favicon.ico|icon.png).*)"],
};
