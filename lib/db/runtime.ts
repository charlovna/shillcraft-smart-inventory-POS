// Cloudflare Workers wiring. One Prisma client per request (Workers cannot share
// connections across requests); Hyperdrive pools the real database connections.
// The HYPERDRIVE binding must point at the app_runtime config (caching OFF).
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createPrisma } from "./index";

export function requestPrisma() {
  const { env, ctx } = getCloudflareContext();
  const prisma = createPrisma(env.HYPERDRIVE.connectionString);
  return { prisma, release: () => ctx.waitUntil(prisma.$disconnect()) };
}
