import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";
import { apiError, apiSuccess } from "@/lib/http";
import { isSameOriginRequest } from "@/lib/app-config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const schema = z.object({ status: z.enum(["ACTIVE", "SUSPENDED"]) }).strict();

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request)) return apiError("Origin tidak valid.", 403, "INVALID_ORIGIN");
  let admin;
  try { admin = await requireAdmin(); }
  catch (error) {
    const forbidden = error instanceof Error && error.message === "FORBIDDEN";
    return apiError(forbidden ? "Akses admin diperlukan." : "Silakan masuk terlebih dahulu.", forbidden ? 403 : 401, forbidden ? "FORBIDDEN" : "UNAUTHENTICATED");
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("Status akun tidak valid.", 422, "VALIDATION_ERROR");
  const { id } = await context.params;
  if (id === admin.id && parsed.data.status === "SUSPENDED") return apiError("Akun admin yang sedang digunakan tidak bisa ditangguhkan.", 409, "CANNOT_SUSPEND_SELF");

  try {
    const updated = await db.$transaction(async (tx) => {
      const target = await tx.user.findUnique({ where: { id }, select: { id: true, username: true, role: true, status: true } });
      if (!target) throw new Error("USER_NOT_FOUND");
      if (target.status === "PENDING_VERIFICATION") throw new Error("PENDING_VERIFICATION");
      if (target.status === parsed.data.status) return { changed: false, username: target.username, status: target.status };
      if (target.role === "ADMIN" && target.status === "ACTIVE" && parsed.data.status === "SUSPENDED") {
        const activeAdmins = await tx.user.count({ where: { role: "ADMIN", status: "ACTIVE" } });
        if (activeAdmins <= 1) throw new Error("LAST_ACTIVE_ADMIN");
      }
      const user = await tx.user.update({ where: { id }, data: { status: parsed.data.status }, select: { id: true, username: true, status: true } });
      if (parsed.data.status === "SUSPENDED") await tx.session.deleteMany({ where: { userId: id } });
      await tx.auditLog.create({ data: {
        actorId: admin.id,
        action: parsed.data.status === "SUSPENDED" ? "USER_SUSPENDED" : "USER_REACTIVATED",
        targetType: "User",
        targetId: id,
        metadata: { username: target.username, previousStatus: target.status, status: user.status },
      } });
      return { changed: true, username: user.username, status: user.status };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 10000 });
    return apiSuccess({ ...updated, message: updated.changed ? "Status akun berhasil diperbarui." : "Status akun tidak berubah." });
  } catch (error) {
    if (error instanceof Error && error.message === "USER_NOT_FOUND") return apiError("Pengguna tidak ditemukan.", 404, "USER_NOT_FOUND");
    if (error instanceof Error && error.message === "PENDING_VERIFICATION") return apiError("Akun yang belum verifikasi email tidak bisa diubah melalui aksi ini.", 409, "PENDING_VERIFICATION");
    if (error instanceof Error && error.message === "LAST_ACTIVE_ADMIN") return apiError("Setidaknya satu admin aktif harus tetap tersedia.", 409, "LAST_ACTIVE_ADMIN");
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return apiError("Ada perubahan akun bersamaan. Muat ulang lalu coba lagi.", 409, "TRANSACTION_CONFLICT");
    console.error("admin_user_status_update_failed", error instanceof Error ? error.message : "unknown");
    return apiError("Status akun belum berubah. Coba lagi nanti.", 503, "USER_STATUS_UPDATE_FAILED");
  }
}
