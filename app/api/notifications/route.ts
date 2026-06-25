import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/session-user"
import { listNotifications, markNotificationsRead } from "@/lib/notifications"

export const dynamic = "force-dynamic"

// GET: current user's notifications + unread count.
export async function GET() {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ notifications: [], unreadCount: 0 })
  }
  try {
    const data = await listNotifications(user.id)
    return NextResponse.json(data)
  } catch (error) {
    console.error("Error listing notifications:", error)
    return NextResponse.json({ notifications: [], unreadCount: 0 })
  }
}

// POST: mark notifications as read (all, or a provided list of ids).
export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    const body = await request.json().catch(() => ({}))
    const ids = Array.isArray(body?.ids) ? (body.ids as string[]) : undefined
    await markNotificationsRead(user.id, ids)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Error marking notifications read:", error)
    return NextResponse.json({ error: "Failed to update notifications" }, { status: 500 })
  }
}
