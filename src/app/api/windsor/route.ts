import { NextRequest, NextResponse } from "next/server";
import {
  getWindsorCampaignData,
  getWindsorCreativeData,
  getWindsorGA4Data,
  getWindsorHubSpotContacts,
  getWindsorRSAAssetData,
  getWindsorKeywordQSData,
  getWindsorSearchTermData,
  getWindsorTikTokCreativeData,
  discoverAccounts,
  filterByClient,
} from "@/lib/windsor";
import { getClientBySlug } from "@/lib/client-store";

/**
 * Windsor API proxy — protects the API key from client exposure.
 *
 * GET /api/windsor?client=baya&type=campaigns&days=30
 * GET /api/windsor?client=baya&type=creatives&days=30
 * GET /api/windsor?type=discover  (list all accounts in Windsor)
 *
 * Looks up the Windsor API key in this priority order:
 * 1. Per-client key from JSON store (set in admin panel)
 * 2. Global WINDSOR_API_KEY from .env.local
 *
 * Filters results to only include data for the specified client using:
 * - metaAccountIds / googleCustomerIds from client config
 * - Client name matching in campaign/account names
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const clientSlug = searchParams.get("client");
  const type = searchParams.get("type") || "campaigns";
  const days = parseInt(searchParams.get("days") || "30", 10);
  const dateFrom = searchParams.get("date_from");
  const dateTo = searchParams.get("date_to");

  // Account discovery mode (no client needed)
  if (type === "discover") {
    const apiKey = process.env.WINDSOR_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "No Windsor API key in env" }, { status: 503 });
    }
    try {
      const accounts = await discoverAccounts(apiKey);
      return NextResponse.json({ accounts, timestamp: new Date().toISOString() });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  if (!clientSlug) {
    return NextResponse.json({ error: "Client slug required" }, { status: 400 });
  }

  // Look up client config and API key
  const client = await getClientBySlug(clientSlug);
  const apiKey = client?.windsorApiKey || process.env.WINDSOR_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "No Windsor API key configured. Using mock data.", useMock: true },
      { status: 503 },
    );
  }

  try {
    const dateOpts = dateFrom && dateTo ? { dateFrom, dateTo } : undefined;

    // HubSpot contacts — tenant scoping handled at the Windsor API-key level
    // (the key only sees the connected HubSpot portal). No row-level client
    // filter to apply; contacts don't carry account_id.
    if (type === "hubspot") {
      const contacts = await getWindsorHubSpotContacts(apiKey, days, dateOpts);
      return NextResponse.json({
        data: contacts,
        totalRows: contacts.length,
        filteredRows: contacts.length,
        clientName: client?.name,
        source: "windsor",
        timestamp: new Date().toISOString(),
      });
    }

    // GA4 data doesn't need client filtering (it's per-property)
    if (type === "ga4") {
      const ga4Data = await getWindsorGA4Data(apiKey, days, dateOpts);
      return NextResponse.json({
        data: ga4Data,
        totalRows: ga4Data.length,
        filteredRows: ga4Data.length,
        clientName: client?.name,
        source: "windsor",
        timestamp: new Date().toISOString(),
      });
    }

    // Creative Lab — direct-return types (already client-filtered at source or don't need filtering)
    if (type === "rsa_assets" || type === "keyword_qs" || type === "search_terms" || type === "tiktok_creatives") {
      const fetchFn = {
        rsa_assets: getWindsorRSAAssetData,
        keyword_qs: getWindsorKeywordQSData,
        search_terms: getWindsorSearchTermData,
        tiktok_creatives: getWindsorTikTokCreativeData,
      }[type];
      const rawData = await fetchFn(apiKey, days, dateOpts);
      const data = filterByClient(rawData, {
        accountIds: [
          ...(client?.metaAccountIds || []),
          ...(client?.googleCustomerIds || []),
          ...(client?.tiktokAccountIds || []),
        ],
        clientName: client?.name,
      });
      return NextResponse.json({
        data,
        totalRows: rawData.length,
        filteredRows: data.length,
        clientName: client?.name,
        source: "windsor",
        timestamp: new Date().toISOString(),
      });
    }

    const rawData =
      type === "creatives"
        ? await getWindsorCreativeData(apiKey, days, dateOpts)
        : await getWindsorCampaignData(apiKey, days, dateOpts);

    // Filter data to this client's accounts
    const data = filterByClient(rawData, {
      accountIds: [
        ...(client?.metaAccountIds || []),
        ...(client?.googleCustomerIds || []),
      ],
      clientName: client?.name,
    });

    return NextResponse.json({
      data,
      totalRows: rawData.length,
      filteredRows: data.length,
      clientName: client?.name,
      source: "windsor",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
