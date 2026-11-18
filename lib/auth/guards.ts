// Who is calling, and what may they do. business, role and location come from the
// database via the verified login token, never from the browser (CLAUDE.md rule 2).
export type Role = "owner" | "cashier";

export type StaffSession = {
  businessId: string;
  userId: string;
  role: Role;
  /** null for owners (all locations); a cashier works at exactly one. */
  locationId: string | null;
};

export class AuthError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 403,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

/** 401 if nobody is signed in, 403 if the role is not allowed. */
export function requireRole(session: StaffSession | null, allowed: Role[]): asserts session is StaffSession {
  if (!session) throw new AuthError("Sign in required", 401);
  if (!allowed.includes(session.role)) throw new AuthError("Not allowed for your role", 403);
}

/** Owners may use any location of their business; cashiers only their own fixed one. */
export function requireLocation(session: StaffSession, locationId: string): void {
  if (session.role === "owner") return;
  if (!session.locationId || session.locationId !== locationId) {
    throw new AuthError("Not allowed at this location", 403);
  }
}
