"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/lib/i18n/language-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface SearchResult {
  id: string;
  name: string;
  category: string;
  route: string;
  description: string;
  userStory?: string;
}

export function DocumentationSearch() {
  const router = useRouter();
  const { t, language } = useLanguage();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch and filter documentation pages
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const searchTerm = query.toLowerCase();
    const filtered: SearchResult[] = [];

    // For now, we'll search through a hardcoded list of pages
    // In production, this could be fetched from an API
    const allPages = [
      {
        id: "dashboard",
        name: "Market Oversight",
        category: "Pilotage",
        route: "/",
        businessDescription: language === "fr" ? "Centre de commande central" : "Central command center",
      },
      {
        id: "counterparties",
        name: language === "fr" ? "Contreparties" : "Counterparties",
        category: "Pilotage",
        route: "/counterparties",
        businessDescription: language === "fr" ? "Maître list de tous les fournisseurs d'or enregistrés" : "Master list of all registered gold suppliers",
      },
      {
        id: "onboarding",
        name: language === "fr" ? "Intégration" : "Onboarding",
        category: "Pilotage",
        route: "/onboarding",
        businessDescription: language === "fr" ? "Formulaire d'intégration de nouvelles contreparties" : "New counterparty onboarding form",
      },
      {
        id: "approval-queue",
        name: language === "fr" ? "File d'approbation" : "Approval Queue",
        category: "Pilotage",
        route: "/approval-queue",
        businessDescription: language === "fr" ? "Revue et décision sur les dossiers de contreparties" : "Review and decision queue for counterparty records",
      },
      {
        id: "risk-management",
        name: language === "fr" ? "Gestion des risques" : "Risk Management",
        category: "Pilotage",
        route: "/risk-management",
        businessDescription: language === "fr" ? "Évaluation des facteurs et niveaux de risque" : "Risk-factor assessment and tier management",
      },
      {
        id: "transactions",
        name: "Transactions",
        category: "Pilotage",
        route: "/transactions",
        businessDescription: language === "fr" ? "Vue consolidée des transactions d'or" : "Consolidated gold transaction view",
      },
      {
        id: "purchase-orders",
        name: language === "fr" ? "Ordres d'Achat" : "Purchase Orders",
        category: "Operations",
        route: "/purchase-orders",
        businessDescription: language === "fr" ? "Gestion des ordres d'acquisition d'or" : "Gold acquisition order management",
      },
      {
        id: "manifests",
        name: language === "fr" ? "Manifestes d'expédition" : "Shipment Manifests",
        category: "Operations",
        route: "/manifest-queue",
        businessDescription: language === "fr" ? "Soumission et revue des manifestes documentaires" : "Shipment manifest submission and review",
      },
      {
        id: "refining-orders",
        name: language === "fr" ? "Ordres de raffinage" : "Refining Orders",
        category: "Operations",
        route: "/refining-orders",
        businessDescription: language === "fr" ? "Raffinage, outturn et éligibilité aux réserves" : "Refining, outturn and reserve eligibility",
      },
      {
        id: "non-monetary-holdings",
        name: language === "fr" ? "Avoirs d'or non monétaire" : "Non-monetary Gold Holdings",
        category: "Operations",
        route: "/non-monetary-holdings",
        businessDescription: language === "fr" ? "Suivi et remédiation des lots non éligibles" : "Monitoring and remediation of ineligible holdings",
      },
      {
        id: "dispatch",
        name: language === "fr" ? "Dispatch" : "Dispatch",
        category: "Operations",
        route: "/dispatch",
        businessDescription: language === "fr" ? "Validation pré-expédition" : "Pre-shipment dispatch",
      },
      {
        id: "vault-intake",
        name: language === "fr" ? "Réception Coffre" : "Vault Intake",
        category: "Operations",
        route: "/vault-intake",
        businessDescription: language === "fr" ? "Réception et vérification d'or au coffre" : "Gold receipt and verification",
      },
      {
        id: "assays",
        name: language === "fr" ? "Essais" : "Assays",
        category: "Operations",
        route: "/assays",
        businessDescription: language === "fr" ? "Tests de laboratoire et vérification de pureté" : "Laboratory testing and purity verification",
      },
      {
        id: "settlements",
        name: language === "fr" ? "Règlements" : "Settlements",
        category: "Operations",
        route: "/settlements",
        businessDescription: language === "fr" ? "Valorisation et règlement financier" : "Valuation and settlement",
      },
      {
        id: "po-lifecycle",
        name: language === "fr" ? "Cycle de vie PO" : "PO Lifecycle",
        category: "Operations",
        route: "/po-lifecycle",
        businessDescription: language === "fr" ? "Carte des statuts et acteurs du bon de commande" : "Purchase-order status and actor map",
      },
      {
        id: "reports",
        name: language === "fr" ? "Rapports" : "Reports",
        category: "System",
        route: "/reports",
        businessDescription: language === "fr" ? "Rapports opérationnels et réglementaires" : "Operational and regulatory reports",
      },
      {
        id: "audit",
        name: language === "fr" ? "Audit & Conformité" : "Audit & Compliance",
        category: "System",
        route: "/audit",
        businessDescription: language === "fr" ? "Piste d'audit immuable et export réglementaire" : "Immutable audit trail and regulatory export",
      },
      {
        id: "documentation",
        name: language === "fr" ? "Documentation" : "Documentation",
        category: "System",
        route: "/documentation",
        businessDescription: language === "fr" ? "Guide complet de la plateforme" : "Complete platform guide",
      },
      {
        id: "settings",
        name: language === "fr" ? "Paramètres" : "Settings",
        category: "System",
        route: "/settings",
        businessDescription: language === "fr" ? "Configuration des paramètres applicatifs" : "Application settings configuration",
      },
      {
        id: "admin",
        name: language === "fr" ? "Administration" : "Administration",
        category: "Administration",
        route: "/admin",
        businessDescription: language === "fr" ? "Utilisateurs, rôles et accès" : "Users, roles and access",
      },
    ];

    // Filter based on query
    allPages.forEach((page) => {
      if (
        page.name.toLowerCase().includes(searchTerm) ||
        page.id.toLowerCase().includes(searchTerm) ||
        page.businessDescription.toLowerCase().includes(searchTerm) ||
        page.category.toLowerCase().includes(searchTerm)
      ) {
        filtered.push({
          id: page.id,
          name: page.name,
          category: page.category,
          route: page.route,
          description: page.businessDescription.substring(0, 60) + "...",
        });
      }
    });

    setResults(filtered.slice(0, 10));
    setIsOpen(filtered.length > 0);
    setSelectedIndex(-1);
  }, [query, language]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev < results.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && results[selectedIndex]) {
        navigateToResult(results[selectedIndex]);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setQuery("");
    }
  };

  const navigateToResult = (result: SearchResult) => {
    router.push(result.route);
    setQuery("");
    setIsOpen(false);
  };

  return (
    <div className="relative hidden md:block w-64">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          placeholder={t.common.search || "Rechercher..."}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => query && setIsOpen(true)}
          className="pl-9 pr-4"
          autoComplete="off"
        />
      </div>

      {/* Search Results Dropdown */}
      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 border border-border rounded-lg bg-card shadow-lg z-50">
          <div className="p-2">
            {results.map((result, index) => (
              <button
                key={result.id}
                onClick={() => navigateToResult(result)}
                className={cn(
                  "w-full px-3 py-2 text-sm text-left rounded-md transition-colors flex items-center justify-between gap-2",
                  selectedIndex === index
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-muted text-foreground"
                )}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{result.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {result.description}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 flex-shrink-0" />
              </button>
            ))}
          </div>
          {results.length > 0 && (
            <div className="px-3 py-2 border-t border-border text-xs text-muted-foreground">
              {results.length} {language === "fr" ? "résultat(s)" : "result(s)"}
            </div>
          )}
        </div>
      )}

      {/* No results message */}
      {isOpen && query && results.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 border border-border rounded-lg bg-card shadow-lg p-3 text-sm text-muted-foreground text-center z-50">
          {language === "fr"
            ? "Aucun résultat trouvé"
            : "No results found"}
        </div>
      )}
    </div>
  );
}
