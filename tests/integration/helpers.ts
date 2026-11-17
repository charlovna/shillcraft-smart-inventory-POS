import pg from "pg";

export const A = "aaaaaaaa-0000-4000-8000-000000000001";
export const B = "bbbbbbbb-0000-4000-8000-000000000002";

export const ids = {
  locA: "aaaaaaaa-1000-4000-8000-000000000001",
  locB: "bbbbbbbb-1000-4000-8000-000000000002",
  catA: "aaaaaaaa-2000-4000-8000-000000000001",
  catB: "bbbbbbbb-2000-4000-8000-000000000002",
  prodA: "aaaaaaaa-3000-4000-8000-000000000001",
  prodB: "bbbbbbbb-3000-4000-8000-000000000002",
  stockA: "aaaaaaaa-4000-4000-8000-000000000001",
  stockB: "bbbbbbbb-4000-4000-8000-000000000002",
  userA: "aaaaaaaa-5000-4000-8000-000000000001",
  userB: "bbbbbbbb-5000-4000-8000-000000000002",
  authA: "aaaaaaaa-6000-4000-8000-000000000001",
  authB: "bbbbbbbb-6000-4000-8000-000000000002",
  orderA: "aaaaaaaa-7000-4000-8000-000000000001",
  orderB: "bbbbbbbb-7000-4000-8000-000000000002",
  saleA: "aaaaaaaa-8000-4000-8000-000000000001",
  saleB: "bbbbbbbb-8000-4000-8000-000000000002",
};

export const APP_TABLES = [
  "businesses", "locations", "users", "payment_methods", "categories", "products",
  "product_addons", "stock_items", "recipe_lines", "location_stock", "shifts", "orders",
  "order_items", "stock_movements", "order_rate_limits",
];

export async function connect(url: string) {
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  return c;
}

/** Seeds two businesses as the owner (owner bypasses RLS). Exact, known counts. */
export async function seedTwoBusinesses(owner: pg.Client) {
  await owner.query("truncate table businesses cascade"); // every file starts from the same known data
  await owner.query(
    `insert into businesses (id, name) values ($1,'Business A'), ($2,'Business B')`, [A, B]);
  for (const [biz, k] of [[A, "A"], [B, "B"]] as const) {
    const loc = ids["loc" + k as keyof typeof ids], cat = ids["cat" + k as keyof typeof ids];
    const prod = ids["prod" + k as keyof typeof ids], stock = ids["stock" + k as keyof typeof ids];
    const user = ids["user" + k as keyof typeof ids], auth = ids["auth" + k as keyof typeof ids];
    const order = ids["order" + k as keyof typeof ids], sale = ids["sale" + k as keyof typeof ids];
    await owner.query(`insert into locations (id,business_id,name,menu_code) values ($1,$2,$3,$4)`,
      [loc, biz, `Loc ${k}`, `menu-${k}`]);
    await owner.query(`insert into categories (id,business_id,name) values ($1,$2,$3)`, [cat, biz, `Cat ${k}`]);
    await owner.query(`insert into products (id,business_id,category_id,name,price_centavos) values ($1,$2,$3,$4,15000)`,
      [prod, biz, cat, `Product ${k}`]);
    await owner.query(`insert into stock_items (id,business_id,name,base_unit) values ($1,$2,$3,'g')`, [stock, biz, `Stock ${k}`]);
    await owner.query(`insert into location_stock (business_id,location_id,stock_item_id,on_hand) values ($1,$2,$3,1000)`, [biz, loc, stock]);
    await owner.query(`insert into users (id,business_id,auth_user_id,name,email,role) values ($1,$2,$3,$4,$5,'owner')`,
      [user, biz, auth, `Owner ${k}`, `owner-${k}@example.com`]);
    await owner.query(`insert into orders (id,business_id,location_id,client_sale_id,total_centavos) values ($1,$2,$3,$4,15000)`,
      [order, biz, loc, sale]);
    await owner.query(`insert into order_items (business_id,order_id,product_id,qty,price_at_sale_centavos) values ($1,$2,$3,1,15000)`,
      [biz, order, prod]);
    await owner.query(`insert into stock_movements (business_id,location_id,stock_item_id,type,qty_change) values ($1,$2,$3,'sale',-50)`,
      [biz, loc, stock]);
  }
}

/** Runs fn as the runtime role inside one transaction with app.business_id set (how the app works). */
export async function asTenant<T>(app: pg.Client, businessId: string | null, fn: (c: pg.Client) => Promise<T>) {
  await app.query("begin");
  try {
    if (businessId) await app.query("select set_config('app.business_id', $1, true)", [businessId]);
    return await fn(app);
  } finally {
    await app.query("rollback");
  }
}
