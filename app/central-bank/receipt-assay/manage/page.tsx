import { redirect } from "next/navigation"

export default async function LegacyReceiptAssayRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const target = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") target.set(key, value)
  }
  redirect(`/central-bank/receipt-assay${target.size ? `?${target}` : ""}`)
}
