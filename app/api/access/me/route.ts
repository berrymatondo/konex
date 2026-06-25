import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { getAllowedPageKeys } from "@/lib/access-control"
import { getPathByKey } from "@/lib/pages"
import { listRoles } from "@/lib/roles-store"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ role: null, roleLabel: null, allowedPaths: [] }, { status: 200 })
  }

  const role = (session.user as { role?: string }).role ?? "compliance_officer"
  const keys = await getAllowedPageKeys(role)
  const allowedPaths = keys
    .map((k) => getPathByKey(k))
    .filter((p): p is string => Boolean(p))

  // Resolve the human-readable label (covers custom roles too).
  const roles = await listRoles()
  const roleLabel = roles.find((r) => r.key === role)?.label ?? role

  return NextResponse.json({ role, roleLabel, allowedPaths, isAdmin: role === "admin" })
}
