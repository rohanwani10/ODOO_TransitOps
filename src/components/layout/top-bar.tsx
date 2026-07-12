"use client";
import { Search, Moon, Bell } from "lucide-react";

import { useAuthStore } from "@/stores/auth-store";

export function TopBar() {
  const user = useAuthStore((state) => state.user);
  const initial = user?.name ? user.name.charAt(0).toUpperCase() : "?";

  return (
    <header className="fixed top-0 left-[64px] lg:left-[240px] right-0 h-16 bg-surface/80 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] z-40 flex items-center justify-between px-lg">
      <div className="flex items-center gap-4 text-on-surface">
        <span className="font-headline-md text-title-md hidden sm:block">Operations Platform</span>
      </div>

      <div className="flex-1 max-w-md mx-xl hidden md:block">
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-on-surface-variant group-focus-within:text-primary transition-colors" />
          <input
            type="text"
            className="w-full bg-surface-container-low border border-outline-variant rounded-full py-2 pl-10 pr-4 text-body-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            placeholder="Search fleet, drivers, or trips..."
          />
        </div>
      </div>

      <div className="flex items-center gap-md">
        <button className="p-2 rounded-full hover:bg-surface-container-high text-on-surface-variant transition-colors">
          <Moon className="h-5 w-5" />
        </button>
        <button className="relative p-2 rounded-full hover:bg-surface-container-high text-on-surface-variant transition-colors">
          <Bell className="h-5 w-5" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-error rounded-full border-2 border-surface"></span>
        </button>
        <div className="flex items-center gap-sm pl-md border-l border-outline-variant/30">
          <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-sm ring-2 ring-surface-container-high shadow-sm">
            {initial}
          </div>
        </div>
      </div>
    </header>
  );
}
