import { cn } from "@/lib/utils";
import { Circle } from "lucide-react";

export type StatusType =
  | "available"
  | "valid"
  | "completed"
  | "on_trip"
  | "active"
  | "dispatched"
  | "in_shop"
  | "expiring_soon"
  | "draft"
  | "pending"
  | "suspended"
  | "expired"
  | "cancelled"
  | "retired"
  | "inactive";

interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  variant?: "default" | "table";
  className?: string;
}

export function StatusBadge({ status, label, variant = "default", className }: StatusBadgeProps) {
  let bgClass = "";
  let textClass = "";
  let showDot = false;
  let dotColor = "";

  switch (status) {
    case "available":
    case "valid":
    case "completed":
      bgClass = "bg-green-100 dark:bg-green-900/30";
      textClass = "text-green-700 dark:text-green-400";
      showDot = true;
      dotColor = "text-green-500";
      break;
    case "on_trip":
    case "active":
    case "dispatched":
      bgClass = "bg-secondary-container";
      textClass = "text-on-secondary-container";
      break;
    case "in_shop":
    case "expiring_soon":
    case "draft":
    case "pending":
      bgClass = "bg-tertiary-fixed";
      textClass = "text-on-tertiary-fixed-variant";
      break;
    case "suspended":
    case "expired":
    case "cancelled":
      bgClass = "bg-error-container";
      textClass = "text-error";
      break;
    case "retired":
    case "inactive":
      bgClass = "bg-surface-container-highest";
      textClass = "text-on-surface-variant";
      break;
  }

  const defaultLabel = status.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center font-label-md whitespace-nowrap",
        variant === "default" ? "px-3 py-1 rounded-full text-label-md" : "px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider rounded-full",
        bgClass,
        textClass,
        className
      )}
    >
      {showDot && (
        <Circle
          className={cn("w-2 h-2 mr-1.5 fill-current animate-pulse", dotColor)}
        />
      )}
      {label || defaultLabel}
    </span>
  );
}
