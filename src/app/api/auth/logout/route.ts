import { deleteCurrentSession } from "@/lib/auth/session";
import { apiSuccess } from "@/lib/http";
export async function POST() { await deleteCurrentSession(); return apiSuccess({ message: "Berhasil keluar" }); }
