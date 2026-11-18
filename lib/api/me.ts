// GET /api/me: who is signed in, and for which business. First guarded endpoint,
// and the pattern every later route follows: authenticate -> role/location check ->
// withBusiness() for all data access.
import { withBusiness } from "@/lib/db";
import { authenticateRequest, errorResponse, type AuthDeps } from "@/lib/auth/request";
import { requireRole } from "@/lib/auth/guards";

export async function handleMe(request: Request, deps: AuthDeps): Promise<Response> {
  try {
    const session = await authenticateRequest(request, deps);
    requireRole(session, ["owner", "cashier"]);
    const business = await withBusiness(deps.prisma, session.businessId, (tx) =>
      tx.business.findFirstOrThrow({ select: { id: true, name: true } }));
    return Response.json({ role: session.role, locationId: session.locationId, business });
  } catch (e) {
    return errorResponse(e);
  }
}
