export type PageGroup = "main" | "operations" | "system" | "admin"

export interface AppPage {
  /** Stable identifier stored in the access table. */
  key: string
  /** Route path used both for the menu and URL matching. */
  path: string
  labelFr: string
  labelEn: string
  group: PageGroup
}

/**
 * Single source of truth for every navigable page in the app.
 * Used by the access matrix (admin UI), the sidebar filtering and the
 * proxy URL guard. The `key` is what gets persisted in `role_page_access`.
 */
export const PAGES: AppPage[] = [
  // Main
  { key: "dashboard", path: "/", labelFr: "Tableau de bord", labelEn: "Dashboard", group: "main" },
  { key: "counterparties", path: "/counterparties", labelFr: "Contreparties", labelEn: "Counterparties", group: "main" },
  { key: "onboarding", path: "/onboarding", labelFr: "Intégration", labelEn: "Onboarding", group: "main" },
  { key: "approval-queue", path: "/approval-queue", labelFr: "File d'approbation", labelEn: "Approval Queue", group: "main" },
  { key: "risk-management", path: "/risk-management", labelFr: "Gestion des risques", labelEn: "Risk Management", group: "main" },
  { key: "monetary-policy", path: "/monetary-policy", labelFr: "Politique monétaire", labelEn: "Monetary Policy", group: "main" },

  // Operations
  { key: "purchase-orders", path: "/purchase-orders", labelFr: "Ordres d'achat", labelEn: "Purchase Orders", group: "operations" },
  { key: "manifest-queue", path: "/manifest-queue", labelFr: "File Manifestes", labelEn: "Manifest Queue", group: "operations" },
  { key: "po-lifecycle", path: "/po-lifecycle", labelFr: "Cycle de vie PO", labelEn: "PO Lifecycle", group: "operations" },
  { key: "dispatch", path: "/dispatch", labelFr: "Expédition", labelEn: "Dispatch", group: "operations" },
  { key: "vault-intake", path: "/vault-intake", labelFr: "Réception Coffre", labelEn: "Vault Intake", group: "operations" },
  { key: "assays", path: "/assays", labelFr: "Essais", labelEn: "Assays", group: "operations" },
  { key: "settlements", path: "/settlements", labelFr: "Règlements", labelEn: "Settlements", group: "operations" },

  // System
  { key: "reports", path: "/reports", labelFr: "Rapports", labelEn: "Reports", group: "system" },
  { key: "audit", path: "/audit", labelFr: "Journal d'audit", labelEn: "Audit Log", group: "system" },
  { key: "settings", path: "/settings", labelFr: "Paramètres", labelEn: "Settings", group: "system" },
  { key: "documentation", path: "/documentation", labelFr: "Documentation", labelEn: "Documentation", group: "system" },

  // Admin-only section
  { key: "admin", path: "/admin", labelFr: "Administration", labelEn: "Administration", group: "admin" },
  { key: "admin-equipment", path: "/admin/equipment", labelFr: "Registre Équipements", labelEn: "Equipment Register", group: "admin" },
]

export const PAGE_KEYS = PAGES.map((p) => p.key)

/** Pages that appear in the configurable access matrix (admin section excluded — it is always admin-only). */
export const ASSIGNABLE_PAGES = PAGES.filter((p) => p.group !== "admin")

export function getPageByPath(pathname: string): AppPage | undefined {
  // Exact match first, then longest path prefix (for nested routes).
  const exact = PAGES.find((p) => p.path === pathname)
  if (exact) return exact
  return PAGES.filter((p) => p.path !== "/" && pathname.startsWith(p.path + "/")).sort(
    (a, b) => b.path.length - a.path.length,
  )[0]
}

export function getPathByKey(key: string): string | undefined {
  return PAGES.find((p) => p.key === key)?.path
}
