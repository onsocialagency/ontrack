import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getClientBySlug, getAllClients } from "@/lib/client-store";
import { ClientLayout } from "@/components/layout/client-layout";
import { getSessionFromCookies, canAccessClient } from "@/lib/auth";

export default async function ClientRootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ client: string }>;
}) {
  const { client: clientSlug } = await params;
  const client = await getClientBySlug(clientSlug);

  // Auth gate. We read the session once and use it for both:
  //   - access control (block client A from typing /clientB into the URL)
  //   - admin status (drives the client-switcher in the sidebar)
  // Anyone with no session goes to /login. A "client" session whose
  // slug doesn't match the URL gets bounced back to its own dashboard
  // so a Ministry user manually browsing to /irg lands at /ministry,
  // not at IRG's data. Masters bypass all of this.
  const cookieStore = await cookies();
  const session = getSessionFromCookies(cookieStore);
  if (!session) {
    redirect("/login");
  }
  if (!canAccessClient(session, clientSlug)) {
    if (session.role === "client") {
      redirect(`/${session.slug}`);
    }
    redirect("/login");
  }

  const isAdmin = session.role === "master";

  // Build client list for the sidebar admin switcher (admins only —
  // a client session never sees the switcher, and even if the markup
  // were tampered with, the server-side guard above blocks the
  // resulting navigation).
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
