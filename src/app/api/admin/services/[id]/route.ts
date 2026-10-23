import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";
import { apiError, apiSuccess } from "@/lib/http";
import { isSameOriginRequest } from "@/lib/app-config";
const schema = z.object({ isActive: z.boolean().optional(), sellingRate: z.string().regex(/^\d{1,12}(\.\d{1,6})?$/).optional() }).strict().refine((v) => v.isActive !== undefined || v.sellingRate !== undefined);
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request)) return apiError("Origin tidak valid.", 403, "INVALID_ORIGIN");
  let admin;
  try { admin = await requireAdmin(); } catch (error) {
    return apiError(error instanceof Error && error.message === "UNAUTHENTICATED" ? "Silakan masuk terlebih dahulu." : "Akses admin diperlukan.", error instanceof Error && error.message === "UNAUTHENTICATED" ? 401 : 403, "FORBIDDEN");
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("Data layanan tidak valid.", 422, "VALIDATION_ERROR");
  const { id } = await context.params;
  const service = await db.service.findUnique({ where: { id }, include: { provider: true } });
  if (!service) return apiError("Layanan tidak ditemukan.", 404, "SERVICE_NOT_FOUND");
  if (parsed.data.isActive === true && (!service.provider.isEnabled || service.sellingRate.lte(0)) && parsed.data.sellingRate === undefined) return apiError("Aktifkan provider dan tetapkan harga jual yang valid terlebih dahulu.", 409, "PROVIDER_OR_PRICE_NOT_READY");
  const sellingRate = parsed.data.sellingRate === undefined ? undefined : new Prisma.Decimal(parsed.data.sellingRate);
  if (sellingRate && (sellingRate.lte(0) || sellingRate.lt(service.baseRate))) return apiError("Harga jual harus positif dan tidak boleh di bawah harga dasar provider.", 422, "INVALID_SELLING_RATE");
  const updated = await db.service.update({ where: { id }, data: { ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive && service.provider.isEnabled } : {}), ...(sellingRate ? { sellingRate } : {}) } });
  await db.auditLog.create({ data: { actorId: admin.id, action: "SERVICE_UPDATED", targetType: "Service", targetId: id, metadata: { isActive: updated.isActive, sellingRate: updated.sellingRate.toString() } } });
  return apiSuccess({ id: updated.id, isActive: updated.isActive, sellingRate: updated.sellingRate.toString() });
}
