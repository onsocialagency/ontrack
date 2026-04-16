import { getAllClients } from "@/lib/client-store";
import { getRevenueClients } from "@/lib/mock-data";
import { RevenuePageClient } from "./revenue-client";

export default async function AgencyRevenuePage() {
  const allClients = await getAllClients();
  const revenueClients = getRevenueClients(allClients);
  return <RevenuePageClient revenueClients={revenueClients} />;
}
