"use client";

import { useState, useEffect, useLayoutEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  FileCheck,
  ClipboardList,
  Package,
  Wallet,
  FileText,
  Shield,
  ShieldAlert,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  X,
  BookOpen,
  Warehouse,
  UserCog,
  Landmark,
  Inbox,
  GitMerge,
  ArrowLeftRight,
  TrendingUp,
  Sliders,
  PieChart,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import useSWR from "swr";
import { useSidebar } from "@/components/sidebar-provider";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useLanguage } from "@/lib/i18n/language-context";
import { authClient } from "@/lib/auth-client";
import { getRoleLabel } from "@/lib/roles";

// Access decision is computed server-side by the proxy and handed to the client
// through a readable "nav_access" cookie, so the sidebar can render the correct
// links on the very first paint (no flash of forbidden pages).
type NavAccess = { allowedPaths: string[]; isAdmin: boolean };

function readNavAccessCookie(): NavAccess | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(/(?:^|;\s*)nav_access=([^;]+)/);
  if (!match) return undefined;
  try {
    const parsed = JSON.parse(decodeURIComponent(match[1])) as Partial<NavAccess>;
    if (Array.isArray(parsed.allowedPaths)) {
      return { allowedPaths: parsed.allowedPaths, isAdmin: Boolean(parsed.isAdmin) };
    }
  } catch {
    // Ignore malformed cookie; SWR will resolve access shortly after.
  }
  return undefined;
}

// Runs before paint on the client; falls back to a no-op effect on the server
// to avoid the useLayoutEffect SSR warning.
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

interface NavItemProps {
  href: string;
  icon: React.ElementType;
  title: string;
  isActive: boolean;
  isCollapsed: boolean;
  onClick?: () => void;
}

function NavItem({ href, icon: Icon, title, isActive, isCollapsed, onClick }: NavItemProps) {
  const linkContent = (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
        isCollapsed && "justify-center px-2",
        isActive
          ? "bg-sidebar-accent text-sidebar-primary"
          : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
      )}
    >
      <Icon className="h-5 w-5 shrink-0" />
      {!isCollapsed && <span>{title}</span>}
    </Link>
  );

  if (isCollapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
        <TooltipContent side="right" className="font-medium">
          {title}
        </TooltipContent>
      </Tooltip>
    );
  }

  return linkContent;
}

function SidebarContent({ isCollapsed, onNavClick }: { isCollapsed: boolean; onNavClick?: () => void }) {
  const pathname = usePathname();
  const { toggleSidebar } = useSidebar();
  const { language, t } = useLanguage();
  const router = useRouter();
  const { data: session } = authClient.useSession();

  // Current user display info derived from the session.
  const userName = session?.user?.name ?? session?.user?.email ?? "—";
  const userInitials =
    session?.user?.name
      ?.split(" ")
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() ||
    session?.user?.email?.[0]?.toUpperCase() ||
    "?";

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push("/sign-in");
    router.refresh();
  };

  // Access seeded synchronously from the server-set cookie, applied before the
  // first paint so no forbidden links ever flash. Starts undefined so SSR and
  // the client's first hydration render match (both hide everything).
  const [serverAccess, setServerAccess] = useState<NavAccess | undefined>(undefined);
  useIsomorphicLayoutEffect(() => {
    const fromCookie = readNavAccessCookie();
    if (fromCookie) setServerAccess(fromCookie);
  }, []);

  // SWR still revalidates in the background to refresh access and resolve the
  // human-readable role label (which covers custom roles).
  const { data: access } = useSWR<{
    role: string | null;
    roleLabel: string | null;
    allowedPaths: string[];
    isAdmin?: boolean;
  }>("/api/access/me", (url: string) => fetch(url).then((r) => r.json()));

  // Prefer the freshest source: SWR data when available, otherwise the cookie.
  const allowedPaths = access?.allowedPaths ?? serverAccess?.allowedPaths;
  const isAdmin = access?.isAdmin ?? serverAccess?.isAdmin ?? false;
  // Human-readable role label resolved server-side (covers custom roles).
  const userRole = access?.roleLabel ?? getRoleLabel((session?.user as { role?: string } | undefined)?.role);
  // Until access is known, hide every link (instead of showing them all) so a
  // restricted profile never sees pages it shouldn't, even for a frame.
  const canSee = (href: string) => Boolean(allowedPaths && allowedPaths.includes(href));

  const mainNavItems = [
    { title: t.nav.dashboard, href: "/", icon: LayoutDashboard },
    { title: t.nav.counterparties, href: "/counterparties", icon: Users },
    { title: t.nav.onboarding, href: "/onboarding", icon: FileCheck },
    { title: t.nav.approvalQueue, href: "/approval-queue", icon: ClipboardList },
    { title: t.nav.riskManagement, href: "/risk-management", icon: ShieldAlert },
    { title: language === "fr" ? "Politique Monétaire" : "Monetary Policy", href: "/monetary-policy", icon: Landmark },
    { title: language === "fr" ? "Transactions" : "Transactions", href: "/transactions", icon: ArrowLeftRight },
  ].filter((item) => canSee(item.href));

  const monetaryPolicyNavItems = [
    { title: language === "fr" ? "Prévisions" : "Forecasts", href: "/previsions", icon: TrendingUp },
    { title: language === "fr" ? "Calibration" : "Calibration", href: "/calibration", icon: Sliders },
    { title: language === "fr" ? "Gestion des réserves" : "Reserve Management", href: "/gestion-reserves", icon: PieChart },
    { title: language === "fr" ? "Impact Macro" : "Macro Impact", href: "/impact-macro", icon: Activity },
  ].filter((item) => canSee(item.href));

  const operationsNavItems = [
    { title: t.nav.purchaseOrders, href: "/purchase-orders", icon: Package },
    { title: language === "fr" ? "File Manifestes" : "Manifest Queue", href: "/manifest-queue", icon: Inbox },
    { title: language === "fr" ? "Cycle de vie PO" : "PO Lifecycle", href: "/po-lifecycle", icon: GitMerge },
{ title: language === "fr" ? "Réception Coffre" : "Vault Intake", href: "/vault-intake", icon: Warehouse },
{ title: t.nav.settlements, href: "/settlements", icon: Wallet },
  ].filter((item) => canSee(item.href));

  const systemNavItems = [
    { title: t.nav.reports, href: "/reports", icon: FileText },
    { title: t.nav.auditLog, href: "/audit", icon: Shield },
    { title: t.nav.settings, href: "/settings", icon: Settings },
    { title: language === "fr" ? "Documentation" : "Documentation", href: "/documentation", icon: BookOpen },
  ].filter((item) => canSee(item.href));

  const adminNavItems = isAdmin
    ? [{ title: language === "fr" ? "Administration" : "Administration", href: "/admin", icon: UserCog }]
    : [];

  return (
    <>
      {/* Header */}
      <Link
        href="/"
        onClick={onNavClick}
        className={cn(
          "flex h-16 items-center border-b border-sidebar-border transition-colors hover:bg-sidebar-accent/50",
          isCollapsed ? "justify-center px-2" : "gap-3 px-6"
        )}
      >
        {isCollapsed ? (
          <img src="/logo-mark.svg" alt="KONEX" className="h-9 w-9 shrink-0" />
        ) : (
          <img src="/logo.svg" alt="KONEX Gold Reserve Management" className="h-10 w-auto max-w-[200px]" />
        )}
      </Link>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-4">
        <div className="space-y-6">
          <div>
            {!isCollapsed && (
              <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
                {t.nav.main}
              </p>
            )}
            <ul className="space-y-1">
              {mainNavItems.map((item) => (
                <li key={item.href}>
                  <NavItem
                    href={item.href}
                    icon={item.icon}
                    title={item.title}
                    isActive={pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))}
                    isCollapsed={isCollapsed}
                    onClick={onNavClick}
                  />
                </li>
              ))}
            </ul>
          </div>

          {monetaryPolicyNavItems.length > 0 && (
            <div>
              {!isCollapsed && (
                <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
                  {language === "fr" ? "Politique Monétaire" : "Monetary Policy"}
                </p>
              )}
              <ul className="space-y-1">
                {monetaryPolicyNavItems.map((item) => (
                  <li key={item.href}>
                    <NavItem
                      href={item.href}
                      icon={item.icon}
                      title={item.title}
                      isActive={pathname === item.href || pathname.startsWith(item.href + "/")}
                      isCollapsed={isCollapsed}
                      onClick={onNavClick}
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            {!isCollapsed && (
              <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
                {t.nav.operations}
              </p>
            )}
            <ul className="space-y-1">
              {operationsNavItems.map((item) => (
                <li key={item.href}>
                  <NavItem
                    href={item.href}
                    icon={item.icon}
                    title={item.title}
                    isActive={pathname === item.href}
                    isCollapsed={isCollapsed}
                    onClick={onNavClick}
                  />
                </li>
              ))}
            </ul>
          </div>

          <div>
            {!isCollapsed && (
              <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
                {t.nav.system}
              </p>
            )}
            <ul className="space-y-1">
              {systemNavItems.map((item) => (
                <li key={item.href}>
                  <NavItem
                    href={item.href}
                    icon={item.icon}
                    title={item.title}
                    isActive={pathname === item.href}
                    isCollapsed={isCollapsed}
                    onClick={onNavClick}
                  />
                </li>
              ))}
            </ul>
          </div>

          {adminNavItems.length > 0 && (
            <div>
              {!isCollapsed && (
                <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
                  Administration
                </p>
              )}
              <ul className="space-y-1">
                {adminNavItems.map((item) => (
                  <li key={item.href}>
                    <NavItem
                      href={item.href}
                      icon={item.icon}
                      title={item.title}
                      isActive={pathname === item.href || pathname.startsWith(item.href + "/")}
                      isCollapsed={isCollapsed}
                      onClick={onNavClick}
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </nav>

      {/* Collapse Toggle - Desktop only */}
      <div className="hidden lg:block border-t border-sidebar-border p-2">
        <button
          onClick={toggleSidebar}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
            isCollapsed && "justify-center px-2"
          )}
        >
          {isCollapsed ? (
            <ChevronRight className="h-5 w-5" />
          ) : (
            <>
              <ChevronLeft className="h-5 w-5" />
              <span>{t.nav.collapse}</span>
            </>
          )}
        </button>
      </div>

      {/* User Section */}
      <div className="border-t border-sidebar-border p-3">
        <div
          className={cn(
            "flex items-center",
            isCollapsed ? "justify-center" : "gap-3"
          )}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sidebar-accent">
            <span className="text-sm font-medium">{userInitials}</span>
          </div>
          {!isCollapsed && (
            <>
              <div className="flex-1 overflow-hidden">
                <p className="truncate text-sm font-medium">{userName}</p>
                <p className="truncate text-xs text-sidebar-foreground/70">
                  {userRole}
                </p>
              </div>
              <button
                onClick={handleSignOut}
                aria-label="Se déconnecter"
                className="shrink-0 rounded-lg p-2 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

export function AppSidebar() {
  const { isCollapsed, isMobileOpen, closeMobile } = useSidebar();

  return (
    <TooltipProvider>
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden lg:flex h-screen flex-col bg-sidebar text-sidebar-foreground transition-all duration-300",
          isCollapsed ? "w-16" : "w-64"
        )}
      >
        <SidebarContent isCollapsed={isCollapsed} />
      </aside>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={closeMobile}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-sidebar text-sidebar-foreground transition-transform duration-300 lg:hidden",
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Mobile Close Button */}
        <button
          onClick={closeMobile}
          className="absolute right-3 top-4 rounded-lg p-2 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <X className="h-5 w-5" />
        </button>
        <SidebarContent isCollapsed={false} onNavClick={closeMobile} />
      </aside>
    </TooltipProvider>
  );
}
