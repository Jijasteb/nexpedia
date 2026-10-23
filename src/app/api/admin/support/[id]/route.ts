import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";
import { apiError, apiSuccess } from "@/lib/http";
import { isSameOriginRequest } from "@/lib/app-config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  message: z.string().trim().max(4000).optional(),
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]).optional(),
}).strict().refine((value) => Boolean(value.message) || Boolean(value.status), {
  message: "Balasan atau status wajib diisi.",
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request)) return apiError("Origin tidak valid.", 403, "INVALID_ORIGIN");
  let admin;
  try {
    admin = await requireAdmin();
  } catch (error) {
    const unauthenticated = error instanceof Error && error.message === "UNAUTHENTICATED";
    return apiError(unauthenticated ? "Silakan masuk terlebih dahulu." : "Akses admin diperlukan.", unauthenticated ? 401 : 403, unauthenticated ? "UNAUTHENTICATED" : "FORBIDDEN");
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("Isi balasan (1–4000 karakter) atau pilih status tiket.", 422, "VALIDATION_ERROR");
  if (parsed.data.message !== undefined && parsed.data.message.length < 1) return apiError("Balasan tidak boleh kosong.", 422, "EMPTY_MESSAGE");
  const { id } = await context.params;
  const existing = await db.supportTicket.findUnique({ where: { id }, select: { id: true, status: true, subject: true } });
  if (!existing) return apiError("Tiket bantuan tidak ditemukan.", 404, "TICKET_NOT_FOUND");

  try {
    const result = await db.$transaction(async (tx) => {
      const ticket = await tx.supportTicket.update({
        where: { id },
        data: parsed.data.status ? { status: parsed.data.status } : {},
        select: { id: true, status: true, subject: true },
      });
      let messageId: string | null = null;
      if (parsed.data.message) {
        const message = await tx.supportMessage.create({ data: {
          ticketId: id,
          authorId: admin.id,
          body: parsed.data.message,
          isAdmin: true,
        }, select: { id: true } });
        messageId = message.id;
      }
      await tx.auditLog.create({ data: {
        actorId: admin.id,
        action: parsed.data.message ? "SUPPORT_REPLY_SENT" : "SUPPORT_TICKET_STATUS_UPDATED",
        targetType: "SupportTicket",
        targetId: id,
        metadata: {
          subject: existing.subject,
          previousStatus: existing.status,
          status: ticket.status,
          replied: Boolean(parsed.data.message),
          messageId,
        },
      } });
      return { ticket, messageId };
    });
    return apiSuccess({ ...result, message: "Tiket berhasil diperbarui." });
  } catch (error) {
    console.error("admin_support_update_failed", error instanceof Error ? error.message : "unknown");
    return apiError("Tiket belum berubah. Silakan muat ulang dan coba lagi.", 503, "SUPPORT_UPDATE_FAILED");
  }
}
