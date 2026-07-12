"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, LogOut, Settings, UserRound } from "lucide-react";

import { useAuthStore } from "@/stores/auth-store";

export function TopBar() {
  const [profileOpen, setProfileOpen] = useState(false);
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const initial = user?.name ? user.name.charAt(0).toUpperCase() : "?";

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      logout();
      router.push("/login");
    }
  };

  return (
    <header className="fixed top-0 left-[64px] lg:left-[240px] right-0 h-16 bg-surface/80 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] z-40 flex items-center justify-between px-lg">
      <div className="flex items-center gap-4 text-on-surface">
        <span className="font-headline-md text-title-md hidden sm:block">Operations Platform</span>
      </div>

      <div className="flex items-center gap-md">
        <button className="relative p-2 rounded-full hover:bg-surface-container-high text-on-surface-variant transition-colors">
          <Bell className="h-5 w-5" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-error rounded-full border-2 border-surface"></span>
        </button>
        <div className="relative flex items-center gap-sm pl-md border-l border-outline-variant/30">
          <button
            type="button"
            onClick={() => setProfileOpen((open) => !open)}
            className="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-sm ring-2 ring-surface-container-high shadow-sm hover:ring-primary/40"
            aria-label="Open profile menu"
            aria-expanded={profileOpen}
          >
            {initial}
          </button>

          {profileOpen && (
            <div className="absolute right-0 top-12 z-[90] w-72 rounded-xl border border-outline-variant bg-surface p-3 text-on-surface shadow-xl">
              <div className="flex items-center gap-3 border-b border-outline-variant/40 pb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-container text-on-primary-container font-bold">
                  {initial}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-label-lg text-label-lg">{user?.name ?? "Guest User"}</p>
                  <p className="truncate text-caption text-on-surface-variant">{user?.email ?? "Not signed in"}</p>
                </div>
              </div>

              <div className="py-2 text-caption text-on-surface-variant">
                Role: <span className="font-medium text-on-surface">{user?.role?.replaceAll("_", " ") ?? "Guest"}</span>
              </div>

              <Link
                href="/settings"
                onClick={() => setProfileOpen(false)}
                className="flex items-center gap-2 rounded-lg px-2 py-2 text-body-sm hover:bg-surface-container-high"
              >
                <Settings className="h-4 w-4" />
                Settings
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-body-sm text-error hover:bg-error-container hover:text-on-error-container"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
              {!user && (
                <Link
                  href="/login"
                  onClick={() => setProfileOpen(false)}
                  className="mt-1 flex items-center gap-2 rounded-lg px-2 py-2 text-body-sm hover:bg-surface-container-high"
                >
                  <UserRound className="h-4 w-4" />
                  Sign in
                </Link>
              )}
            </div>
          )}
          </div>
      </div>
    </header>
  );
}
