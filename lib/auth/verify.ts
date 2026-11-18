// Verifies a Supabase Auth access token on the server using the project's PUBLIC
// signing keys. No secret is needed. Staff login only; the Data API stays off.
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { AuthError } from "./guards";

export function supabaseIssuer(projectUrl: string): string {
  return `${projectUrl.replace(/\/+$/, "")}/auth/v1`;
}

export function remoteJwks(projectUrl: string): JWTVerifyGetKey {
  return createRemoteJWKSet(new URL(`${supabaseIssuer(projectUrl)}/.well-known/jwks.json`));
}

export async function verifyAccessToken(
  token: string,
  jwks: JWTVerifyGetKey,
  issuer: string,
): Promise<{ authUserId: string }> {
  if (!token) throw new AuthError("Sign in required", 401);
  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer,
      audience: "authenticated",
      algorithms: ["ES256", "RS256"],
    });
    if (!payload.sub) throw new Error("no subject");
    return { authUserId: payload.sub };
  } catch {
    throw new AuthError("Invalid or expired session", 401);
  }
}
