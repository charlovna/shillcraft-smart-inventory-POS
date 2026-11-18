// Builds a fresh throwaway database from the real migrations, so tests run against
// the same schema, roles and RLS policies that staging and production get.
import { execFileSync } from "node:child_process";
import pg from "pg";

const DB = "shillcraft_test";
const APP_PASSWORD = "test_only_app_password";

function withDb(url: string, db: string) {
  const u = new URL(url);
  u.pathname = `/${db}`;
  return u.toString();
}

export default async function setup() {
  const adminUrl = process.env.TEST_OWNER_URL;
  if (!adminUrl) {
    throw new Error("TEST_OWNER_URL is not set (owner connection to the local test PostgreSQL). See .env.example.");
  }
  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`drop database if exists ${DB} with (force)`);
  await admin.query(`create database ${DB}`);

  const ownerDbUrl = withDb(adminUrl, DB);
  execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], {
    env: { ...process.env, DIRECT_URL: ownerDbUrl },
    stdio: "pipe",
  });
  await admin.query(`alter role app_runtime password '${APP_PASSWORD}'`);
  await admin.end();

  const app = new URL(ownerDbUrl);
  app.username = "app_runtime";
  app.password = APP_PASSWORD;
  process.env.TEST_DB_OWNER_URL = ownerDbUrl;
  process.env.TEST_DB_APP_URL = app.toString();

  return async () => {
    const a = new pg.Client({ connectionString: adminUrl });
    await a.connect();
    await a.query(`drop database if exists ${DB} with (force)`);
    await a.end();
  };
}
