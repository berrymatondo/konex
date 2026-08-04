import type { ElementType, ReactNode } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const OZ_PER_KG = 32.1507;

export function WorkflowStepper({ labels, active, hrefs }: { labels: string[]; active: number; hrefs?: Array<string | undefined> }) {
  return (
    <div className="flex w-full items-start overflow-x-auto rounded-lg border bg-card px-4 py-4">
      {labels.map((label, index) => {
        const done = index < active;
        const current = index === active;
        return (
          <div key={label} className="flex min-w-0 flex-1 items-start last:flex-none">
            <Link href={hrefs?.[index] ?? "#"} aria-current={current ? "step" : undefined} className={`flex min-w-[74px] flex-col items-center gap-1.5 text-center ${hrefs?.[index] ? "rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" : "pointer-events-none"}`}>
              <span className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold ${done ? "border-primary bg-primary text-primary-foreground" : current ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>
                {done ? <Check className="h-4 w-4" /> : index + 1}
              </span>
              <span className={`whitespace-nowrap text-[11px] ${current || done ? "font-medium text-foreground" : "text-muted-foreground"}`}>{label}</span>
            </Link>
            {index < labels.length - 1 && <span className={`mt-3.5 h-px min-w-5 flex-1 ${done ? "bg-primary" : "bg-border"}`} />}
          </div>
        );
      })}
    </div>
  );
}

export function RefiningPanel({ icon: Icon, title, badge, children, className = "" }: { icon: ElementType; title: ReactNode; badge?: string; children: ReactNode; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader className="border-b px-5 py-4">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Icon className="h-4 w-4 text-primary" />
          {title}
          {badge && <Badge variant="outline" className="ml-1 border-primary/40 text-primary">{badge}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-5">{children}</CardContent>
    </Card>
  );
}

export function InfoCell({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return <div className={className}><p className="mb-1 text-[11px] text-muted-foreground">{label}</p><div className="text-sm font-medium">{children}</div></div>;
}

export function StatusPill({ tone = "muted", children }: { tone?: "muted" | "warning" | "success" | "danger" | "info"; children: ReactNode }) {
  const styles = {
    muted: "border-border text-muted-foreground",
    warning: "border-amber-500/40 bg-amber-500/10 text-amber-500",
    success: "border-emerald-500/40 bg-emerald-500/10 text-emerald-500",
    danger: "border-destructive/40 bg-destructive/10 text-destructive",
    info: "border-sky-500/40 bg-sky-500/10 text-sky-500",
  };
  return <Badge variant="outline" className={styles[tone]}>{children}</Badge>;
}

export function Timeline({ items }: { items: { title: string; meta: string; state: "done" | "current" | "pending" }[] }) {
  return (
    <div className="space-y-0">
      {items.map((item, index) => (
        <div key={`${item.title}-${index}`} className="relative flex gap-4 pb-6 last:pb-0">
          {index < items.length - 1 && <span className={`absolute left-[7px] top-4 h-full w-px ${item.state === "done" ? "bg-primary" : "bg-border"}`} />}
          <span className={`relative mt-1.5 h-[15px] w-[15px] shrink-0 rounded-full border-2 ${item.state === "done" ? "border-primary bg-primary" : item.state === "current" ? "border-primary bg-background" : "border-border bg-background"}`} />
          <div><p className={`text-sm font-medium ${item.state === "pending" ? "text-muted-foreground" : ""}`}>{item.title}</p><p className="mt-1 text-xs text-muted-foreground">{item.meta}</p></div>
        </div>
      ))}
    </div>
  );
}
