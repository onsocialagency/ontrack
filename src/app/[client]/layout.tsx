import { cookies } from "next/headers";
import { getClientBySlug, getAllClients } from "@/lib/client-store";
import { ClientLayout } from "@/components/layout/client-layout";

export default async function ClientRootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ client: string }>;
}) {
  const { client: clientSlug } = await params;
  const client = await getClientBySlug(clientSlug);

  // Determine admin status from auth cookie
  const cookieStore = await cookies();
  const authCookie = cookieStore.get("ontrack-auth")?.value;
  let isAdmin = false;
  if (authCookie) {
    try {
      const auth = JSON.parse(authCookie);
      isAdmin = auth.role === "master";
    } catch {
      // ignore
    }
  }

  // Build client list for admin switcher
  const allStoredClients = isAdmin ? await getAllClients() : [];
  const allClients = allStoredClients.map((c) => ({ slug: c.slug, name: c.name, primaryColor: c.primaryColor }));

  if (!client) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0A0A0F]">
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-8 text-center space-y-3">
          <h1 className="text-xl font-bold text-white">Client not found</h1>
          <p className="text-sm text-[#94A3B8]">
            No client matches the slug &ldquo;{clientSlug}&rdquo;.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ClientLayout
      clientSlug={client.slug}
      clientType={client.type}
      clientName={client.name}
      clientColor={client.primaryColor}
      clientLogo={client.logoUrl}
      clientLocale={client.locale}
      clientTimezone={client.timezone}
      isAdmin={isAdmin}
      allClients={allClients}
      clientConfig={client}
    >
      {children}
    </ClientLayout>
  );
}
