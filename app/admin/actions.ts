"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { sql } from "@/lib/db"
import { getFullMatrix, setRoleAccess } from "@/lib/access-control"
import { sendPasswordResetEmail, sendWelcomeEmail } from "@/lib/email"
import {
  listRoles as listRolesStore,
  createRole as createRoleStore,
  deleteRole as deleteRoleStore,
  getValidRoleKeys,
  type AppRole,
} from "@/lib/roles-store"

export interface AdminUser {
  id: string
  name: string
  email: string
  role: string
  createdAt: string
  counterpartyId: string | null
  counterpartyName: string | null
}

export interface CounterpartyOption {
  id: string
  name: string
}

/** Lazily adds the user.counterparty_id column (idempotent migration). */
let counterpartyColumnReady = false
async function ensureUserCounterpartyColumn() {
  if (counterpartyColumnReady) return
  await sql`
    ALTER TABLE "user"
    ADD COLUMN IF NOT EXISTS counterparty_id text
    REFERENCES counterparties(id) ON DELETE SET NULL
  `
  counterpartyColumnReady = true
}

/** Throws unless the caller is an authenticated admin. Returns the admin's user id. */
async function requireAdmin(): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error("Non authentifié")
  if ((session.user as { role?: string }).role !== "admin") {
    throw new Error("Accès réservé aux administrateurs")
  }
  return session.user.id
}

export async function listUsers(): Promise<AdminUser[]> {
  await requireAdmin()
  await ensureUserCounterpartyColumn()
  const rows = await sql`
    SELECT u.id, u.name, u.email, u.role, u."createdAt",
           u.counterparty_id,
           c.legal_name AS counterparty_name
    FROM "user" u
    LEFT JOIN counterparties c ON c.id = u.counterparty_id
    ORDER BY u."createdAt" DESC
  `
  return rows.map((r) => ({
    id: r.id as string,
    name: r.name as string,
    email: r.email as string,
    role: (r.role as string) ?? "compliance_officer",
    createdAt: new Date(r.createdAt as string).toISOString(),
    counterpartyId: (r.counterparty_id as string | null) ?? null,
    counterpartyName: (r.counterparty_name as string | null) ?? null,
  }))
}

/** Returns counterparties for the association selector (id + display name). */
export async function listCounterpartyOptions(): Promise<CounterpartyOption[]> {
  await requireAdmin()
  const rows = await sql`
    SELECT id, legal_name, trading_name
    FROM counterparties
    ORDER BY legal_name ASC
  `
  return rows.map((r) => ({
    id: r.id as string,
    name: (r.trading_name as string | null)
      ? `${r.legal_name as string} (${r.trading_name as string})`
      : (r.legal_name as string),
  }))
}

/** Links (or unlinks, when counterpartyId is null) a user to a counterparty. */
export async function setUserCounterparty(
  userId: string,
  counterpartyId: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin()
  await ensureUserCounterpartyColumn()

  if (counterpartyId) {
    const exists = await sql`SELECT id FROM counterparties WHERE id = ${counterpartyId} LIMIT 1`
    if (exists.length === 0) {
      return { ok: false, error: "Contrepartie introuvable." }
    }
  }

  try {
    await sql`UPDATE "user" SET counterparty_id = ${counterpartyId} WHERE id = ${userId}`
  } catch (e) {
    const message = e instanceof Error ? e.message : "Échec de l'association"
    return { ok: false, error: message }
  }

  revalidatePath("/admin")
  return { ok: true }
}

export async function createUser(input: {
  name: string
  email: string
  password: string
  role: string
}): Promise<
  | { ok: true; emailSent: boolean; emailError?: string }
  | { ok: false; error: string }
> {
  await requireAdmin()

  const name = input.name.trim()
  const email = input.email.trim().toLowerCase()
  const validRoles = await getValidRoleKeys()
  const role = validRoles.includes(input.role) ? input.role : "compliance_officer"

  if (!name || !email || input.password.length < 8) {
    return { ok: false, error: "Nom, email et mot de passe (≥ 8 caractères) requis." }
  }

  try {
    // Better Auth handles password hashing + user/account creation.
    await auth.api.signUpEmail({
      body: { name, email, password: input.password },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Échec de la création"
    return { ok: false, error: message }
  }

  // The public sign-up hook forces non-admin roles; since an authenticated
  // admin is creating this account, set the requested role directly.
  await sql`UPDATE "user" SET role = ${role} WHERE email = ${email}`

  revalidatePath("/admin")

  // Send the login credentials to the new user. The account already exists, so
  // an email failure is reported but doesn't fail the whole operation (the
  // admin can communicate the password manually).
  const emailResult = await sendWelcomeEmail({ to: email, name, password: input.password })

  return {
    ok: true,
    emailSent: emailResult.ok,
    emailError: emailResult.ok ? undefined : emailResult.error,
  }
}

export async function updateUserRole(userId: string, role: string) {
  const adminId = await requireAdmin()
  const validRoles = await getValidRoleKeys()
  if (!validRoles.includes(role)) throw new Error("Profil invalide")
  if (userId === adminId && role !== "admin") {
    throw new Error("Vous ne pouvez pas retirer votre propre rôle d'administrateur.")
  }
  await sql`UPDATE "user" SET role = ${role} WHERE id = ${userId}`
  revalidatePath("/admin")
}

export async function updateUserProfile(
  userId: string,
  input: { name: string; email: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin()

  const name = input.name.trim()
  const email = input.email.trim().toLowerCase()

  if (!name) {
    return { ok: false, error: "Le nom est requis." }
  }
  // Basic email shape validation.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Adresse email invalide." }
  }

  // Reject if the email is already used by another account.
  const existing = await sql`
    SELECT id FROM "user" WHERE lower(email) = ${email} AND id <> ${userId} LIMIT 1
  `
  if (existing.length > 0) {
    return { ok: false, error: "Cette adresse email est déjà utilisée par un autre utilisateur." }
  }

  try {
    // Keep the credential account identifier in sync with the email so the
    // user can still sign in with their new address.
    await sql`UPDATE "user" SET name = ${name}, email = ${email} WHERE id = ${userId}`
  } catch (e) {
    const message = e instanceof Error ? e.message : "Échec de la mise à jour"
    return { ok: false, error: message }
  }

  revalidatePath("/admin")
  return { ok: true }
}

export async function resetUserPassword(
  userId: string,
  newPassword: string,
): Promise<{ ok: true; emailSent: boolean; emailError?: string } | { ok: false; error: string }> {
  await requireAdmin()

  if (!newPassword || newPassword.length < 8) {
    return { ok: false, error: "Le mot de passe doit contenir au moins 8 caractères." }
  }

  // Look up the target user's email + name for the notification.
  const userRows = await sql`SELECT email, name FROM "user" WHERE id = ${userId} LIMIT 1`
  if (userRows.length === 0) {
    return { ok: false, error: "Utilisateur introuvable." }
  }
  const targetEmail = userRows[0].email as string
  const targetName = (userRows[0].name as string | null) ?? targetEmail

  try {
    // Reproduce Better Auth's internal reset flow: hash the new password and
    // update (or create) the user's credential account.
    const context = await auth.$context
    const hashedPassword = await context.password.hash(newPassword)
    const accounts = await context.internalAdapter.findAccounts(userId)
    const hasCredential = accounts.find((ac) => ac.providerId === "credential")

    if (!hasCredential) {
      await context.internalAdapter.createAccount({
        userId,
        providerId: "credential",
        accountId: userId,
        password: hashedPassword,
      })
    } else {
      await context.internalAdapter.updatePassword(userId, hashedPassword)
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Échec de la réinitialisation"
    return { ok: false, error: message }
  }

  revalidatePath("/admin")

  // Send the new temporary password to the user by email. The reset already
  // succeeded, so an email failure is reported but not treated as a hard error
  // (the admin can still copy the password manually).
  const emailResult = await sendPasswordResetEmail({
    to: targetEmail,
    name: targetName,
    password: newPassword,
  })

  return {
    ok: true,
    emailSent: emailResult.ok,
    emailError: emailResult.ok ? undefined : emailResult.error,
  }
}

export async function deleteUser(userId: string) {
  const adminId = await requireAdmin()
  if (userId === adminId) {
    throw new Error("Vous ne pouvez pas supprimer votre propre compte.")
  }
  await sql`DELETE FROM "user" WHERE id = ${userId}`
  revalidatePath("/admin")
}

export async function getAccessMatrix(): Promise<Record<string, string[]>> {
  await requireAdmin()
  return getFullMatrix()
}

export async function saveRoleAccess(role: string, pageKeys: string[]) {
  await requireAdmin()
  if (role === "admin") throw new Error("Le profil Admin a toujours accès à tout.")
  const validRoles = await getValidRoleKeys()
  if (!validRoles.includes(role)) throw new Error("Profil invalide")
  await setRoleAccess(role, pageKeys)
  revalidatePath("/admin")
}

/** Returns every role (system + custom) for the admin UI. */
export async function listRoles(): Promise<AppRole[]> {
  await requireAdmin()
  return listRolesStore()
}

export async function createRole(
  label: string,
): Promise<{ ok: true; role: AppRole } | { ok: false; error: string }> {
  await requireAdmin()
  const result = await createRoleStore(label)
  if (result.ok) revalidatePath("/admin")
  return result
}

export async function deleteRole(
  key: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin()
  const result = await deleteRoleStore(key)
  if (result.ok) revalidatePath("/admin")
  return result
}
