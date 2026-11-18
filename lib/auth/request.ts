// Turns an incoming request into a StaffSession. The token is the ONLY input.
// Business, role and location are looked up on the server; headers or query
// strings that claim a business are never read (CLAUDE.md rule 2).
import type { PrismaClient } from "@/lib/generated/prisma/client";
import type { JWTVerifyGetKey } from "jose";
import { AuthError, type StaffSession } from "./guards";
import { sessionFromToken } from "./session";

export const SESSION_COOKIE = "sb-access-token";

export type AuthDeps = { prisma: PrismaClient; jwks: JWTVerifyGetKey; projectUrl: string };

function tokenFrom(request: Request): string | null {
  const auth = request.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim() || null;
  const cookie = request.headers.get("cookie");
  if (cookie) {
    for (const part of cookie.split(";")) {
      const [name, ...rest] = part.trim().split("=");
      if (name === SESSION_COOKIE) return decodeURIComponent(rest.join("="));
    }
  }
  return null;
}

export function authenticateRequest(request: Request, deps: AuthDeps): Promise<StaffSession> {
  return sessionFromToken(deps.prisma, tokenFrom(request), { jwks: deps.jwks, projectUrl: deps.projectUrl });
}

/** Known auth problems become 401/403 with a safe message; anything else is a plain 500. */
export function errorResponse(e: unknown): Response {
  if (e instanceof AuthError) return Response.json({ error: e.message }, { status: e.status });
  console.error("Unhandled API error", e instanceof Error ? e.name : "unknown");
  return Response.json({ error: "Something went wrong" }, { status: 500 });
}
