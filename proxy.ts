import { NextResponse, type NextRequest } from "next/server"
import { getSessionCookie } from "better-auth/cookies"
import { neon } from "@neondatabase/serverless"
import { getPathByKey, ASSIGNABLE_PAGES } from "@/lib/pages"

// Routes accessibles sans authentification
const PUBLIC_ROUTES = ["/sign-in", "/sign-up"]

// Le tableau de bord est toujours autorisé (fallback de redirection).
const ALWAYS_ALLOWED = ["/"]

// Driver Neon HTTP : compatible avec le runtime edge du middleware (pas de pool TCP).
const sql = neon(process.env.DATABASE_URL!)

// Cache mémoire court des accès par token de session, pour éviter une requête
// SQL à chaque navigation. TTL volontairement bas (sécurité vs perf).
const ACCESS_TTL_MS = 30_000
const accessCache = new Map<string, { expires: number; allowedPaths: string[]; isAdmin: boolean; role: string }>()

/**
 * Résout le rôle et les pages autorisées directement en base à partir du
 * token de session. On évite tout self-fetch HTTP (qui échoue dans certains
 * environnements de preview où le middleware ne peut pas se rappeler lui-même).
 */
async function loadAccess(
  sessionToken: string,
): Promise<{ allowedPaths: string[]; isAdmin: boolean; role: string } | null> {
  const cached = accessCache.get(sessionToken)
  if (cached && cached.expires > Date.now()) {
    return { allowedPaths: cached.allowedPaths, isAdmin: cached.isAdmin, role: cached.role }
  }

  try {
    // Le cookie Better Auth a la forme "<token>.<signature>" : on garde le token.
    const token = decodeURIComponent(sessionToken).split(".")[0]

    const sessionRows = await sql`
      SELECT u.role AS role
      FROM "session" s
      JOIN "user" u ON u.id = s."userId"
      WHERE s.token = ${token} AND s."expiresAt" > now()
      LIMIT 1
    `
    const role = sessionRows[0]?.role as string | undefined
    if (!role) return null

    const isAdmin = role === "admin"
    let allowedPaths: string[]

    if (isAdmin) {
      allowedPaths = ASSIGNABLE_PAGES.map((p) => p.path)
    } else {
      const accessRows = await sql`
        SELECT page_key FROM role_page_access WHERE role = ${role}
      `
      allowedPaths = accessRows
        .map((r) => getPathByKey(r.page_key as string))
        .filter((p): p is string => Boolean(p))
    }

    accessCache.set(sessionToken, {
      expires: Date.now() + ACCESS_TTL_MS,
      allowedPaths,
      isAdmin,
      role,
    })
    return { allowedPaths, isAdmin, role }
  } catch {
    // En cas d'erreur DB, ne pas bloquer un utilisateur authentifié.
    return null
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isPublicRoute = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  )

  // Vérification optimiste de la présence du cookie de session (niveau edge).
  const sessionCookie = getSessionCookie(request)

  // Non authentifié sur une route protégée -> redirection vers /sign-in
  if (!sessionCookie && !isPublicRoute) {
    return NextResponse.redirect(new URL("/sign-in", request.url))
  }

  // Authentifié : application des accès par profil (masquage + blocage URL).
  if (sessionCookie && !isPublicRoute) {
    const access = await loadAccess(String(sessionCookie))

    // Counterparties must never see Market Oversight: redirect them from "/"
    // to "/transactions". Other profiles always land on "/" regardless of
    // whether "dashboard" is explicitly listed in their access rows.
    const isCounterparty = /contrepart|counterpart/.test(access?.role ?? "")
    if (pathname === "/" && access && !access.isAdmin && isCounterparty) {
      const landing = access.allowedPaths.includes("/transactions")
        ? "/transactions"
        : (access.allowedPaths.find((p) => p && p !== "/") ?? "/sign-in")
      return NextResponse.redirect(new URL(landing, request.url))
    }

    if (access && !access.isAdmin && !ALWAYS_ALLOWED.includes(pathname)) {
      // /admin est réservé aux administrateurs.
      if (pathname === "/admin" || pathname.startsWith("/admin/")) {
        return NextResponse.redirect(new URL("/", request.url))
      }

      // La page demandée doit faire partie des chemins autorisés du profil.
      const allowed = access.allowedPaths.some(
        (p) => pathname === p || (p !== "/" && pathname.startsWith(`${p}/`)),
      )
      if (!allowed) {
        return NextResponse.redirect(new URL("/", request.url))
      }
    }

    // Transmet la décision d'accès (résolue côté serveur) au client via un
    // cookie lisible, afin que la barre latérale rende la navigation sans
    // clignotement dès le premier rendu. La sécurité réelle reste assurée par
    // ce proxy (blocage d'URL) et par le périmètre des routes API.
    const response = NextResponse.next()
    if (access) {
      response.cookies.set(
        "nav_access",
        JSON.stringify({ allowedPaths: access.allowedPaths, isAdmin: access.isAdmin }),
        { path: "/", sameSite: "lax", httpOnly: false, maxAge: 60 * 60 },
      )
    }
    return response
  }

  return NextResponse.next()
}

export const config = {
  // Exécute le proxy sur toutes les routes de pages, en excluant entièrement
  // l'API (les routes API appliquent leur propre authentification et le
  // périmètre de données par profil) ainsi que les assets statiques.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)"],
}
