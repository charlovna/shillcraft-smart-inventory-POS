// Fails (exit 1) if any app table lacks ENABLED + FORCED row-level security,
// or if the runtime role can bypass RLS or owns tables. Uses the owner connection.
import pg from "pg";

const url = process.env.DIRECT_URL;
if (!url) {
  console.error("check:rls needs DIRECT_URL (owner connection).");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  const tables = await client.query(
    `select c.relname as table, c.relrowsecurity as enabled, c.relforcerowsecurity as forced,
            (select count(*) from pg_policy p where p.polrelid = c.oid) as policies
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and c.relname <> '_prisma_migrations'
      order by 1`,
  );
  const bad = tables.rows.filter((r) => !r.enabled || !r.forced || Number(r.policies) < 1);
  const role = await client.query(
    `select rolbypassrls, rolsuper,
            exists (select 1 from pg_class c join pg_roles o on o.oid = c.relowner
                     where o.rolname = 'app_runtime') as owns_tables
       from pg_roles where rolname = 'app_runtime'`,
  );
  const problems: string[] = bad.map(
    (r) => `table ${r.table}: rls enabled=${r.enabled} forced=${r.forced} policies=${r.policies}`,
  );
  if (role.rowCount === 0) problems.push("role app_runtime does not exist");
  else if (role.rows[0].rolbypassrls || role.rows[0].rolsuper || role.rows[0].owns_tables)
    problems.push("app_runtime must not bypass RLS, be superuser, or own tables");

  if (problems.length) {
    console.error("check:rls FAILED\n - " + problems.join("\n - "));
    process.exit(1);
  }
  console.log(`check:rls OK: ${tables.rowCount} tables have forced RLS and a policy.`);
} finally {
  await client.end();
}
