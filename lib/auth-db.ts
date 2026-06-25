import { Pool } from "pg"

// Dedicated pg Pool for Better Auth. The rest of the app keeps using the
// existing `@neondatabase/serverless` client in lib/db.ts for raw SQL.
export const authPool = new Pool({
  connectionString: process.env.DATABASE_URL,
})
