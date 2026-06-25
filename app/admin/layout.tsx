import type { ReactNode } from "react"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    redirect("/sign-in")
  }
  if ((session.user as { role?: string }).role !== "admin") {
    redirect("/")
  }
  return <>{children}</>
}
