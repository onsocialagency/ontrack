import { NextRequest, NextResponse } from "next/server";
import { getClientBySlug } from "@/lib/client-store";

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

    // Client login — username is the client slug
    const slug = username;
    const client = await getClientBySlug(slug);

    if (!client || client.password !== password) {
      return NextResponse.json(
        { success: false, error: "Invalid credentials" },
        { status: 401 },
      );
    }

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
