"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Car,
  Users,
  Route,
  Wrench,
  Receipt,
  BarChart3,
  Settings,
  LogOut,
  Truck
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import { hasPermission, Resource } from "@/lib/rbac";

const navItems: { name: string; href: string; icon: LucideIcon; resource?: Resource }[] = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Vehicles", href: "/vehicles", icon: Car, resource: "vehicles" },
  { name: "Drivers", href: "/drivers", icon: Users, resource: "drivers" },
  { name: "Trips", href: "/trips", icon: Route, resource: "trips" },
  { name: "Maintenance", href: "/maintenance", icon: Wrench, resource: "maintenance" },
  { name: "Fuel & Expenses", href: "/fuel-expenses", icon: Receipt, resource: "fuel-logs" },
  { name: "Reports", href: "/reports", icon: BarChart3, resource: "reports" },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (e) {
      console.error("Logout error", e);
    } finally {
      logout();
      router.push("/login");
    }
  };

  // Filter items based on user role
  const visibleItems = navItems.filter((item) => {
    if (!item.resource) return true; // Dashboard is always visible
    if (!user) return false;
    return hasPermission(user.role, item.resource, "view");
  });

  return (
    <aside className="fixed left-0 top-0 h-full w-[64px] lg:w-[240px] bg-sidebar z-50 flex flex-col shadow-[0_0_1px_rgba(0,0,0,0.1)] transition-all duration-300">
      <div className="h-16 flex items-center px-4 lg:px-6 shrink-0">
        <Truck className="h-8 w-8 text-primary shrink-0" />
        <span className="hidden lg:block ml-3 font-headline-md text-title-md text-primary truncate">
          TransitOps
        </span>
      </div>

      <nav className="flex-1 py-md px-2 lg:px-4 space-y-xs overflow-y-auto mt-4">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}/`));
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center px-3 py-2 rounded-lg transition-all",
                isActive
                  ? "bg-primary-container text-on-primary-container"
                  : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              <span className="hidden lg:block ml-3 font-label-md">
                {item.name}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="px-2 lg:px-4 py-md border-t border-outline-variant/30 space-y-xs">
        <Link
          href="/settings"
          className="flex items-center px-3 py-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-all"
        >
          <Settings className="h-5 w-5 shrink-0" />
          <span className="hidden lg:block ml-3 font-label-md">Settings</span>
        </Link>
        <button
          onClick={handleLogout}
          className="w-full flex items-center px-3 py-2 rounded-lg text-error hover:bg-error-container hover:text-on-error-container transition-all"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          <span className="hidden lg:block ml-3 font-label-md">Logout</span>
        </button>
      </div>
    </aside>
  );
}
