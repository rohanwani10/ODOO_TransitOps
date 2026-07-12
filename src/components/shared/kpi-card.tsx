import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, LucideIcon } from "lucide-react";

interface KPICardProps {
  title: string;
  value: string | number;
  trend?: number;
  trendLabel?: string;
  icon?: LucideIcon;
  progress?: number;
  variant?: "default" | "hero";
  className?: string;
}

export function KPICard({
  title,
  value,
  trend,
  trendLabel,
  icon: Icon,
  progress,
  variant = "default",
  className,
}: KPICardProps) {
  if (variant === "hero") {
    return (
      <div className={cn("bg-primary text-on-primary p-xl rounded-xl shadow-xl relative overflow-hidden", className)}>
        <span className="font-label-md text-label-md text-on-primary/70 uppercase tracking-wider block mb-2">
          {title}
        </span>
        <div className="flex items-baseline gap-2 mb-4">
          <span className="font-display-lg text-display-lg">{value}</span>
          {trend !== undefined && (
            <div className="flex items-center gap-1 font-label-md text-green-300">
              {trend >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4 text-red-300" />}
              <span className={trend < 0 ? "text-red-300" : ""}>{Math.abs(trend)}%</span>
            </div>
          )}
        </div>
        
        {progress !== undefined && (
          <div className="mt-4 h-1 w-full bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white transition-all duration-700"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn("bg-surface-container-lowest p-md rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between group", className)}>
      <span className="text-caption font-caption text-on-surface-variant uppercase tracking-wider block">
        {title}
      </span>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-headline-md font-headline-md text-on-surface">{value}</span>
        {trend !== undefined && (
          <div className="flex items-center gap-1">
            {trend >= 0 ? (
              <span className="text-caption font-caption text-primary">+{trend}%</span>
            ) : (
              <span className="text-caption font-caption text-error">{trend}%</span>
            )}
            {trendLabel && <span className="text-caption font-caption text-outline ml-1">{trendLabel}</span>}
          </div>
        )}
      </div>

      {progress !== undefined && (
         <div className="mt-4 h-1 w-full bg-surface-container-high rounded-full overflow-hidden">
           <div
             className="h-full bg-primary transition-all duration-700 group-hover:w-full"
             style={{ width: `${progress}%` }}
           />
         </div>
      )}

      {Icon && !trend && progress === undefined && (
        <div className="mt-4 flex items-center gap-1 text-primary">
          <Icon className="w-4 h-4" />
          {trendLabel && <span className="text-caption font-caption">{trendLabel}</span>}
        </div>
      )}
    </div>
  );
}
