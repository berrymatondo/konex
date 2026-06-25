"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Plus, ArrowRight, Clock } from "lucide-react"
import { SCENARIO_TEMPLATES, fundingLabel, type ScenarioCategory, type ScenarioTemplate } from "@/lib/monetary-policy"
import { useLanguage } from "@/lib/i18n/language-context"

function categoryVariant(cat: ScenarioCategory): "default" | "secondary" | "destructive" | "outline" {
  switch (cat) {
    case "emergency":
      return "destructive"
    case "strategic":
      return "default"
    case "tactical":
      return "secondary"
    default:
      return "outline"
  }
}

function categoryLabel(cat: ScenarioCategory, language: string): string {
  const map: Record<ScenarioCategory, { en: string; fr: string }> = {
    strategic: { en: "Strategic", fr: "Stratégique" },
    tactical: { en: "Tactical", fr: "Tactique" },
    emergency: { en: "Emergency", fr: "Urgence" },
    custom: { en: "Custom", fr: "Personnalisé" },
  }
  return language === "fr" ? map[cat].fr : map[cat].en
}

export function ScenarioLibrary({
  onUseTemplate,
  onCreateCustom,
}: {
  onUseTemplate: (template: ScenarioTemplate) => void
  onCreateCustom: () => void
}) {
  const { language } = useLanguage()
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState<string>("all")

  const filtered = SCENARIO_TEMPLATES.filter((t) => {
    const name = language === "fr" ? t.nameFr : t.name
    const matchesSearch = name.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = category === "all" || t.category === category
    return matchesSearch && matchesCategory
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={language === "fr" ? "Rechercher un modèle..." : "Search templates..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{language === "fr" ? "Toutes catégories" : "All categories"}</SelectItem>
              <SelectItem value="strategic">{categoryLabel("strategic", language)}</SelectItem>
              <SelectItem value="tactical">{categoryLabel("tactical", language)}</SelectItem>
              <SelectItem value="emergency">{categoryLabel("emergency", language)}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={onCreateCustom}>
          <Plus className="mr-2 h-4 w-4" />
          {language === "fr" ? "Scénario personnalisé" : "Custom scenario"}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((template) => (
          <Card key={template.id} className="flex flex-col">
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base">{language === "fr" ? template.nameFr : template.name}</CardTitle>
                <Badge variant={categoryVariant(template.category)}>{categoryLabel(template.category, language)}</Badge>
              </div>
              <CardDescription>{language === "fr" ? template.descriptionFr : template.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col justify-between gap-4">
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">{language === "fr" ? "Taille d'achat" : "Purchase size"}</dt>
                  <dd className="font-medium">
                    {template.purchaseSizePct}% {language === "fr" ? "des réserves" : "of reserves"}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">{language === "fr" ? "Financement" : "Funding"}</dt>
                  <dd className="text-right font-medium">{fundingLabel(template.fundingSource, language)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">{language === "fr" ? "Règlement" : "Settlement"}</dt>
                  <dd className="font-medium">{template.settlementTimeline}</dd>
                </div>
              </dl>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {language === "fr" ? "Utilisé" : "Used"} {template.usageCount}× · {template.lastUsed}
                </span>
              </div>
              <Button variant="outline" className="w-full" onClick={() => onUseTemplate(template)}>
                {language === "fr" ? "Utiliser ce modèle" : "Use template"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
