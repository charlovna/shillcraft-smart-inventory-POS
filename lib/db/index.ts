// Database entry point. Use withBusiness() for every request; there is deliberately
// no exported unscoped client for app code.
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@/lib/generated/prisma/client";
import { assertBusinessId, scopeExtension } from "./scope";

export type { Prisma };
export type Tx = Prisma.TransactionClient;

/** connectionString must be the app_runtime login (via Hyperdrive in production), never the owner. */
export function createPrisma(connectionString: string) {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

/**
 * Runs fn in ONE transaction that (1) tells PostgreSQL which business this is, so
 * row-level security applies, and (2) forces every Prisma query to that business.
 * set_config(..., true) is transaction-local, so it never leaks to the next request.
 */
export async function withBusiness<T>(
  prisma: PrismaClient,
  businessId: string,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  assertBusinessId(businessId);
  const scoped = prisma.$extends(scopeExtension(businessId));
  return scoped.$transaction(
    async (tx) => {
      await tx.$queryRaw`select set_config('app.business_id', ${businessId}, true)`;
      return fn(tx as unknown as Tx);
    },
    { maxWait: 10_000, timeout: 20_000 },
  );
}
