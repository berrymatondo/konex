"use client";

import { Search, HelpCircle, Menu, LogOut, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSidebar } from "@/components/sidebar-provider";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useLanguage } from "@/lib/i18n/language-context";
import { DocumentationSearch } from "@/components/documentation-search";
import { NotificationsBell } from "@/components/notifications-bell";
import { authClient } from "@/lib/auth-client";
import { getRoleLabel } from "@/lib/roles";

interface AppHeaderProps {
  title: string;
  subtitle?: string;
}

export function AppHeader({ title, subtitle }: AppHeaderProps) {
  const { toggleMobile } = useSidebar();
  const { t } = useLanguage();
  const router = useRouter();
  const { data: session } = authClient.useSession();

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push("/sign-in");
    router.refresh();
  };

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-card px-4 md:px-6">
      <div className="flex items-center gap-3">
        {/* Mobile Menu Button */}
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={toggleMobile}
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">{t.header.openMenu}</span>
        </Button>

        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold text-foreground">{title}</h1>
          {subtitle && (
            <p className="truncate text-sm text-muted-foreground hidden sm:block">{subtitle}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        <DocumentationSearch />

        {/* Mobile Search Button */}
        <Button variant="ghost" size="icon" className="md:hidden">
          <Search className="h-5 w-5" />
          <span className="sr-only">{t.common.search}</span>
        </Button>

        <LanguageSwitcher />

        <NotificationsBell />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <HelpCircle className="h-5 w-5" />
              <span className="sr-only">{t.header.help}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>{t.header.helpSupport}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>{t.header.documentation}</DropdownMenuItem>
            <DropdownMenuItem>{t.header.keyboardShortcuts}</DropdownMenuItem>
            <DropdownMenuItem>{t.header.contactSupport}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <User className="h-5 w-5" />
              <span className="sr-only">{session?.user?.name ?? "Compte"}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="flex flex-col gap-0.5">
              <span className="truncate">
                {session?.user?.name ?? session?.user?.email ?? "Compte"}
              </span>
              <span className="text-xs font-normal text-muted-foreground">
                {getRoleLabel((session?.user as { role?: string } | undefined)?.role)}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Se déconnecter
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
