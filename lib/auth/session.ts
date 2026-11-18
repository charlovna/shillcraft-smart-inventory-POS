// Token -> StaffSession. The database decides the business, role and location
// (resolve_staff), so a disabled user or a deactivated business is locked out at once.
import type { PrismaClient } from "@/lib/generated/prisma/client";
import type { JWTVerifyGetKey } from "jose";
import { AuthError, type Role, type StaffSession } from "./guards";
import { supabaseIssuer, verifyAccessToken } from "./verify";

export async function sessionFromToken(
  prisma: PrismaClient,
  token: string | null | undefined,
  opts: { jwks: JWTVerifyGetKey; projectUrl: string },
): Promise<StaffSession> {
  const { authUserId } = await verifyAccessToken(token ?? "", opts.jwks, supabaseIssuer(opts.projectUrl));
  const rows = await prisma.$queryRaw<
    { business_id: string; user_id: string; role: Role; location_id: string | null }[]
  >`select business_id, user_id, role::text as role, location_id from resolve_staff(${authUserId}::uuid)`;
  const r = rows[0];
  if (!r) throw new AuthError("No active staff account", 403);
  return { businessId: r.business_id, userId: r.user_id, role: r.role, locationId: r.location_id };
}
