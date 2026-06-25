import { useMemo } from "react";
import { useLanguage } from "@/lib/i18n/language-context";

interface SearchResult {
  id: string;
  name: string;
  category: string;
  route: string;
  description: string;
  userStory?: string;
}

export function useDocumentationSearch(query: string): SearchResult[] {
  const { t, language } = useLanguage();

  const results = useMemo(() => {
    if (!query.trim()) return [];

    const searchTerm = query.toLowerCase();
    const results: SearchResult[] = [];

    // Get documentation sections based on language
    const docSections = language === "fr" ? 
      (require("@/app/documentation/page").documentationSectionsFr) :
      (require("@/app/documentation/page").documentationSectionsEn);

    if (!docSections || !docSections.pages) {
      return [];
    }

    // Search through all pages
    docSections.pages.forEach((page: any) => {
      const pageMatches =
        page.name.toLowerCase().includes(searchTerm) ||
        page.id.toLowerCase().includes(searchTerm) ||
        page.businessDescription?.toLowerCase().includes(searchTerm) ||
        page.category?.toLowerCase().includes(searchTerm) ||
        page.userStory?.toLowerCase().includes(searchTerm);

      if (pageMatches) {
        results.push({
          id: page.id,
          name: page.name,
          category: page.category || "Documentation",
          route: page.route,
          description: page.businessDescription?.substring(0, 80) + "..." || page.name,
          userStory: page.userStory,
        });
      }
    });

    return results.slice(0, 10); // Limit to 10 results
  }, [query, language]);

  return results;
}
