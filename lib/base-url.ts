/**
 * Resolves the public base URL of the app for building absolute links inside
 * emails. Mirrors the cascade used by lib/auth.ts so links work in production,
 * Vercel previews, and the v0 runtime preview.
 */
export function getBaseUrl(): string {
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL.replace(/\/$/, "")
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  if (process.env.V0_RUNTIME_URL) return process.env.V0_RUNTIME_URL.replace(/\/$/, "")
  return "http://localhost:3000"
}
