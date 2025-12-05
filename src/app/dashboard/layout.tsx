// src/app/dashboard/layout.tsx
import "@/src/styles/soft-ui.css";
import SupportDashboardLayout from "@/src/components/support/SupportDashboardLayout";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SupportDashboardLayout>{children}</SupportDashboardLayout>;
}
