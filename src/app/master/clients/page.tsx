import { getAllClients } from "@/lib/client-store";
import { ClientHubUI } from "./client-hub-ui";

export default async function ClientHubPage() {
  const initialClients = await getAllClients();
  return <ClientHubUI initialClients={initialClients} />;
}
