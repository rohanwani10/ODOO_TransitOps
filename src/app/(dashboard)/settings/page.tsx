"use client";

import { ShieldCheck, UserRound, Bell, Database } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { useAuthStore } from "@/stores/auth-store";

function SettingRow({
  icon: Icon,
  title,
  value,
}: {
  icon: typeof UserRound;
  title: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-outline-variant/30 py-4 last:border-b-0">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-container text-on-primary-container">
          <Icon className="h-4 w-4" />
        </div>
        <span className="font-label-lg text-label-lg text-on-surface">{title}</span>
      </div>
      <span className="text-right text-body-sm text-on-surface-variant">{value}</span>
    </div>
  );
}

export default function SettingsPage() {
  const user = useAuthStore((state) => state.user);

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Account and workspace preferences"
      />

      <div className="grid gap-lg lg:grid-cols-2">
        <section className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-lg shadow-sm">
          <h2 className="mb-2 font-title-lg text-title-lg text-on-surface">Profile</h2>
          <p className="mb-4 text-body-sm text-on-surface-variant">
            Your signed-in account details.
          </p>
          <SettingRow icon={UserRound} title="Name" value={user?.name ?? "Not available"} />
          <SettingRow icon={ShieldCheck} title="Role" value={user?.role?.replaceAll("_", " ") ?? "Not available"} />
          <SettingRow icon={Bell} title="Email" value={user?.email ?? "Not available"} />
        </section>

        <section className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-lg shadow-sm">
          <h2 className="mb-2 font-title-lg text-title-lg text-on-surface">Workspace</h2>
          <p className="mb-4 text-body-sm text-on-surface-variant">
            Current app configuration.
          </p>
          <SettingRow icon={Database} title="Data Source" value="Live API and Prisma database" />
          <SettingRow icon={ShieldCheck} title="Access Control" value="Role-based permissions enabled" />
          <SettingRow icon={Bell} title="Notifications" value="In-app alerts enabled" />
        </section>
      </div>
    </>
  );
}
