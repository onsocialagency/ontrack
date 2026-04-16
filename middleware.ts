import { NextRequest, NextResponse } from "next/server";

interface AuthCookie {
  role: "master" | "client";
  slug?: string;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip auth for public routes
  if (
    pathname === "/login" ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const authCookie = request.cookies.get("ontrack-auth")?.value;

  let auth: AuthCookie | null = null;
  if (authCookie) {
    try {
      auth = JSON.parse(authCookie) as AuthCookie;
    } catch {
      auth = null;
    }
  }

  // Protected: /master/*
  if (pathname.startsWith("/master")) {
    if (!auth || auth.role !== "master") {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // Protected: /[client]/* (any path that isn't already handled)
  const slugMatch = pathname.match(/^\/([a-z0-9_-]+)/);
  if (slugMatch) {
    if (!auth) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }

    const requestedSlug = slugMatch[1];

    // Master role can access any client
    if (auth.role === "master") {
      return NextResponse.next();
    }

    // Client role must match slug
    if (auth.role === "client" && auth.slug === requestedSlug) {
      return NextResponse.next();
    }

    // Unauthorized - redirect to login
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
