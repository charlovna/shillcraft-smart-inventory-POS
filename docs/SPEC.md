# Product spec (from Blueprint v3.1, approved 16 Nov 2026)

## Users

| Who | Logs in? | Can do |
|---|---|---|
| Platform operator (us) | Scripts only, never through the app UI | Create businesses, first Owner, initial data; support |
| Owner | Yes (email + password, 2FA TOTP) | Everything in their business, all locations |
| Cashier | Yes (email + password) | POS at **one** fixed location; void only the open cart; read-only stock for own location; own shift totals |
| Customer | **No** | Scan QR, view menu, place order, see order status |

Cost and profit data never reach cashier or customer sessions.

## Modules

1. **Onboarding:** operator setup script creates business, locations, first Owner. CSV import (with templates and row-level validation, nothing saved until all rows pass) for categories, products, add-ons, stock items, recipes.
2. **Business settings:** name, logo, currency (PHP), time zone, receipt header and footer, default order type, payment methods (name, QR image, needs reference number, active), online ordering on or off per location, table labels.
3. **Access:** login, session timeout, Owner creates and disables users.
4. **POS:** category tabs, product grid, add-on picker, cart (quantity, notes), dine-in or take-out, hold and recall, discount (percent or fixed), Pay (cash with change; QR methods show the business's QR and require a reference number), receipt via browser print ("Order slip, not an official receipt"), **Online orders tab** (accept, decline, mark ready) with a sound alert, offline banner and sale queue.
5. **Customer ordering (flow locked by the owner):** we generate the QR and give it to the business; the customer scans it, the business's menu opens in the browser, and the customer orders there. `/m/[code]` public menu for one location (code printed as a QR we generate; optional `?t=<table label>`). Cart with add-ons and notes, dine-in or take-out, customer first name, submit. Status page: received → accepted → ready. No login, no app download.
6. **Orders:** history per location, filters (date, cashier, order type, source), reprint, Owner void with required reason.
7. **Menu and recipes:** categories, products, prices, active toggle, add-ons and which products offer them, recipe lines per product and add-on, recipe cost (Owner only).
8. **Inventory:** stock items per location, base unit (g, ml, pcs) + optional purchase unit with conversion, reorder level, restock (with unit cost), adjustment, waste, stock count (variance → adjustment on confirm), movement history, low-stock alerts.
9. **Shifts:** open with starting cash, close with counted cash, variance vs expected cash.
10. **Dashboard and reports:** filters (location, date range); KPI cards (revenue, ingredient cost, gross profit, orders, average order value); sales trend; location comparison; best sellers incl. add-ons; payment mix; dine-in vs take-out; alerts. Six CSV reports: daily summary, sales by item, sales by cashier, inventory movement, shift variance, voids and discounts.

## Data model (15 tables; every table has `id uuid`, `created_at`, and `business_id` unless noted)

| Table | Key fields |
|---|---|
| businesses (no business_id) | name, logo_url, currency, time_zone, receipt_header, receipt_footer, default_order_type, active |
| locations | name, address, **menu_code** (unique, random, used in QR link), online_ordering_enabled, table_labels text[] |
| users | auth_user_id (Supabase Auth), name, email, role (owner/cashier), location_id (null for owner), active |
| payment_methods | name, qr_image_url, needs_reference, active |
| categories | name, sort_order |
| products | category_id, name, price_centavos, is_addon, active |
| product_addons | product_id, addon_product_id |
| stock_items | name, base_unit, purchase_unit, purchase_to_base_factor, reorder_level |
| recipe_lines | product_id, stock_item_id, qty_per_serving (in base unit) |
| location_stock | location_id, stock_item_id, on_hand (can be negative), avg_cost_centavos_per_base_unit (numeric) |
| orders | location_id, **client_sale_id** (unique with business_id), source (counter/qr), status, order_type, table_label, customer_first_name, cashier_id, shift_id, discount, total_centavos, payment_method_id, payment_reference, completed_at, void_reason |
| order_items | order_id, product_id, parent_item_id (for add-ons), qty, price_at_sale_centavos, cost_at_sale_centavos, note |
| stock_movements | location_id, stock_item_id, type (sale/void/restock/adjust/waste/count), qty_change, unit_cost, user_id, reason, order_id |
| shifts | location_id, cashier_id, opened_at, closed_at, starting_cash, expected_cash, counted_cash |
| order_rate_limits | location_id, device_hash, window_start, count (spam control for QR orders) |

Order status: counter sales go straight to `completed` (or `voided`). QR orders: `new → accepted → ready → completed`, or `declined` / `expired` (15 min without acceptance). Only `completed` counts as a sale.

## Core rules and formulas

- **Sale transaction (one DB transaction):** insert order + lines (on `client_sale_id` conflict, return existing order and stop) → for each line and add-on, for each recipe line: `UPDATE location_stock SET on_hand = on_hand - qty*recipe_qty` and insert `stock_movements(type='sale')` → store price and cost at sale → mark completed.
- **Item cost** = Σ (recipe qty × current average cost of that stock item at that location).
- **Weighted average cost on restock:** `new_avg = (on_hand × old_avg + qty_received × unit_cost) / (on_hand + qty_received)`. **If on_hand ≤ 0, new_avg = unit_cost.**
- **Gross profit** = Σ (price at sale − cost at sale) × qty, completed orders only.
- **Void:** order kept, excluded from sales; recipe deductions reversed with `stock_movements(type='void')`.
- **Products with no recipe** sell without deducting stock.
- **Low stock:** `on_hand ≤ reorder_level` → Low; `≤ 0` → Out (shown, still sellable at the counter; hidden from the customer menu).

## Security requirements

- RLS on every app table; app runs as a non-owner role without BYPASSRLS; Data API disabled; CI check for RLS.
- Isolation tests (app and direct DB) must prove business A can never read or write business B.
- Server-side role and location checks on every request. Cashier responses never include cost fields.
- Customer endpoints: read only one location's active menu by `menu_code`; create only `new` orders; recalculate prices; rate limit per device and per minute; honeypot field; 15-minute expiry; Owner can switch ordering off.
- Audit trail (stock movements, voids, discounts) cannot be edited from the app.
- Daily backups; restore runbook for whole DB and one business, tested before pilot sign-off.
- HTTPS only; secrets in env vars; Sentry with no personal data in events.

## Out of scope (do not build)

BIR compliance or official invoices; payment processing; self-serve sign-up; subscription billing; per-client features; separate DB per client; kitchen display; table management (beyond a table label); delivery or Lalamove; loyalty; SMS; customer accounts; thermal printer drivers; item size variants (each size is its own product); cashier PIN login (parked until after pilot).
