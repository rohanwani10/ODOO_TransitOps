import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const publicRoutes = ["/login", "/signup"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Let Next.js static files and internals pass through
  if (
    pathname.startsWith("/_next") ||
    pathname.match(/\.(png|jpg|jpeg|gif|svg|ico)$/)
  ) {
    return NextResponse.next();
  }

  // We let Auth-Guard handle API routes protection inside the Route Handlers
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const isPublicRoute = publicRoutes.includes(pathname);
  const sessionToken = request.cookies.get("accessToken")?.value;

  // Redirect to login if user accesses a protected route without a session cookie
  if (!isPublicRoute && !sessionToken) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Redirect to dashboard if logged-in user tries to access the login page
  if (isPublicRoute && sessionToken) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Apply middleware to all routes except api, _next, and static files
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
