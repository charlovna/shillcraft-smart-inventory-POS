// lib/auth: token verification and role/location guards. Pure logic, no network:
// tokens are signed with a throwaway local key and checked against a local key set.
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import { verifyAccessToken } from "@/lib/auth/verify";
import { AuthError, requireLocation, requireRole, type StaffSession } from "@/lib/auth/guards";

const ISSUER = "https://example-project.supabase.co/auth/v1";
const SUB = "aaaaaaaa-6000-4000-8000-000000000001";
let jwks: ReturnType<typeof createLocalJWKSet>;
let sign: (claims?: { sub?: string; iss?: string; aud?: string; exp?: string | number; key?: CryptoKey }) => Promise<string>;

beforeAll(async () => {
  const { publicKey, privateKey } = await generateKeyPair("ES256");
  const jwk = { ...(await exportJWK(publicKey)), kid: "k1", alg: "ES256", use: "sig" };
  jwks = createLocalJWKSet({ keys: [jwk] });
  sign = async (c = {}) =>
    new SignJWT({ role: "authenticated" })
      .setProtectedHeader({ alg: "ES256", kid: "k1" })
      .setSubject(c.sub ?? SUB)
      .setIssuer(c.iss ?? ISSUER)
      .setAudience(c.aud ?? "authenticated")
      .setIssuedAt()
      .setExpirationTime(c.exp ?? "1h")
      .sign(c.key ?? privateKey);
});

describe("verifyAccessToken", () => {
  it("returns the auth user id (sub) for a valid token", async () => {
    expect(await verifyAccessToken(await sign(), jwks, ISSUER)).toEqual({ authUserId: SUB });
  });

  it("rejects an expired token", async () => {
    await expect(verifyAccessToken(await sign({ exp: Math.floor(Date.now() / 1000) - 60 }), jwks, ISSUER)).rejects.toThrow(AuthError);
  });

  it("rejects a token from a different project (wrong issuer)", async () => {
    await expect(verifyAccessToken(await sign({ iss: "https://other.supabase.co/auth/v1" }), jwks, ISSUER)).rejects.toThrow(AuthError);
  });

  it("rejects a token that is not for signed-in users (wrong audience)", async () => {
    await expect(verifyAccessToken(await sign({ aud: "anon" }), jwks, ISSUER)).rejects.toThrow(AuthError);
  });

  it("rejects a token signed with a different key (forged)", async () => {
    const other = await generateKeyPair("ES256");
    await expect(verifyAccessToken(await sign({ key: other.privateKey }), jwks, ISSUER)).rejects.toThrow(AuthError);
  });

  it("rejects garbage and empty input", async () => {
    await expect(verifyAccessToken("not.a.jwt", jwks, ISSUER)).rejects.toThrow(AuthError);
    await expect(verifyAccessToken("", jwks, ISSUER)).rejects.toThrow(AuthError);
  });
});

const owner: StaffSession = { businessId: "b1", userId: "u1", role: "owner", locationId: null };
const cashier1: StaffSession = { businessId: "b1", userId: "u2", role: "cashier", locationId: "loc1" };

describe("requireRole", () => {
  it("lets an owner do owner-only work", () => {
    expect(() => requireRole(owner, ["owner"])).not.toThrow();
  });
  it("blocks a cashier from owner-only work with a 403", () => {
    try {
      requireRole(cashier1, ["owner"]);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(AuthError);
      expect((e as AuthError).status).toBe(403);
    }
  });
  it("blocks a missing session with a 401", () => {
    try {
      requireRole(null, ["owner", "cashier"]);
      expect.unreachable();
    } catch (e) {
      expect((e as AuthError).status).toBe(401);
    }
  });
});

describe("requireLocation", () => {
  it("lets an owner use any location of the business", () => {
    expect(() => requireLocation(owner, "loc1")).not.toThrow();
    expect(() => requireLocation(owner, "loc2")).not.toThrow();
  });
  it("lets a cashier use only their own fixed location", () => {
    expect(() => requireLocation(cashier1, "loc1")).not.toThrow();
    expect(() => requireLocation(cashier1, "loc2")).toThrow(AuthError);
  });
  it("blocks a cashier who has no location assigned", () => {
    expect(() => requireLocation({ ...cashier1, locationId: null }, "loc1")).toThrow(AuthError);
  });
});
