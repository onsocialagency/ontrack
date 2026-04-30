import { NextRequest, NextResponse } from "next/server";
import { getClientByLogin } from "@/lib/client-store";

// Admin credentials
const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "admin";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body as { username: string; password: string };

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: "Username and password are required" },
        { status: 400 },
      );
    }

    // Admin login
    if (username === ADMIN_USERNAME) {
      if (password !== ADMIN_PASSWORD) {
        return NextResponse.json(
          { success: false, error: "Invalid credentials" },
          { status: 401 },
        );
      }

      const response = NextResponse.json({
        success: true,
        redirect: "/master",
      });

      response.cookies.set(
        "ontrack-auth",
        JSON.stringify({ role: "master" }),
        {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 60 * 60 * 24 * 7,
          path: "/",
        },
      );

      return response;
    }

    // Client login — username can be the slug or the optional
    // loginUsername (typically an email) configured on the client.
    // Lookup is case-insensitive; password is exact-match.
    const client = await getClientByLogin(username);

    if (!client || client.password !== password) {
      return NextResponse.json(
        { success: false, error: "Invalid credentials" },
        { status: 401 },
      );
    }

    // Always anchor the session on the canonical slug, regardless of
    // which alias the user typed. Cookie + redirect both use the slug
    // so /[client]/layout.tsx and /api/windsor see a stable identity.
    const slug = client.slug;
    const response = NextResponse.json({
      success: true,
      redirect: `/${slug}`,
    });

    response.cookies.set(
      "ontrack-auth",
      JSON.stringify({ role: "client", slug }),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7,
        path: "/",
      },
    );

    return response;
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid request" },
      { status: 400 },
    );
  }
}
