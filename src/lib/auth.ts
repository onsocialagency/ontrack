/**
 * Shared session helpers for the dashboard.
 *
 * The auth cookie (`ontrack-auth`) carries a small JSON blob set by
 * `/api/auth` on login:
 *
 *   { role: "master" }                — agency admin
 *   { role: "client", slug: "ministry" } — single-client team member
 *
 * The helpers below give us one place to read and validate that
 * cookie so layout guards and API routes don't drift in behaviour.
 *
 * Two access patterns are supported:
 *   - `getSessionFromCookies(cookies)` — for server components /
 *     route handlers that already have access to next/headers.
 *   - `getSessionFromRequest(request)` — for API route handlers that
 *     receive a NextRequest.
 *
 * `assertCanAccessClient(session, slug)` returns true when the
 * caller is master OR the cookie's slug matches the requested slug.
 * Anything else MUST be rejected by the caller.
 */

import type { NextRequest } from "next/server";
import type { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";

export type Session =
  | { role: "master" }
  | { role: "client"; slug: string }
  | null;

const COOKIE_NAME = "ontrack-auth";

function parseSession(raw: string | undefined): Session {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.role === "master") return { role: "master" };
    if (parsed?.role === "client" && typeof parsed.slug === "string") {
      return { role: "client", slug: parsed.slug };
    }
    return null;
  } catch {
    return null;
  }
}

/** Read the session from a server-component's cookie store. */
export function getSessionFromCookies(cookies: ReadonlyRequestCookies): Session {
  return parseSession(cookies.get(COOKIE_NAME)?.value);
}

/** Read the session from a NextRequest (API routes, middleware). */
export function getSessionFromRequest(request: NextRequest): Session {
  return parseSession(request.cookies.get(COOKIE_NAME)?.value);
}

/**
 * Returns true when the session is allowed to access data scoped to
 * `clientSlug`. Master sessions can access any client. A client
 * session can only access its own slug.
 *
 * Returns false on any other shape — including no session at all —
 * so callers can treat the boolean as a strict allow-list.
 */
export function canAccessClient(session: Session, clientSlug: string): boolean {
  if (!session) return false;
  if (session.role === "master") return true;
  return session.role === "client" && session.slug === clientSlug;
}

export function isMaster(session: Session): boolean {
  return session?.role === "master";
}
