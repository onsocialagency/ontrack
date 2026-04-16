import { NextRequest, NextResponse } from "next/server";
import { getAllClients, upsertClient, deleteClient } from "@/lib/client-store";

/**
 * GET /api/clients — list all clients
 * POST /api/clients — create or update a client
 * DELETE /api/clients?slug=xxx — delete a client
 *
 * All routes require master auth (checked via cookie).
 */

function isMaster(request: NextRequest): boolean {
  const cookie = request.cookies.get("ontrack-auth")?.value;
  if (!cookie) return false;
  try {
    const parsed = JSON.parse(cookie);
    return parsed.role === "master";
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  if (!isMaster(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clients = await getAllClients();
  return NextResponse.json({ clients });
}

export async function POST(request: NextRequest) {
  if (!isMaster(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  // Validate required fields
  if (!body.name || !body.slug) {
    return NextResponse.json(
      { error: "Name and slug are required" },
      { status: 400 },
    );
  }

  // Sanitize slug
  const slug = body.slug
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  const client = {
    id: body.id || `cl_${slug}_${Date.now().toString(36)}`,
    name: body.name,
    slug,
    type: body.type || "ecommerce",
    industry: body.industry || "",
    currency: body.currency || "GBP",
    monthlyBudget: Number(body.monthlyBudget) || 0,
    metaAllocation: Number(body.metaAllocation) || 0.6,
    googleAllocation: Number(body.googleAllocation) || 0.4,
    targetROAS: Number(body.targetROAS) || 0,
    targetCPL: Number(body.targetCPL) || 0,
    targetCPA: Number(body.targetCPA) || 0,
    targetMER: Number(body.targetMER) || 0,
    pacingThreshold: Number(body.pacingThreshold) || 0.9,
    tier: body.tier || "tier_2",
    retainerFee: Number(body.retainerFee) || 0,
    contractStart: body.contractStart || new Date().toISOString().slice(0, 10),
    contractRenewal: body.contractRenewal || "",
    logoUrl: body.logoUrl || "",
    primaryColor: body.primaryColor || "#FF6A41",
    secondaryColor: body.secondaryColor || "#FFF0EB",
    password: body.password || `${slug}2026`,
    windsorApiKey: body.windsorApiKey || "",
    metaAccountIds: body.metaAccountIds || [],
    googleCustomerIds: body.googleCustomerIds || [],
    averageDealValue: Number(body.averageDealValue) || 0,
    historicalCloseRate: Number(body.historicalCloseRate) || 0,
  };

  const updated = await upsertClient(client);
  return NextResponse.json({ clients: updated, saved: client });
}

export async function DELETE(request: NextRequest) {
  if (!isMaster(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const slug = request.nextUrl.searchParams.get("slug");
  if (!slug) {
    return NextResponse.json({ error: "Slug required" }, { status: 400 });
  }

  const updated = await deleteClient(slug);
  return NextResponse.json({ clients: updated });
}
