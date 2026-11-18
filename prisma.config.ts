import "dotenv/config";
import { defineConfig } from "prisma/config";

// Migrations run as the table owner via DIRECT_URL (never the app role).
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env.DIRECT_URL ?? "" },
});
