import { NextResponse } from "next/server";
export function apiError(message: string, status = 400, code = "BAD_REQUEST") {
  return NextResponse.json({ error: { code, message } }, { status });
}
export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}
