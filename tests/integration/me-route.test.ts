// Route-level G2 check for the first guarded endpoint (GET /api/me), against the real database.
// A signed-in user only ever learns about their own business; bad sessions get 401/403.
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from "jose";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPrisma } from "@/lib/db";
import { handleMe } from "@/lib/api/me";
import { supabaseIssuer } from "@/lib/auth/verify";
import { A, B, connect, ids, seedTwoBusinesses } from "./helpers";

const PROJECT = "https://example-project.supabase.co";
const CASHIER_AUTH = "aaaaaaaa-6000-4000-8000-0000000000c1";
const CASHIER_USER = "aaaaaaaa-5000-4000-8000-0000000000c1";

let owner: pg.Client;
const prisma = createPrisma(process.env.TEST_DB_APP_URL!);
let deps: { prisma: typeof prisma; jwks: ReturnType<typeof createLocalJWKSet>; projectUrl: string };
let tokenFor: (sub: string, exp?: string) => Promise<string>;

beforeAll(async () => {
  owner = await connect(process.env.TEST_DB_OWNER_URL!);
  await seedTwoBusinesses(owner);
  await owner.query(
    `insert into users (id,business_id,auth_user_id,name,email,role,location_id)
     values ($1,$2,$3,'Cashier A','cashier-a@example.com','cashier',$4)`,
    [CASHIER_USER, A, CASHIER_AUTH, ids.locA]);
  const { publicKey, privateKey } = await generateKeyPair("ES256");
  const jwks = createLocalJWKSet({ keys: [{ ...(await exportJWK(publicKey)), kid: "k", alg: "ES256", use: "sig" }] });
  deps = { prisma, jwks, projectUrl: PROJECT };
  tokenFor = (sub, exp = "1h") =>
    new SignJWT({}).setProtectedHeader({ alg: "ES256", kid: "k" }).setSubject(sub)
      .setIssuer(supabaseIssuer(PROJECT)).setAudience("authenticated").setIssuedAt().setExpirationTime(exp).sign(privateKey);
});
afterAll(async () => {
  await owner.end();
  await prisma.$disconnect();
});

const call = async (headers: Record<string, string>) =>
  handleMe(new Request("https://app.test/api/me", { headers }), deps);

describe("GET /api/me", () => {
  it("returns 200 with the caller's own business and role (Bearer token)", async () => {
    const res = await call({ authorization: `Bearer ${await tokenFor(ids.authA)}` });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ role: "owner", locationId: null, business: { id: A, name: "Business A" } });
  });

  it("business B's owner sees business B, never A", async () => {
    const res = await call({ authorization: `Bearer ${await tokenFor(ids.authB)}` });
    expect(await res.json()).toEqual({ role: "owner", locationId: null, business: { id: B, name: "Business B" } });
  });

  it("a cashier gets their fixed location", async () => {
    const res = await call({ authorization: `Bearer ${await tokenFor(CASHIER_AUTH)}` });
    expect(await res.json()).toEqual({ role: "cashier", locationId: ids.locA, business: { id: A, name: "Business A" } });
  });

  it("accepts the token from the session cookie", async () => {
    const res = await call({ cookie: `theme=dark; sb-access-token=${await tokenFor(ids.authA)}` });
    expect(res.status).toBe(200);
  });

  it("a client-supplied business id header or query is ignored", async () => {
    const res = await handleMe(
      new Request(`https://app.test/api/me?business_id=${B}`, {
        headers: { authorization: `Bearer ${await tokenFor(ids.authA)}`, "x-business-id": B },
      }), deps);
    expect(((await res.json()) as { business: { id: string } }).business.id).toBe(A);
  });

  it("no token gives 401", async () => {
    expect((await call({})).status).toBe(401);
  });

  it("an expired or forged token gives 401", async () => {
    expect((await call({ authorization: `Bearer ${await tokenFor(ids.authA, "-1m")}` })).status).toBe(401);
    expect((await call({ authorization: "Bearer not.a.jwt" })).status).toBe(401);
  });

  it("a disabled user gets 403 straight away", async () => {
    await owner.query("update users set active=false where id=$1", [CASHIER_USER]);
    expect((await call({ authorization: `Bearer ${await tokenFor(CASHIER_AUTH)}` })).status).toBe(403);
    await owner.query("update users set active=true where id=$1", [CASHIER_USER]);
  });

  it("errors never leak details", async () => {
    const res = await call({ authorization: "Bearer not.a.jwt" });
    expect(await res.json()).toEqual({ error: "Invalid or expired session" });
  });
});
