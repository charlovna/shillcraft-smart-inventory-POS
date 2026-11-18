// App-layer isolation (layer 1 of 2). Layer 2 is PostgreSQL row-level security.
// Every query made through a scoped client is forced to the caller's business,
// whatever the calling code passes in. The business id must come from the
// server-side session (staff) or the resolved QR menu code (customer), never the browser.
import { Prisma } from "@/lib/generated/prisma/client";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function assertBusinessId(id: string): string {
  if (typeof id !== "string" || !UUID.test(id)) throw new Error("Invalid business id");
  return id;
}

const FILTERED_OPS = new Set([
  "findMany", "findFirst", "findFirstOrThrow", "findUnique", "findUniqueOrThrow",
  "count", "aggregate", "groupBy", "update", "updateMany", "updateManyAndReturn",
  "delete", "deleteMany", "upsert",
]);

type Obj = Record<string, unknown>;

export function scopeExtension(businessId: string) {
  assertBusinessId(businessId);
  return Prisma.defineExtension({
    name: `business-scope`,
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const col = model === "Business" ? "id" : "businessId";
          const a = { ...(args as Obj) };

          if (FILTERED_OPS.has(operation)) {
            // Override, never merge: a caller-supplied business id is discarded.
            a.where = { ...((a.where as Obj) ?? {}), [col]: businessId };
          }
          if (model === "Business" && (operation.startsWith("create") || operation === "upsert" || operation.startsWith("delete"))) {
            throw new Error("Businesses are created and deleted by operator scripts only");
          }
          if (model !== "Business") {
            if (operation === "create") a.data = { ...(a.data as Obj), businessId };
            if (operation === "createMany" || operation === "createManyAndReturn") {
              const d = a.data as Obj | Obj[];
              a.data = Array.isArray(d) ? d.map((r) => ({ ...r, businessId })) : { ...d, businessId };
            }
            if (operation === "upsert") a.create = { ...(a.create as Obj), businessId };
          }
          // Rows may never be moved to another business.
          if (["update", "updateMany", "updateManyAndReturn", "upsert"].includes(operation)) {
            const key = operation === "upsert" ? "update" : "data";
            if (a[key] && typeof a[key] === "object") {
              const { businessId: _drop, ...rest } = a[key] as Obj;
              void _drop;
              a[key] = rest;
            }
          }
          return query(a as typeof args);
        },
      },
    },
  });
}
