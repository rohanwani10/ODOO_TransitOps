import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import React from "react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center p-12 text-center bg-white rounded-xl border border-outline-variant/20 shadow-sm", className)}>
      <div className="w-16 h-16 bg-surface-container-low rounded-full flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-primary" />
      </div>
      <h3 className="font-title-md text-title-md text-on-surface mb-2">{title}</h3>
      <p className="font-body-md text-body-md text-on-surface-variant max-w-sm mb-6">
        {description}
      </p>
      {action && <div>{action}</div>}
    </div>
  );
}
