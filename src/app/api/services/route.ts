import { db } from "@/lib/db";
import { apiSuccess } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const search = url.searchParams.get("q")?.trim().slice(0, 80);
  const category = url.searchParams.get("category")?.trim().slice(0, 80);
  const page = Math.max(1, Math.min(1000, Number(url.searchParams.get("page") ?? 1) || 1));
  const pageSize = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") ?? 30) || 30));
  const where = {
    isActive: true,
    provider: { isEnabled: true },
    ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
    ...(category ? { category: { slug: category, isActive: true } } : {}),
  };
  const [services, total] = await db.$transaction([
    db.service.findMany({
      where,
      select: { id: true, name: true, description: true, sellingRate: true, minQuantity: true, maxQuantity: true, refillSupported: true, cancelSupported: true, category: { select: { name: true, slug: true } } },
      orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.service.count({ where }),
  ]);
  return apiSuccess({
    items: services.map((service) => ({ ...service, sellingRate: service.sellingRate.toString() })),
    pagination: { page, limit: pageSize, total, pages: Math.ceil(total / pageSize) },
  });
}
