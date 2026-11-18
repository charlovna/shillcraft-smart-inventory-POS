import { handleMe } from "@/lib/api/me";
import { remoteJwks } from "@/lib/auth/verify";
import { requestPrisma } from "@/lib/db/runtime";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!projectUrl) return Response.json({ error: "Server is not configured" }, { status: 500 });
  const { prisma, release } = requestPrisma();
  try {
    return await handleMe(request, { prisma, jwks: remoteJwks(projectUrl), projectUrl });
  } finally {
    release();
  }
}
