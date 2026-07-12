import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background font-body-md text-on-background">
      <Sidebar />
      <div className="pl-[64px] lg:pl-[240px] flex flex-col min-h-screen">
        <TopBar />
        <main className="flex-1 relative pt-16 bg-surface min-h-screen">
          <div className="p-lg lg:p-margin-desktop w-full mx-auto space-y-lg">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
