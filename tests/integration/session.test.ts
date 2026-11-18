// Token -> session against the real database (resolve_staff). Tokens are signed
// with a throwaway local key; business, role and location always come from the DB.
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from "jose";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPrisma } from "@/lib/db";
import { AuthError } from "@/lib/auth/guards";
import { sessionFromToken } from "@/lib/auth/session";
import { supabaseIssuer } from "@/lib/auth/verify";
import { A, B, connect, ids, seedTwoBusinesses } from "./helpers";

const PROJECT = "https://example-project.supabase.co";
const CASHIER_AUTH = "aaaaaaaa-6000-4000-8000-0000000000c1";
const CASHIER_USER = "aaaaaaaa-5000-4000-8000-0000000000c1";

let owner: pg.Client;
const prisma = createPrisma(process.env.TEST_DB_APP_URL!);
let jwks: ReturnType<typeof createLocalJWKSet>;
let tokenFor: (sub: string) => Promise<string>;

beforeAll(async () => {
  owner = await connect(process.env.TEST_DB_OWNER_URL!);
  await seedTwoBusinesses(owner);
  await owner.query(
    `insert into users (id,business_id,auth_user_id,name,email,role,location_id)
     values ($1,$2,$3,'Cashier A','cashier-a@example.com','cashier',$4)`,
    [CASHIER_USER, A, CASHIER_AUTH, ids.locA]);
  const { publicKey, privateKey } = await generateKeyPair("ES256");
  jwks = createLocalJWKSet({ keys: [{ ...(await exportJWK(publicKey)), kid: "k", alg: "ES256", use: "sig" }] });
  tokenFor = (sub) =>
    new SignJWT({}).setProtectedHeader({ alg: "ES256", kid: "k" }).setSubject(sub)
      .setIssuer(supabaseIssuer(PROJECT)).setAudience("authenticated").setIssuedAt().setExpirationTime("1h").sign(privateKey);
});
afterAll(async () => {
  await owner.end();
  await prisma.$disconnect();
});

const get = async (sub: string) => sessionFromToken(prisma, await tokenFor(sub), { jwks, projectUrl: PROJECT });

describe("sessionFromToken", () => {
  it("maps an owner to their business, role owner, no fixed location", async () => {
    expect(await get(ids.authA)).toEqual({ businessId: A, userId: ids.userA, role: "owner", locationId: null });
  });

  it("maps a cashier to their business and their one fixed location", async () => {
    expect(await get(CASHIER_AUTH)).toEqual({ businessId: A, userId: CASHIER_USER, role: "cashier", locationId: ids.locA });
  });

  it("gives business B's owner business B, never A", async () => {
    expect((await get(ids.authB)).businessId).toBe(B);
  });

  it("rejects a valid token for a user that does not exist (403)", async () => {
    await expect(get("cccccccc-6000-4000-8000-000000000009")).rejects.toMatchObject({ status: 403 });
  });

  it("rejects a disabled user at once (403)", async () => {
    await owner.query("update users set active=false where id=$1", [CASHIER_USER]);
    await expect(get(CASHIER_AUTH)).rejects.toMatchObject({ status: 403 });
    await owner.query("update users set active=true where id=$1", [CASHIER_USER]);
  });

  it("rejects staff of a deactivated business (403)", async () => {
    await owner.query("update businesses set active=false where id=$1", [B]);
    await expect(get(ids.authB)).rejects.toMatchObject({ status: 403 });
    await owner.query("update businesses set active=true where id=$1", [B]);
  });

  it("rejects a missing token (401)", async () => {
    await expect(sessionFromToken(prisma, null, { jwks, projectUrl: PROJECT })).rejects.toBeInstanceOf(AuthError);
    await expect(sessionFromToken(prisma, undefined, { jwks, projectUrl: PROJECT })).rejects.toMatchObject({ status: 401 });
  });
});
