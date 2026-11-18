-- Phase 2: row-level security, runtime role, grants, lookup functions.
-- Runs as the table owner (postgres). The app never runs as this role.

-- 1. Runtime role: can log in, cannot bypass RLS, owns nothing. Password is set
--    outside git:  ALTER ROLE app_runtime PASSWORD '...';
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_runtime') THEN
    CREATE ROLE app_runtime LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
END $$;

-- 2. Supabase's built-in API roles get nothing (Data API is off; belt and braces).
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', r);
    END IF;
  END LOOP;
END $$;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO app_runtime;

-- 3. RLS on every app table: enabled AND forced, fail-closed policy.
--    nullif() makes an unset or emptied setting match nothing instead of erroring.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'locations','users','payment_methods','categories','products','product_addons',
    'stock_items','recipe_lines','location_stock','shifts','orders','order_items',
    'stock_movements','order_rate_limits'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format($p$CREATE POLICY tenant_isolation ON %I FOR ALL TO app_runtime
      USING (business_id = nullif(current_setting('app.business_id', true), '')::uuid)
      WITH CHECK (business_id = nullif(current_setting('app.business_id', true), '')::uuid)$p$, t);
  END LOOP;
END $$;

ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON businesses FOR ALL TO app_runtime
  USING (id = nullif(current_setting('app.business_id', true), '')::uuid)
  WITH CHECK (id = nullif(current_setting('app.business_id', true), '')::uuid);

-- 4. Grants: only what the app needs. Audit tables are insert-only.
GRANT SELECT, UPDATE ON businesses, locations TO app_runtime;
GRANT SELECT, INSERT, UPDATE ON users, payment_methods, categories, products, stock_items,
  location_stock, shifts, orders TO app_runtime;
GRANT SELECT, INSERT, DELETE ON product_addons, recipe_lines TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON order_rate_limits TO app_runtime;
GRANT SELECT, INSERT ON order_items, stock_movements TO app_runtime;
-- app_runtime has no access to _prisma_migrations.

-- 5. The only deliberate RLS step-around: two narrow lookups that find the business
--    BEFORE app.business_id can be set. Each returns at most one row of ids only.
CREATE OR REPLACE FUNCTION resolve_menu_code(p_code text)
RETURNS TABLE (business_id uuid, location_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT l.business_id, l.id
  FROM locations l JOIN businesses b ON b.id = l.business_id
  WHERE l.menu_code = p_code AND l.active AND b.active
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION resolve_staff(p_auth_user_id uuid)
RETURNS TABLE (business_id uuid, user_id uuid, role "Role", location_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT u.business_id, u.id, u.role, u.location_id
  FROM users u JOIN businesses b ON b.id = u.business_id
  WHERE u.auth_user_id = p_auth_user_id AND u.active AND b.active
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION resolve_menu_code(text), resolve_staff(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION resolve_menu_code(text), resolve_staff(uuid) TO app_runtime;
