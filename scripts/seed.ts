// Local test data: two businesses, each with locations, users, menu, recipes and stock.
// LOCAL ONLY: refuses to run unless the database host is this machine.
import pg from "pg";

const url = process.env.DIRECT_URL;
if (!url) throw new Error("DIRECT_URL is not set (owner connection to the LOCAL dev database).");
const host = new URL(url).hostname;
if (!["localhost", "127.0.0.1", "::1"].includes(host)) {
  throw new Error(`Refusing to seed non-local database host "${host}".`);
}

const id = (prefix: string, n: number) => `${prefix}-0000-4000-8000-${String(n).padStart(12, "0")}`;
const c = new pg.Client({ connectionString: url });
await c.connect();
try {
  await c.query("begin");
  await c.query("truncate table businesses cascade");
  for (const [k, prefix, name] of [["A", "aaaaaaaa", "Test Business A"], ["B", "bbbbbbbb", "Test Business B"]] as const) {
    const biz = id(prefix, 1);
    await c.query("insert into businesses (id,name) values ($1,$2)", [biz, name]);
    const locs = k === "A" ? 2 : 1;
    for (let i = 1; i <= locs; i++) {
      await c.query(
        "insert into locations (id,business_id,name,menu_code,online_ordering_enabled,table_labels) values ($1,$2,$3,$4,true,$5)",
        [id(prefix, 100 + i), biz, `${name} Location ${i}`, `seed-${k}${i}`, ["T1", "T2", "T3"]]);
    }
    await c.query("insert into users (id,business_id,auth_user_id,name,email,role) values ($1,$2,$3,$4,$5,'owner')",
      [id(prefix, 200), biz, id(prefix, 900), `Owner ${k}`, `owner-${k.toLowerCase()}@seed.test`]);
    await c.query("insert into users (id,business_id,auth_user_id,name,email,role,location_id) values ($1,$2,$3,$4,$5,'cashier',$6)",
      [id(prefix, 201), biz, id(prefix, 901), `Cashier ${k}`, `cashier-${k.toLowerCase()}@seed.test`, id(prefix, 101)]);
    await c.query("insert into payment_methods (id,business_id,name,needs_reference) values ($1,$2,'Cash',false),($3,$2,'GCash QR',true)",
      [id(prefix, 300), biz, id(prefix, 301)]);
    await c.query("insert into categories (id,business_id,name,sort_order) values ($1,$2,'Mains',1),($3,$2,'Add-ons',2)",
      [id(prefix, 400), biz, id(prefix, 401)]);
    await c.query(
      `insert into products (id,business_id,category_id,name,price_centavos,is_addon) values
        ($1,$2,$3,'Takoyaki 6pc',12000,false), ($4,$2,$3,'Takoyaki 12pc',22000,false), ($5,$2,$6,'Extra cheese',1500,true)`,
      [id(prefix, 500), biz, id(prefix, 400), id(prefix, 501), id(prefix, 502), id(prefix, 401)]);
    await c.query("insert into product_addons (business_id,product_id,addon_product_id) values ($1,$2,$3),($1,$4,$3)",
      [biz, id(prefix, 500), id(prefix, 502), id(prefix, 501)]);
    await c.query(
      `insert into stock_items (id,business_id,name,base_unit,reorder_level) values
        ($1,$2,'Batter','g',500), ($3,$2,'Octopus','g',300), ($4,$2,'Cheese','g',200)`,
      [id(prefix, 600), biz, id(prefix, 601), id(prefix, 602)]);
    await c.query(
      `insert into recipe_lines (business_id,product_id,stock_item_id,qty_per_serving) values
        ($1,$2,$3,60), ($1,$2,$4,30), ($1,$5,$3,120), ($1,$5,$4,60), ($1,$6,$7,15)`,
      [biz, id(prefix, 500), id(prefix, 600), id(prefix, 601), id(prefix, 501), id(prefix, 502), id(prefix, 602)]);
    for (let i = 1; i <= locs; i++) {
      for (const [item, qty, cost] of [[600, 5000, 0.2], [601, 3000, 0.9], [602, 2000, 0.6]] as const) {
        await c.query("insert into location_stock (business_id,location_id,stock_item_id,on_hand,avg_cost_centavos_per_base_unit) values ($1,$2,$3,$4,$5)",
          [biz, id(prefix, 100 + i), id(prefix, item), qty, cost]);
      }
    }
  }
  await c.query("commit");
  console.log("seed OK: 2 businesses (A has 2 locations, B has 1), users, menu, recipes, stock.");
} catch (e) {
  await c.query("rollback");
  throw e;
} finally {
  await c.end();
}
