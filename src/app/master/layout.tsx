import { MasterLayout } from "@/components/layout/master-layout";

export default function MasterRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MasterLayout>{children}</MasterLayout>;
}
