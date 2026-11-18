// G2 (data layer): the scoped Prisma client. Real local PostgreSQL, no mocks.
// Layer 1 (app filter) is proven ALONE by connecting as the table owner, which bypasses
// RLS, so any isolation seen there can only come from the Prisma extension.
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPrisma, withBusiness } from "@/lib/db";
import { A, B, connect, ids, seedTwoBusinesses } from "./helpers";

const appPrisma = () => createPrisma(process.env.TEST_DB_APP_URL!);
const ownerPrisma = () => createPrisma(process.env.TEST_DB_OWNER_URL!);

let owner: pg.Client;
const prisma = appPrisma();
const bypassRlsPrisma = ownerPrisma();

beforeAll(async () => {
  owner = await connect(process.env.TEST_DB_OWNER_URL!);
  await seedTwoBusinesses(owner);
});
afterAll(async () => {
  await owner.end();
  await prisma.$disconnect();
  await bypassRlsPrisma.$disconnect();
});

describe("layer 1 alone (connected as owner, RLS bypassed)", () => {
  it("findMany returns only A's product", async () => {
    const rows = await withBusiness(bypassRlsPrisma, A, (tx) => tx.product.findMany());
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: ids.prodA, businessId: A, name: "Product A", priceCentavos: 15000 });
  });

  it("a caller-supplied businessId in where is overridden, not trusted", async () => {
    const rows = await withBusiness(bypassRlsPrisma, A, (tx) => tx.product.findMany({ where: { businessId: B } }));
    expect(rows.map((r) => r.id)).toEqual([ids.prodA]);
  });

  it("findUnique on B's product by exact id returns null", async () => {
    const row = await withBusiness(bypassRlsPrisma, A, (tx) => tx.product.findUnique({ where: { id: ids.prodB } }));
    expect(row).toBeNull();
  });

  it("update of B's product fails and B's price is unchanged", async () => {
    await expect(
      withBusiness(bypassRlsPrisma, A, (tx) => tx.product.update({ where: { id: ids.prodB }, data: { priceCentavos: 1 } })),
    ).rejects.toThrow();
    const still = await owner.query("select price_centavos from products where id=$1", [ids.prodB]);
    expect(still.rows[0].price_centavos).toBe(15000);
  });

  it("updateMany and deleteMany touch zero of B's rows", async () => {
    const upd = await withBusiness(bypassRlsPrisma, A, (tx) =>
      tx.product.updateMany({ where: { id: ids.prodB }, data: { priceCentavos: 1 } }));
    const del = await withBusiness(bypassRlsPrisma, A, (tx) => tx.stockMovement.deleteMany({ where: { stockItemId: ids.stockB } }));
    expect(upd.count).toBe(0);
    expect(del.count).toBe(0);
    const left = await owner.query("select count(*)::int as n from stock_movements where business_id=$1", [B]);
    expect(left.rows[0].n).toBe(1);
  });

  it("create stamps the session's business even if the caller passes B's", async () => {
    const row = await withBusiness(bypassRlsPrisma, A, (tx) => tx.category.create({ data: { name: "Drinks", businessId: B } }));
    expect(row.businessId).toBe(A);
  });

  it("createMany stamps every row with the session's business", async () => {
    await withBusiness(bypassRlsPrisma, A, (tx) =>
      tx.category.createMany({ data: [{ name: "c1", businessId: B }, { name: "c2", businessId: B }] }));
    const r = await owner.query("select business_id from categories where name in ('c1','c2')");
    expect(r.rows.map((x) => x.business_id)).toEqual([A, A]);
  });

  it("a row cannot be moved to another business through update", async () => {
    const row = await withBusiness(bypassRlsPrisma, A, (tx) =>
      tx.product.update({ where: { id: ids.prodA }, data: { businessId: B, priceCentavos: 16000 } }));
    expect(row).toMatchObject({ businessId: A, priceCentavos: 16000 });
    await owner.query("update products set price_centavos=15000 where id=$1", [ids.prodA]);
  });

  it("the businesses table is filtered by id, and businesses cannot be created from the app", async () => {
    const rows = await withBusiness(bypassRlsPrisma, A, (tx) => tx.business.findMany());
    expect(rows.map((r) => r.id)).toEqual([A]);
    await expect(
      withBusiness(bypassRlsPrisma, A, (tx) => tx.business.create({ data: { name: "Evil Inc" } })),
    ).rejects.toThrow(/operator scripts/);
  });
});

describe("both layers together (connected as app_runtime)", () => {
  it("sets app.business_id inside the transaction, and it does not leak after", async () => {
    const inside = await withBusiness(prisma, A, (tx) =>
      tx.$queryRaw<{ v: string }[]>`select current_setting('app.business_id', true) as v`);
    expect(inside[0].v).toBe(A);
    const after = await prisma.$queryRaw<{ v: string | null }[]>`select current_setting('app.business_id', true) as v`;
    expect(after[0].v === null || after[0].v === "").toBe(true);
  });

  it("raw SQL inside withBusiness is still contained by RLS", async () => {
    const rows = await withBusiness(prisma, A, (tx) => tx.$queryRaw<{ id: string }[]>`select id from products`);
    expect(rows.map((r) => r.id)).toEqual([ids.prodA]);
  });

  it("two overlapping requests for different businesses never see each other's rows", async () => {
    const slow = (biz: string) =>
      withBusiness(prisma, biz, async (tx) => {
        await tx.$queryRaw`select 1 as ok from pg_sleep(0.2)`;
        return tx.product.findMany();
      });
    const [a, b] = await Promise.all([slow(A), slow(B), slow(A), slow(B)]);
    expect(a.map((r) => r.businessId)).toEqual([A]);
    expect(b.map((r) => r.businessId)).toEqual([B]);
  });

  it("rejects a malformed business id before touching the database", async () => {
    await expect(withBusiness(prisma, "x'; drop table orders;--", (tx) => tx.product.findMany())).rejects.toThrow(/Invalid business id/);
    await expect(withBusiness(prisma, "", (tx) => tx.product.findMany())).rejects.toThrow(/Invalid business id/);
  });

  it("an owner-created order for A is idempotent on client_sale_id per business", async () => {
    const dup = withBusiness(prisma, A, (tx) =>
      tx.order.create({ data: { businessId: A, locationId: ids.locA, clientSaleId: ids.saleA } }));
    await expect(dup).rejects.toThrow();
    const n = await owner.query("select count(*)::int as n from orders where business_id=$1", [A]);
    expect(n.rows[0].n).toBe(1);
  });
});
