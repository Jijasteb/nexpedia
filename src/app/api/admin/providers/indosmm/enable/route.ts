import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";
import { apiError, apiSuccess } from "@/lib/http";
import { isSameOriginRequest } from "@/lib/app-config";
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return apiError("Origin tidak valid.", 403, "INVALID_ORIGIN");
  let admin;
  try { admin = await requireAdmin(); } catch (error) {
    return apiError(error instanceof Error && error.message === "UNAUTHENTICATED" ? "Silakan masuk terlebih dahulu." : "Akses admin diperlukan.", error instanceof Error && error.message === "UNAUTHENTICATED" ? 401 : 403, "FORBIDDEN");
  }
  const provider = await db.provider.findUnique({ where: { name: "IndoSMM" } });
  if (!provider) return apiError("Provider belum disinkronkan.", 404, "PROVIDER_NOT_FOUND");
  const updated = await db.provider.update({ where: { id: provider.id }, data: { isEnabled: !provider.isEnabled } });
  await db.auditLog.create({ data: { actorId: admin.id, action: updated.isEnabled ? "PROVIDER_ENABLED" : "PROVIDER_DISABLED", targetType: "Provider", targetId: updated.id } });
  return apiSuccess({ name: updated.name, isEnabled: updated.isEnabled });
}
