import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { DepositStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { apiError, apiSuccess } from "@/lib/http";
import { cashi } from "@/lib/providers/cashi";
import { getDepositMarkupPercent, withMarkup } from "@/lib/app-config";

export const dynamic = "force-dynamic";

const Schema = z
  .object({
    amount: z.number().int().min(10_000).max(10_000_000),
    paymentMethod: z.string().trim().min(2).max(40).optional(),
  })
  .strict();

const rupiah = (amount: bigint) => amount.toString();

export async function GET() {
  const user = await getSessionUser();

  if (!user) {
    return apiError(
      "Silakan masuk terlebih dahulu.",
      401,
      "UNAUTHENTICATED"
    );
  }

  const items = await db.deposit.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      internalOrderId: true,
      providerOrderId: true,
      amount: true,
      currency: true,
      status: true,
      paymentMethod: true,
      checkoutUrl: true,
      qrUrl: true,
      expiresAt: true,
      paidAt: true,
      createdAt: true,
    },
  });

  return apiSuccess({
    items: items.map((item) => ({
      ...item,
      amount: rupiah(item.amount),
    })),
  });
}

export async function POST(request: Request) {
  const user = await getSessionUser();

  if (!user) {
    return apiError(
      "Silakan masuk terlebih dahulu.",
      401,
      "UNAUTHENTICATED"
    );
  }

  const key = request.headers.get("idempotency-key")?.trim();

  if (!key || key.length < 8 || key.length > 128) {
    return apiError(
      "Header Idempotency-Key wajib diisi (8–128 karakter).",
      400,
      "INVALID_IDEMPOTENCY_KEY"
    );
  }

  const parsed = Schema.safeParse(
    await request.json().catch(() => null)
  );

  if (!parsed.success) {
    return apiError(
      "Nominal deposit harus Rp10.000–Rp10.000.000.",
      400,
      "VALIDATION_ERROR"
    );
  }

  const prior = await db.deposit.findUnique({
    where: {
      userId_idempotencyKey: {
        userId: user.id,
        idempotencyKey: key,
      },
    },
  });

  if (prior) {
    if (
      prior.amount !== BigInt(parsed.data.amount) ||
      prior.paymentMethod !== (parsed.data.paymentMethod ?? null)
    ) {
      return apiError(
        "Idempotency-Key sudah digunakan untuk nominal/metode berbeda.",
        409,
        "IDEMPOTENCY_CONFLICT"
      );
    }

    return apiSuccess({
      deposit: {
        id: prior.id,
        reference: prior.internalOrderId,
        amount: rupiah(prior.amount),
        feeAmount: rupiah(prior.feeAmount),
        gatewayAmount: String(Number(prior.amount + prior.feeAmount)),
        status: prior.status,
        checkoutUrl: prior.checkoutUrl,
        qrUrl: prior.qrUrl,
        expiresAt: prior.expiresAt,
      },
    });
  }

  const requestedAmount = parsed.data.amount;
  let gatewayAmount: number;

  try {
    gatewayAmount = withMarkup(
      requestedAmount,
      getDepositMarkupPercent()
    );
  } catch {
    return apiError(
      "Konfigurasi markup deposit tidak valid.",
      500,
      "INVALID_DEPOSIT_MARKUP"
    );
  }

  const feeAmount = gatewayAmount - requestedAmount;
  const reference = `NXD-${randomUUID()
    .replaceAll("-", "")
    .slice(0, 20)
    .toUpperCase()}`;

  let deposit;

  try {
    deposit = await db.deposit.create({
      data: {
        userId: user.id,
        internalOrderId: reference,
        idempotencyKey: key,
        amount: BigInt(requestedAmount),
        feeAmount: BigInt(feeAmount),
        paymentMethod: parsed.data.paymentMethod ?? null,
        status: DepositStatus.PENDING,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const duplicate = await db.deposit.findUnique({
        where: {
          userId_idempotencyKey: {
            userId: user.id,
            idempotencyKey: key,
          },
        },
      });

      if (duplicate) {
        return apiSuccess({
          deposit: {
            id: duplicate.id,
            reference: duplicate.internalOrderId,
            amount: rupiah(duplicate.amount),
            feeAmount: rupiah(duplicate.feeAmount),
            gatewayAmount: String(
              Number(duplicate.amount + duplicate.feeAmount)
            ),
            status: duplicate.status,
            checkoutUrl: duplicate.checkoutUrl,
            qrUrl: duplicate.qrUrl,
            expiresAt: duplicate.expiresAt,
          },
        });
      }
    }

    console.error("deposit_record_failed", error);

    return apiError(
      "Deposit belum dapat dibuat.",
      503,
      "DEPOSIT_CREATE_FAILED"
    );
  }

  try {
    // Pastikan kontrak request dan response CASHI sesuai dokumentasi provider.
    const result = await cashi.createOrder({
      amount: gatewayAmount,
      order_id: reference,
    });

    const providerOrderId = result.order_id ?? reference;

    const updated = await db.deposit.update({
      where: { id: deposit.id },
      data: {
        providerOrderId,
        checkoutUrl: result.checkout_url,
        qrUrl: result.qrUrl,
        paymentMethod:
          result.payment_method ?? deposit.paymentMethod,
        expiresAt:
          result.expires_at &&
          Number.isFinite(Date.parse(result.expires_at))
            ? new Date(result.expires_at)
            : undefined,
        providerPayload: {
          status: result.status ?? "unknown",
          order_id: result.order_id ?? null,
        },
      },
    });

    return apiSuccess(
      {
        deposit: {
          id: updated.id,
          reference: updated.internalOrderId,
          amount: rupiah(updated.amount),
          feeAmount: rupiah(updated.feeAmount),
          gatewayAmount: String(gatewayAmount),
          status: updated.status,
          checkoutUrl: updated.checkoutUrl,
          qrUrl: updated.qrUrl,
          expiresAt: updated.expiresAt,
        },
      },
      201
    );
  } catch (error) {
    console.error("cashi_deposit_create_failed", {
      depositId: deposit.id,
      error,
    });

    // Jangan menyatakan pembayaran gagal jika respons gateway belum pasti.
    return NextResponse.json(
      {
        error: {
          code: "PAYMENT_CREATION_UNCERTAIN",
          message:
            "Permintaan deposit tercatat, tetapi respons payment gateway belum dapat dipastikan. Jangan membuat permintaan baru; periksa riwayat deposit atau hubungi admin.",
        },
        data: {
          depositId: deposit.id,
          reference: deposit.internalOrderId,
          status: "PENDING",
        },
      },
      { status: 202 }
    );
  }
}