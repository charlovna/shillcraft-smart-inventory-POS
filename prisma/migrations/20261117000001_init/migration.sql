-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('owner', 'cashier');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('new', 'accepted', 'ready', 'completed', 'voided', 'declined', 'expired');

-- CreateEnum
CREATE TYPE "OrderSource" AS ENUM ('counter', 'qr');

-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('dine_in', 'take_out');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('percent', 'fixed');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('sale', 'void', 'restock', 'adjust', 'waste', 'count');

-- CreateTable
CREATE TABLE "businesses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "logo_url" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'PHP',
    "time_zone" TEXT NOT NULL DEFAULT 'Asia/Manila',
    "receipt_header" TEXT,
    "receipt_footer" TEXT,
    "default_order_type" "OrderType" NOT NULL DEFAULT 'dine_in',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "businesses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "business_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "menu_code" TEXT NOT NULL,
    "online_ordering_enabled" BOOLEAN NOT NULL DEFAULT false,
    "table_labels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "business_id" UUID NOT NULL,
    "auth_user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "location_id" UUID,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_methods" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "business_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "qr_image_url" TEXT,
    "needs_reference" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "business_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "business_id" UUID NOT NULL,
    "category_id" UUID,
    "name" TEXT NOT NULL,
    "price_centavos" INTEGER NOT NULL,
    "is_addon" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_addons" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "business_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "addon_product_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_addons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "business_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "base_unit" TEXT NOT NULL,
    "purchase_unit" TEXT,
    "purchase_to_base_factor" DECIMAL(14,4),
    "reorder_level" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_lines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "business_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "stock_item_id" UUID NOT NULL,
    "qty_per_serving" DECIMAL(14,4) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recipe_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "location_stock" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "business_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "stock_item_id" UUID NOT NULL,
    "on_hand" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "avg_cost_centavos_per_base_unit" DECIMAL(14,6) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "location_stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shifts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "business_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "cashier_id" UUID NOT NULL,
    "opened_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMPTZ(6),
    "starting_cash" INTEGER NOT NULL,
    "expected_cash" INTEGER,
    "counted_cash" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "business_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "client_sale_id" UUID NOT NULL,
    "source" "OrderSource" NOT NULL DEFAULT 'counter',
    "status" "OrderStatus" NOT NULL DEFAULT 'completed',
    "order_type" "OrderType" NOT NULL DEFAULT 'dine_in',
    "table_label" TEXT,
    "customer_first_name" TEXT,
    "cashier_id" UUID,
    "shift_id" UUID,
    "discount_type" "DiscountType",
    "discount_value" INTEGER,
    "discount_centavos" INTEGER NOT NULL DEFAULT 0,
    "total_centavos" INTEGER NOT NULL DEFAULT 0,
    "payment_method_id" UUID,
    "payment_reference" TEXT,
    "completed_at" TIMESTAMPTZ(6),
    "void_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "business_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "parent_item_id" UUID,
    "qty" INTEGER NOT NULL,
    "price_at_sale_centavos" INTEGER NOT NULL,
    "cost_at_sale_centavos" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "business_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "stock_item_id" UUID NOT NULL,
    "type" "MovementType" NOT NULL,
    "qty_change" DECIMAL(14,3) NOT NULL,
    "unit_cost" DECIMAL(14,6),
    "user_id" UUID,
    "reason" TEXT,
    "order_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_rate_limits" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "business_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "device_hash" TEXT NOT NULL,
    "window_start" TIMESTAMPTZ(6) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_rate_limits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "locations_menu_code_key" ON "locations"("menu_code");

-- CreateIndex
CREATE INDEX "locations_business_id_idx" ON "locations"("business_id");

-- CreateIndex
CREATE UNIQUE INDEX "locations_business_id_id_key" ON "locations"("business_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "users_auth_user_id_key" ON "users"("auth_user_id");

-- CreateIndex
CREATE INDEX "users_business_id_idx" ON "users"("business_id");

-- CreateIndex
CREATE INDEX "users_location_id_idx" ON "users"("location_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_business_id_id_key" ON "users"("business_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "users_business_id_email_key" ON "users"("business_id", "email");

-- CreateIndex
CREATE INDEX "payment_methods_business_id_idx" ON "payment_methods"("business_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_methods_business_id_id_key" ON "payment_methods"("business_id", "id");

-- CreateIndex
CREATE INDEX "categories_business_id_idx" ON "categories"("business_id");

-- CreateIndex
CREATE UNIQUE INDEX "categories_business_id_id_key" ON "categories"("business_id", "id");

-- CreateIndex
CREATE INDEX "products_business_id_idx" ON "products"("business_id");

-- CreateIndex
CREATE INDEX "products_category_id_idx" ON "products"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "products_business_id_id_key" ON "products"("business_id", "id");

-- CreateIndex
CREATE INDEX "product_addons_business_id_idx" ON "product_addons"("business_id");

-- CreateIndex
CREATE INDEX "product_addons_product_id_idx" ON "product_addons"("product_id");

-- CreateIndex
CREATE INDEX "product_addons_addon_product_id_idx" ON "product_addons"("addon_product_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_addons_business_id_id_key" ON "product_addons"("business_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "product_addons_product_id_addon_product_id_key" ON "product_addons"("product_id", "addon_product_id");

-- CreateIndex
CREATE INDEX "stock_items_business_id_idx" ON "stock_items"("business_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_items_business_id_id_key" ON "stock_items"("business_id", "id");

-- CreateIndex
CREATE INDEX "recipe_lines_business_id_idx" ON "recipe_lines"("business_id");

-- CreateIndex
CREATE INDEX "recipe_lines_product_id_idx" ON "recipe_lines"("product_id");

-- CreateIndex
CREATE INDEX "recipe_lines_stock_item_id_idx" ON "recipe_lines"("stock_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "recipe_lines_business_id_id_key" ON "recipe_lines"("business_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "recipe_lines_product_id_stock_item_id_key" ON "recipe_lines"("product_id", "stock_item_id");

-- CreateIndex
CREATE INDEX "location_stock_business_id_idx" ON "location_stock"("business_id");

-- CreateIndex
CREATE INDEX "location_stock_location_id_idx" ON "location_stock"("location_id");

-- CreateIndex
CREATE INDEX "location_stock_stock_item_id_idx" ON "location_stock"("stock_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "location_stock_business_id_id_key" ON "location_stock"("business_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "location_stock_location_id_stock_item_id_key" ON "location_stock"("location_id", "stock_item_id");

-- CreateIndex
CREATE INDEX "shifts_business_id_idx" ON "shifts"("business_id");

-- CreateIndex
CREATE INDEX "shifts_location_id_idx" ON "shifts"("location_id");

-- CreateIndex
CREATE INDEX "shifts_cashier_id_idx" ON "shifts"("cashier_id");

-- CreateIndex
CREATE UNIQUE INDEX "shifts_business_id_id_key" ON "shifts"("business_id", "id");

-- CreateIndex
CREATE INDEX "orders_business_id_idx" ON "orders"("business_id");

-- CreateIndex
CREATE INDEX "orders_location_id_status_created_at_idx" ON "orders"("location_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "orders_location_id_idx" ON "orders"("location_id");

-- CreateIndex
CREATE INDEX "orders_cashier_id_idx" ON "orders"("cashier_id");

-- CreateIndex
CREATE INDEX "orders_shift_id_idx" ON "orders"("shift_id");

-- CreateIndex
CREATE INDEX "orders_payment_method_id_idx" ON "orders"("payment_method_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_business_id_id_key" ON "orders"("business_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_business_id_client_sale_id_key" ON "orders"("business_id", "client_sale_id");

-- CreateIndex
CREATE INDEX "order_items_business_id_idx" ON "order_items"("business_id");

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");

-- CreateIndex
CREATE INDEX "order_items_product_id_idx" ON "order_items"("product_id");

-- CreateIndex
CREATE INDEX "order_items_parent_item_id_idx" ON "order_items"("parent_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_items_business_id_id_key" ON "order_items"("business_id", "id");

-- CreateIndex
CREATE INDEX "stock_movements_business_id_idx" ON "stock_movements"("business_id");

-- CreateIndex
CREATE INDEX "stock_movements_stock_item_id_created_at_idx" ON "stock_movements"("stock_item_id", "created_at");

-- CreateIndex
CREATE INDEX "stock_movements_location_id_idx" ON "stock_movements"("location_id");

-- CreateIndex
CREATE INDEX "stock_movements_stock_item_id_idx" ON "stock_movements"("stock_item_id");

-- CreateIndex
CREATE INDEX "stock_movements_user_id_idx" ON "stock_movements"("user_id");

-- CreateIndex
CREATE INDEX "stock_movements_order_id_idx" ON "stock_movements"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_movements_business_id_id_key" ON "stock_movements"("business_id", "id");

-- CreateIndex
CREATE INDEX "order_rate_limits_business_id_idx" ON "order_rate_limits"("business_id");

-- CreateIndex
CREATE INDEX "order_rate_limits_location_id_idx" ON "order_rate_limits"("location_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_rate_limits_business_id_id_key" ON "order_rate_limits"("business_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "order_rate_limits_location_id_device_hash_window_start_key" ON "order_rate_limits"("location_id", "device_hash", "window_start");

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_business_id_location_id_fkey" FOREIGN KEY ("business_id", "location_id") REFERENCES "locations"("business_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_business_id_category_id_fkey" FOREIGN KEY ("business_id", "category_id") REFERENCES "categories"("business_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_addons" ADD CONSTRAINT "product_addons_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_addons" ADD CONSTRAINT "product_addons_business_id_product_id_fkey" FOREIGN KEY ("business_id", "product_id") REFERENCES "products"("business_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_addons" ADD CONSTRAINT "product_addons_business_id_addon_product_id_fkey" FOREIGN KEY ("business_id", "addon_product_id") REFERENCES "products"("business_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_lines" ADD CONSTRAINT "recipe_lines_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_lines" ADD CONSTRAINT "recipe_lines_business_id_product_id_fkey" FOREIGN KEY ("business_id", "product_id") REFERENCES "products"("business_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_lines" ADD CONSTRAINT "recipe_lines_business_id_stock_item_id_fkey" FOREIGN KEY ("business_id", "stock_item_id") REFERENCES "stock_items"("business_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_stock" ADD CONSTRAINT "location_stock_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_stock" ADD CONSTRAINT "location_stock_business_id_location_id_fkey" FOREIGN KEY ("business_id", "location_id") REFERENCES "locations"("business_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_stock" ADD CONSTRAINT "location_stock_business_id_stock_item_id_fkey" FOREIGN KEY ("business_id", "stock_item_id") REFERENCES "stock_items"("business_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_business_id_location_id_fkey" FOREIGN KEY ("business_id", "location_id") REFERENCES "locations"("business_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_business_id_cashier_id_fkey" FOREIGN KEY ("business_id", "cashier_id") REFERENCES "users"("business_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_business_id_location_id_fkey" FOREIGN KEY ("business_id", "location_id") REFERENCES "locations"("business_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_business_id_cashier_id_fkey" FOREIGN KEY ("business_id", "cashier_id") REFERENCES "users"("business_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_business_id_shift_id_fkey" FOREIGN KEY ("business_id", "shift_id") REFERENCES "shifts"("business_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_business_id_payment_method_id_fkey" FOREIGN KEY ("business_id", "payment_method_id") REFERENCES "payment_methods"("business_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_business_id_order_id_fkey" FOREIGN KEY ("business_id", "order_id") REFERENCES "orders"("business_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_business_id_product_id_fkey" FOREIGN KEY ("business_id", "product_id") REFERENCES "products"("business_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_business_id_parent_item_id_fkey" FOREIGN KEY ("business_id", "parent_item_id") REFERENCES "order_items"("business_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_business_id_location_id_fkey" FOREIGN KEY ("business_id", "location_id") REFERENCES "locations"("business_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_business_id_stock_item_id_fkey" FOREIGN KEY ("business_id", "stock_item_id") REFERENCES "stock_items"("business_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_business_id_user_id_fkey" FOREIGN KEY ("business_id", "user_id") REFERENCES "users"("business_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_business_id_order_id_fkey" FOREIGN KEY ("business_id", "order_id") REFERENCES "orders"("business_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_rate_limits" ADD CONSTRAINT "order_rate_limits_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_rate_limits" ADD CONSTRAINT "order_rate_limits_business_id_location_id_fkey" FOREIGN KEY ("business_id", "location_id") REFERENCES "locations"("business_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

