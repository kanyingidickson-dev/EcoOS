import { AppLayout } from "../components/AppLayout";

export default function AppRouteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <AppLayout>{children}</AppLayout>;
}
