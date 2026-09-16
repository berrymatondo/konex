import { redirect } from "next/navigation"

export default async function LegacyPurchaseOrdersRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const target = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") target.set(key, value)
  }
  redirect(`/central-bank/transactions/purchase-orders${target.size ? `?${target}` : ""}`)
}
