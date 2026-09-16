"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const PAGE_SIZE = 10

/** Client-side pagination over an already-filtered row array. Resets to page 1 whenever the row count changes (new search/filter). */
export function useBccPage<T>(rows: T[]) {
  const [page, setPage] = useState(1)
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const current = Math.min(page, pageCount)
  const paged = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)
  return { page: current, setPage, pageCount, paged, total: rows.length, pageSize: PAGE_SIZE }
}

export function BccStatusFilter({ value, onChange, statuses, fr }: { value: string; onChange: (value: string) => void; statuses: string[]; fr: boolean }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder={fr ? "Statut" : "Status"} /></SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{fr ? "Tous les statuts" : "All statuses"}</SelectItem>
        {statuses.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
      </SelectContent>
    </Select>
  )
}

export function BccPager({ page, pageCount, setPage, total, pageSize, fr }: { page: number; pageCount: number; setPage: (updater: (p: number) => number) => void; total: number; pageSize: number; fr: boolean }) {
  if (total === 0) return null
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)
  return (
    <div className="flex flex-col gap-2 border-t px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <span>{fr ? `${from}–${to} sur ${total}` : `${from}–${to} of ${total}`}</span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-4 w-4" />{fr ? "Précédent" : "Previous"}</Button>
        <span className="px-1 tabular-nums">{fr ? "Page" : "Page"} {page} / {pageCount}</span>
        <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => setPage(p => p + 1)}>{fr ? "Suivant" : "Next"}<ChevronRight className="h-4 w-4" /></Button>
      </div>
    </div>
  )
}
