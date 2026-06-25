import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface KPICardProps {
  title: string;
  value: string | number;
  trend?: number;
  icon: LucideIcon;
  iconColor?: string;
}

export function KPICard({ title, value, trend, icon: Icon, iconColor = "text-primary" }: KPICardProps) {
  const isPositive = trend && trend > 0;
  const isNegative = trend && trend < 0;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold text-foreground">{value}</p>
            {trend !== undefined && (
              <div className="flex items-center gap-1">
                {isPositive ? (
                  <TrendingUp className="h-4 w-4 text-success" />
                ) : isNegative ? (
                  <TrendingDown className="h-4 w-4 text-destructive" />
                ) : null}
                <span
                  className={cn(
                    "text-sm font-medium",
                    isPositive && "text-success",
                    isNegative && "text-destructive",
                    !isPositive && !isNegative && "text-muted-foreground"
                  )}
                >
                  {isPositive && "+"}
                  {trend}%
                </span>
                <span className="text-sm text-muted-foreground">vs last month</span>
              </div>
            )}
          </div>
          <div className={cn("rounded-lg bg-primary/10 p-3", iconColor)}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
