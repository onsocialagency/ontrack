import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { MasterLayout } from "@/components/layout/master-layout";
import { getSessionFromCookies, isMaster } from "@/lib/auth";

export default async function MasterRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Master area is admin-only. Anything other than a `role: "master"`
  // session bounces — client users go back to their own dashboard,
  // unauthenticated users go to /login. Without this guard a Ministry
  // user could navigate to /master and see the agency-wide overview.
  const cookieStore = await cookies();
  const session = getSessionFromCookies(cookieStore);
  if (!isMaster(session)) {
    if (session?.role === "client") {
      redirect(`/${session.slug}`);
    }
    redirect("/login");
  }

  return <MasterLayout>{children}</MasterLayout>;
}
