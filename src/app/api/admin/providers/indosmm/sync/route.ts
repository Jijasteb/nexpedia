import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";
import { apiError, apiSuccess } from "@/lib/http";
import { isSameOriginRequest } from "@/lib/app-config";
import { indosmm } from "@/lib/providers/indosmm";
import { getOrderMarkupPercent, withMarkup } from "@/lib/app-config";

export const dynamic = "force-dynamic";
function slugify(value: string) {
  const slug = value.normalize("NFKD").toLowerCase().replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70);
  return slug || "uncategorized";
}
function providerFlag(value: unknown) {
  if (typeof value === "boolean") return value;
  return ["1", "true", "yes", "supported"].includes(String(value ?? "").toLowerCase());
}
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return apiError("Origin tidak valid.", 403, "INVALID_ORIGIN");
  let admin: Awaited<ReturnType<typeof requireAdmin>>;
  try { admin = await requireAdmin(); }
  catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") return apiError("Silakan masuk terlebih dahulu.", 401, "UNAUTHENTICATED");
    return apiError("Akses admin diperlukan.", 403, "FORBIDDEN");
  }
  try {
    const remoteServices = await indosmm.getServices();
    const provider = await db.provider.upsert({
      where: { name: "IndoSMM" },
      create: { name: "IndoSMM", baseUrl: "https://indosmm.id/api/v2", isEnabled: false },
      update: { baseUrl: "https://indosmm.id/api/v2" },
    });
    let imported = 0;
    let updated = 0;
    let skipped = 0;
    for (const remote of remoteServices) {
      const serviceId = String(remote.service).trim();
      const name = remote.name.trim().slice(0, 180);
      const rate = Number(remote.rate);
      const minQuantity = Number(remote.min);
      const maxQuantity = Number(remote.max);
      if (!serviceId || !name || !Number.isFinite(rate) || rate <= 0 || !Number.isSafeInteger(minQuantity) || !Number.isSafeInteger(maxQuantity) || minQuantity < 1 || maxQuantity < minQuantity) { skipped++; continue; }
      const categoryName = (remote.category?.trim() || "Lainnya").slice(0, 100);
      const categorySlug = slugify(categoryName);
      const category = await db.category.upsert({
        where: { slug: categorySlug },
        create: { name: categoryName, slug: categorySlug, isActive: true },
        update: { name: categoryName },
      });
      const existing = await db.service.findUnique({ where: { providerId_providerServiceId: { providerId: provider.id, providerServiceId: serviceId } }, select: { id: true, baseRate: true, sellingRate: true } });
      await db.service.upsert({
        where: { providerId_providerServiceId: { providerId: provider.id, providerServiceId: serviceId } },
        create: {
          providerId: provider.id, providerServiceId: serviceId, categoryId: category.id,
          name, description: remote.type ? `Jenis layanan: ${remote.type}` : null,
          baseRate: new Prisma.Decimal(String(remote.rate)), sellingRate: new Prisma.Decimal(String(withMarkup(rate, getOrderMarkupPercent()))),
          minQuantity, maxQuantity, refillSupported: providerFlag(remote.refill), cancelSupported: providerFlag(remote.cancel),
          isActive: false, lastSyncedAt: new Date(),
        },
        update: {
          categoryId: category.id, name,
          description: remote.type ? `Jenis layanan: ${remote.type}` : null,
          baseRate: new Prisma.Decimal(String(remote.rate)), ...(existing && existing.sellingRate.equals(existing.baseRate) ? { sellingRate: new Prisma.Decimal(String(withMarkup(rate, getOrderMarkupPercent()))) } : {}), minQuantity, maxQuantity,
          refillSupported: providerFlag(remote.refill), cancelSupported: providerFlag(remote.cancel), lastSyncedAt: new Date(),
        },
      });
      if (existing) updated++; else imported++;
    }
    await db.auditLog.create({ data: { actorId: admin.id, action: "INDOSMM_CATALOG_SYNC", targetType: "Provider", targetId: provider.id, metadata: { imported, updated, skipped, total: remoteServices.length } } });
    return apiSuccess({ provider: provider.name, total: remoteServices.length, imported, updated, skipped, note: "Layanan baru tetap nonaktif. Tinjau harga jual dan aktifkan secara manual setelah validasi." });
  } catch (error) {
    console.error("indosmm_catalog_sync_failed", error);
    return NextResponse.json({ error: { code: "PROVIDER_SYNC_FAILED", message: "Sinkronisasi gagal. Periksa konfigurasi API key dan format respons provider." } }, { status: 502 });
  }
}
