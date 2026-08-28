import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// This installed Prisma version's config `datasource` type only has
// `url` and `shadowDatabaseUrl` — no `directUrl` (confirmed against
// node_modules/@prisma/config/dist/index.d.ts after a `directUrl` here
// broke Vercel's typecheck; some docs/skills still describe an older
// shape that supported it). Nothing here runs `prisma migrate`/`db
// push` automatically (see package.json — postinstall only runs
// `prisma generate`), so `url` alone is fine for the deployed app,
// which should get the pooled connection string. DIRECT_URL still
// exists as an env var purely for people running migrations by hand —
// see README's Database section and .env.example — it's just not
// wired into this config object.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
