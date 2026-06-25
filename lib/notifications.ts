import { sql } from "@/lib/db"

export interface Notification {
  id: string
  userId: string
  title: string
  message: string | null
  type: string
  link: string | null
  read: boolean
  createdAt: string
}

// Lazily creates the notifications table (idempotent migration).
let notificationsReady = false
export async function ensureNotificationsTable() {
  if (notificationsReady) return
  await sql`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      message TEXT,
      type TEXT NOT NULL DEFAULT 'info',
      link TEXT,
      read BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications (user_id, created_at DESC)`
  notificationsReady = true
}

/** Creates a notification for a single user. */
export async function createNotification(input: {
  userId: string
  title: string
  message?: string
  type?: string
  link?: string
}): Promise<void> {
  await ensureNotificationsTable()
  await sql`
    INSERT INTO notifications (user_id, title, message, type, link)
    VALUES (${input.userId}, ${input.title}, ${input.message ?? null}, ${input.type ?? "info"}, ${input.link ?? null})
  `
}

/**
 * Creates a notification for every user account linked to a counterparty.
 * Returns the number of users notified.
 */
export async function notifyCounterparty(input: {
  counterpartyId: string
  title: string
  message?: string
  type?: string
  link?: string
}): Promise<number> {
  await ensureNotificationsTable()
  const users = await sql`SELECT id FROM "user" WHERE counterparty_id = ${input.counterpartyId}`
  for (const u of users) {
    await sql`
      INSERT INTO notifications (user_id, title, message, type, link)
      VALUES (${u.id as string}, ${input.title}, ${input.message ?? null}, ${input.type ?? "info"}, ${input.link ?? null})
    `
  }
  return users.length
}

/** Lists a user's notifications (most recent first) with the unread count. */
export async function listNotifications(
  userId: string,
): Promise<{ notifications: Notification[]; unreadCount: number }> {
  await ensureNotificationsTable()
  const rows = await sql`
    SELECT id, user_id, title, message, type, link, read, created_at
    FROM notifications
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT 30
  `
  const notifications = rows.map((r) => ({
    id: r.id as string,
    userId: r.user_id as string,
    title: r.title as string,
    message: (r.message as string | null) ?? null,
    type: r.type as string,
    link: (r.link as string | null) ?? null,
    read: Boolean(r.read),
    createdAt: new Date(r.created_at as string).toISOString(),
  }))
  const unreadCount = notifications.filter((n) => !n.read).length
  return { notifications, unreadCount }
}

/** Marks notifications as read for a user (all, or a specific subset). */
export async function markNotificationsRead(userId: string, ids?: string[]): Promise<void> {
  await ensureNotificationsTable()
  if (ids && ids.length > 0) {
    await sql`UPDATE notifications SET read = true WHERE user_id = ${userId} AND id = ANY(${ids})`
  } else {
    await sql`UPDATE notifications SET read = true WHERE user_id = ${userId}`
  }
}
