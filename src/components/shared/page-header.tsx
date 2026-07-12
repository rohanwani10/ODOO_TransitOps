import React from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  filters?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, badge, actions, filters, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-md mb-md", className)}>
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-md">
        <div className="space-y-xs">
          {(badge || subtitle) && (
            <div className="flex items-center gap-sm">
              {badge && badge}
              {subtitle && <span className="text-caption font-caption text-on-surface-variant">{subtitle}</span>}
            </div>
          )}
          <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">{title}</h1>
        </div>
        {actions && <div className="flex items-center gap-sm">{actions}</div>}
      </div>
      {filters && (
        <div className="flex flex-wrap items-center gap-sm bg-surface-container-low p-2 rounded-xl shadow-sm">
          {filters}
        </div>
      )}
    </div>
  );
}
