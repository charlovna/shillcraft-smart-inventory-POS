// G3: isolation holds IN THE DATABASE. Connects as the runtime role (app_runtime),
// sets app.business_id to A, and tries to reach B. Expected values come from the
// seed in helpers.ts (exactly one row per seeded table per business).
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { A, APP_TABLES, B, asTenant, connect, ids, seedTwoBusinesses } from "./helpers";

let owner: pg.Client;
let app: pg.Client;

const SEEDED_ONE_ROW_EACH = [
  "businesses", "locations", "users", "categories", "products", "stock_items",
  "location_stock", "orders", "order_items", "stock_movements",
];

beforeAll(async () => {
  owner = await connect(process.env.TEST_DB_OWNER_URL!);
  app = await connect(process.env.TEST_DB_APP_URL!);
  await seedTwoBusinesses(owner);
});
afterAll(async () => {
  await app.end();
  await owner.end();
});

describe("runtime role", () => {
  it("cannot bypass RLS, is not superuser, and owns no tables", async () => {
    const r = await owner.query(
      `select rolbypassrls, rolsuper,
              (select count(*)::int from pg_class c join pg_roles o on o.oid=c.relowner where o.rolname='app_runtime') as owned
         from pg_roles where rolname='app_runtime'`);
    expect(r.rows[0]).toEqual({ rolbypassrls: false, rolsuper: false, owned: 0 });
  });

  it("every app table has RLS enabled and forced, with at least one policy", async () => {
    const r = await owner.query(
      `select c.relname, c.relrowsecurity, c.relforcerowsecurity,
              (select count(*)::int from pg_policy p where p.polrelid=c.oid) as policies
         from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where n.nspname='public' and c.relkind='r' and c.relname<>'_prisma_migrations' order by 1`);
    expect(r.rowCount).toBe(15);
    expect(r.rows.map((x) => x.relname).sort()).toEqual([...APP_TABLES].sort());
    for (const row of r.rows) {
      expect(row, row.relname).toMatchObject({ relrowsecurity: true, relforcerowsecurity: true });
      expect(row.policies, row.relname).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("reads", () => {
  it.each(SEEDED_ONE_ROW_EACH)("as A, %s shows exactly A's one row and none of B's", async (table) => {
    const rows = await asTenant(app, A, (c) => c.query(`select * from ${table}`));
    expect(rows.rowCount).toBe(1);
    const key = table === "businesses" ? "id" : "business_id";
    expect(rows.rows[0][key]).toBe(A);
  });

  it("as A, B's order cannot be fetched by its exact id", async () => {
    const r = await asTenant(app, A, (c) => c.query(`select id from orders where id=$1`, [ids.orderB]));
    expect(r.rowCount).toBe(0);
  });

  it("with no business set, every table returns zero rows (fails closed)", async () => {
    for (const table of APP_TABLES) {
      const r = await asTenant(app, null, (c) => c.query(`select 1 from ${table}`));
      expect(r.rowCount, table).toBe(0);
    }
  });

  it("after a transaction ends, the leftover empty setting still returns zero rows and no error", async () => {
    await asTenant(app, A, async (c) => c.query("select 1"));
    const r = await app.query("select 1 from orders"); // new implicit transaction, setting reset
    expect(r.rowCount).toBe(0);
  });
});

describe("writes", () => {
  it("as A, inserting a row stamped with B's business_id is rejected", async () => {
    await expect(
      asTenant(app, A, (c) => c.query(`insert into categories (business_id,name) values ($1,'sneaky')`, [B])),
    ).rejects.toThrow(/row-level security/);
  });

  it("as A, updating B's product changes zero rows", async () => {
    const r = await asTenant(app, A, (c) =>
      c.query(`update products set price_centavos=1 where id=$1`, [ids.prodB]));
    expect(r.rowCount).toBe(0);
    const still = await owner.query(`select price_centavos from products where id=$1`, [ids.prodB]);
    expect(still.rows[0].price_centavos).toBe(15000);
  });

  it("as A, deleting B's recipe or addon rows changes zero rows", async () => {
    const r = await asTenant(app, A, (c) => c.query(`delete from product_addons where business_id=$1`, [B]));
    expect(r.rowCount).toBe(0);
  });

  it("as A, moving own row to B (changing business_id) is rejected", async () => {
    await expect(
      asTenant(app, A, (c) => c.query(`update products set business_id=$1 where id=$2`, [B, ids.prodA])),
    ).rejects.toThrow(/row-level security/);
  });
});

describe("audit trail and grants", () => {
  it("stock movements can be added but never edited or deleted", async () => {
    const ins = await asTenant(app, A, (c) =>
      c.query(`insert into stock_movements (business_id,location_id,stock_item_id,type,qty_change)
               values ($1,$2,$3,'waste',-1)`, [A, ids.locA, ids.stockA]));
    expect(ins.rowCount).toBe(1);
    await expect(asTenant(app, A, (c) => c.query(`update stock_movements set qty_change=0`))).rejects.toThrow(/permission denied/);
    await expect(asTenant(app, A, (c) => c.query(`delete from stock_movements`))).rejects.toThrow(/permission denied/);
  });

  it("order lines cannot be edited (price at sale is frozen)", async () => {
    await expect(asTenant(app, A, (c) => c.query(`update order_items set price_at_sale_centavos=1`))).rejects.toThrow(/permission denied/);
  });

  it("the runtime role cannot read Prisma's migrations table", async () => {
    await expect(asTenant(app, A, (c) => c.query(`select * from _prisma_migrations`))).rejects.toThrow(/permission denied/);
  });

  it("the runtime role cannot create tables or turn RLS off", async () => {
    await expect(app.query(`create table sneaky (id int)`)).rejects.toThrow(/permission denied/);
    await expect(app.query(`alter table products disable row level security`)).rejects.toThrow(/must be owner/);
  });
});

describe("cross-business links are blocked by the database", () => {
  it("an order line in A cannot point at B's order or B's product (composite foreign key)", async () => {
    await expect(
      owner.query(`insert into order_items (business_id,order_id,product_id,qty,price_at_sale_centavos)
                   values ($1,$2,$3,1,100)`, [A, ids.orderB, ids.prodA]),
    ).rejects.toThrow(/foreign key/);
    await expect(
      owner.query(`insert into order_items (business_id,order_id,product_id,qty,price_at_sale_centavos)
                   values ($1,$2,$3,1,100)`, [A, ids.orderA, ids.prodB]),
    ).rejects.toThrow(/foreign key/);
  });

  it("an order in A cannot use B's location", async () => {
    await expect(
      owner.query(`insert into orders (business_id,location_id,client_sale_id) values ($1,$2,gen_random_uuid())`, [A, ids.locB]),
    ).rejects.toThrow(/foreign key/);
  });

  it("the same client_sale_id is unique per business, not across businesses", async () => {
    await expect(
      owner.query(`insert into orders (business_id,location_id,client_sale_id) values ($1,$2,$3)`, [A, ids.locA, ids.saleA]),
    ).rejects.toThrow(/unique/);
    const ok = await owner.query(
      `insert into orders (business_id,location_id,client_sale_id) values ($1,$2,$3) returning id`, [B, ids.locB, ids.saleA]);
    expect(ok.rowCount).toBe(1);
  });
});

describe("lookup functions (the only deliberate RLS step-around)", () => {
  it("resolve_menu_code returns only the business and location ids for a valid code", async () => {
    const r = await app.query(`select * from resolve_menu_code('menu-A')`);
    expect(r.rows).toEqual([{ business_id: A, location_id: ids.locA }]);
  });

  it("resolve_menu_code returns nothing for an unknown code", async () => {
    const r = await app.query(`select * from resolve_menu_code('nope')`);
    expect(r.rowCount).toBe(0);
  });

  it("resolve_menu_code ignores deactivated locations", async () => {
    await owner.query(`update locations set active=false where id=$1`, [ids.locB]);
    const r = await app.query(`select * from resolve_menu_code('menu-B')`);
    expect(r.rowCount).toBe(0);
    await owner.query(`update locations set active=true where id=$1`, [ids.locB]);
  });

  it("resolve_staff maps an auth id to business, user, role and location", async () => {
    const r = await app.query(`select * from resolve_staff($1)`, [ids.authB]);
    expect(r.rows).toEqual([{ business_id: B, user_id: ids.userB, role: "owner", location_id: null }]);
  });

  it("resolve_staff returns nothing for an unknown or disabled user", async () => {
    const unknown = await app.query(`select * from resolve_staff(gen_random_uuid())`);
    expect(unknown.rowCount).toBe(0);
    await owner.query(`update users set active=false where id=$1`, [ids.userA]);
    const disabled = await app.query(`select * from resolve_staff($1)`, [ids.authA]);
    expect(disabled.rowCount).toBe(0);
    await owner.query(`update users set active=true where id=$1`, [ids.userA]);
  });
});
