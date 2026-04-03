import { cn } from "@/lib/utils";

export default function StatsCard({ title, value, icon: Icon, trend, trendLabel, className }) {
  return (
    <div className={cn(
      "bg-card rounded-xl border border-border p-5 transition-all hover:shadow-md hover:border-primary/20",
      className
    )}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground font-medium">{title}</p>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
          {trendLabel && (
            <p className={cn(
              "text-xs font-medium",
              trend > 0 ? "text-wms-success" : trend < 0 ? "text-wms-danger" : "text-muted-foreground"
            )}>
              {trend > 0 ? "↑" : trend < 0 ? "↓" : "→"} {trendLabel}
            </p>
          )}
        </div>
        {Icon && (
          <div className="p-2.5 rounded-lg bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        )}
      </div>
    </div>
  );
}