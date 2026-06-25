import { betterAuth } from "better-auth"
import { authPool } from "@/lib/auth-db"

export const auth = betterAuth({
  database: authPool,
  baseURL:
    process.env.BETTER_AUTH_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : process.env.V0_RUNTIME_URL),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "compliance_officer",
        // Accept the role from the sign-up form, but never trust it blindly:
        // the databaseHook below rejects any attempt to self-assign "admin".
        input: true,
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const allowedSelfRoles = ["compliance_officer", "risk_manager"]
          const requested = (user as { role?: string }).role
          const role = allowedSelfRoles.includes(requested ?? "")
            ? requested
            : "compliance_officer"
          return { data: { ...user, role } }
        },
      },
    },
  },
  trustedOrigins: [
    ...(process.env.V0_RUNTIME_URL ? [process.env.V0_RUNTIME_URL] : []),
    ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
    ...(process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? [`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`]
      : []),
    "http://localhost:3000",
    "https://localhost:3000",
    // v0 preview/runtime domains: the browser's Origin in the preview iframe
    // does not match V0_RUNTIME_URL, so trust the v0 domains via wildcards.
    "https://*.vusercontent.net",
    "https://*.v0.dev",
    "https://*.v0.app",
  ],
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  ...(process.env.VERCEL_ENV !== "production"
    ? {
        advanced: {
          // In the v0 preview iframe, force cross-site cookies so the
          // session cookie is stored by the browser.
          defaultCookieAttributes: {
            sameSite: "none" as const,
            secure: true,
          },
        },
      }
    : {}),
})
