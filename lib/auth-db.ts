import { Pool } from "@neondatabase/serverless"

// Dedicated pool for Better Auth, built on the same `@neondatabase/serverless`
// driver as lib/db.ts. Better Auth needs a pg.Pool-shaped client (not the
// tagged-template `sql` helper), but a raw `pg` Pool opens a direct TCP+SSL
// connection to Neon that gets reset (ECONNRESET) in this environment —
// Neon's serverless Pool tunnels over WebSockets instead and is reliable here.
export const authPool = new Pool({
  connectionString: process.env.DATABASE_URL,
})
