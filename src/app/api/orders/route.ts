import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { OrderStatus, LedgerType, Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { apiError, apiSuccess } from "@/lib/http";
import { indosmm } from "@/lib/providers/indosmm";
import { postWalletEntry } from "@/lib/wallet/ledger";

export const dynamic = "force-dynamic";
const CreateOrderSchema = z.object({
  serviceId: z.string().min(1).max(64),
  link: z.string().trim().max(2048).refine((v) => { try { return ["http:", "https:"].includes(new URL(v).protocol); } catch { return false; } }, "Masukkan URL HTTP atau HTTPS yang valid"),
  quantity: z.number().int().min(1).max(10_000_000),
}).strict();

function chargeFromRate(rate: Prisma.Decimal, quantity: number): bigint {
  // Rate is stored as IDR per 1,000 units; round up to the next whole rupiah.
  const scaled = rate.mul(quantity).div(1000).toDecimalPlaces(0, Prisma.Decimal.ROUND_UP);
  if (!scaled.isFinite() || scaled.lte(0) || scaled.gt("100000000000")) throw new Error("INVALID_CHARGE");
  return BigInt(scaled.toFixed(0));
}

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return apiError("Silakan masuk terlebih dahulu.", 401, "UNAUTHENTICATED");
  const url = new URL(request.url);
  const page = Math.max(1, Math.min(1000, Number(url.searchParams.get("page") ?? 1) || 1));
  const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") ?? 20) || 20));
  const [items, total] = await db.$transaction([
    db.order.findMany({ where: { userId: user.id }, include: { service: { select: { name: true } } }, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }),
    db.order.count({ where: { userId: user.id } }),
  ]);
  return apiSuccess({ items: items.map((item) => ({ ...item, charge: item.charge.toString(), providerResponse: undefined })), pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return apiError("Silakan masuk terlebih dahulu.", 401, "UNAUTHENTICATED");
  const idempotencyKey = request.headers.get("idempotency-key")?.trim();
  if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 128) {
    return apiError("Header Idempotency-Key wajib diisi (8–128 karakter).", 400, "INVALID_IDEMPOTENCY_KEY");
  }
  const parsed = CreateOrderSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("Data pesanan tidak valid.", 400, "VALIDATION_ERROR");
  const { serviceId, link, quantity } = parsed.data;

  const prior = await db.order.findUnique({ where: { userId_idempotencyKey: { userId: user.id, idempotencyKey } } });
  if (prior) {
    if (prior.targetUrl !== link || prior.quantity !== quantity || prior.serviceId !== serviceId) return apiError("Idempotency-Key sudah digunakan untuk payload berbeda.", 409, "IDEMPOTENCY_CONFLICT");
    return apiSuccess({ order: { id: prior.id, reference: prior.internalReference, status: prior.status, charge: prior.charge.toString() } }, 200);
  }

  const service = await db.service.findFirst({ where: { id: serviceId, isActive: true, provider: { isEnabled: true } }, include: { provider: true } });
  if (!service) return apiError("Layanan tidak tersedia.", 404, "SERVICE_UNAVAILABLE");
  if (!service.provider.baseUrl.startsWith("https://indosmm.id/api/v2") || !/indo\s*smm/i.test(service.provider.name)) {
    return apiError("Provider layanan ini belum didukung untuk pemesanan otomatis.", 503, "PROVIDER_NOT_SUPPORTED");
  }
  if (quantity < service.minQuantity || quantity > service.maxQuantity) return apiError(`Jumlah harus antara ${service.minQuantity} dan ${service.maxQuantity}.`, 400, "QUANTITY_OUT_OF_RANGE");
  const charge = chargeFromRate(service.sellingRate, quantity);
  const reference = `NX-${randomUUID().replaceAll("-", "").slice(0, 20).toUpperCase()}`;
  let orderId: string;
  try {
    const order = await db.$transaction(async (tx) => {
      const existing = await tx.order.findUnique({ where: { userId_idempotencyKey: { userId: user.id, idempotencyKey } } });
      if (existing) return existing;
      const transaction = await tx.transaction.create({ data: { userId: user.id, type: LedgerType.ORDER_DEBIT, amount: -charge, status: "POSTED", referenceId: reference, description: `Pesanan ${service.name}` } });
      const created = await tx.order.create({ data: {
        userId: user.id, serviceId: service.id, internalReference: reference, targetUrl: link, quantity, charge,
        idempotencyKey, status: OrderStatus.SUBMITTING,
        statusHistory: { create: { fromStatus: null, toStatus: OrderStatus.SUBMITTING, source: "API", note: "Saldo direservasi; menunggu respons provider." } },
      } });
      await postWalletEntry(tx, { userId: user.id, amount: -charge, type: LedgerType.ORDER_DEBIT, transactionId: transaction.id, idempotencyKey: `order:${created.id}:debit`, referenceId: created.id, reason: `Order ${reference}` });
      return created;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 10000 });
    orderId = order.id;
    if (order.status !== OrderStatus.SUBMITTING || order.internalReference !== reference) {
      return apiSuccess({ order: { id: order.id, reference: order.internalReference, status: order.status, charge: order.charge.toString() } });
    }
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_BALANCE") return apiError("Saldo tidak mencukupi.", 402, "INSUFFICIENT_BALANCE");
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return apiError("Permintaan duplikat terdeteksi; ulangi dengan Idempotency-Key yang sama.", 409, "DUPLICATE_REQUEST");
    console.error("order_reservation_failed", error);
    return apiError("Pesanan belum dapat dibuat. Silakan coba lagi.", 503, "ORDER_RESERVATION_FAILED");
  }

  // Never auto-retry this network call: a timeout can mean the provider accepted the order.
  try {
    const result = await indosmm.createOrder({ service: service.providerServiceId, link, quantity });
    const providerOrderId = String(result.order);
    const updated = await db.$transaction(async (tx) => {
      const current = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
      if (current.status !== OrderStatus.SUBMITTING) return current;
      const next = await tx.order.update({ where: { id: orderId }, data: { providerOrderId, status: OrderStatus.PROCESSING, providerResponse: { accepted: true } } });
      await tx.orderStatusHistory.create({ data: { orderId, fromStatus: current.status, toStatus: OrderStatus.PROCESSING, source: "INDOSMM", note: "Provider mengembalikan ID pesanan." } });
      return next;
    });
    return apiSuccess({ order: { id: updated.id, reference: updated.internalReference, status: updated.status, charge: updated.charge.toString() } }, 201);
  } catch (error) {
    console.error("provider_order_submission_uncertain", { orderId, error });
    await db.order.updateMany({ where: { id: orderId, status: OrderStatus.SUBMITTING }, data: { status: OrderStatus.SUBMISSION_UNKNOWN, providerResponse: { uncertain: true } } }).catch(() => undefined);
    await db.orderStatusHistory.create({ data: { orderId, fromStatus: OrderStatus.SUBMITTING, toStatus: OrderStatus.SUBMISSION_UNKNOWN, source: "SYSTEM", note: "Respons provider tidak dapat dipastikan; perlu rekonsiliasi manual sebelum retry/refund." } }).catch(() => undefined);
    return NextResponse.json({ error: { code: "PROVIDER_SUBMISSION_UNKNOWN", message: "Pesanan tercatat tetapi respons provider belum dapat dipastikan. Jangan membuat pesanan ulang; tim perlu memeriksa statusnya." }, data: { orderId } }, { status: 202 });
  }
}
