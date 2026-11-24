import { NextResponse } from "next/server";
import { db } from "@ultra/db";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", checks: { database: "ok" }, timestamp: new Date().toISOString() }, { status: 200 });
  } catch {
    return NextResponse.json({ status: "degraded", checks: { database: "failed" }, timestamp: new Date().toISOString() }, { status: 503 });
  }
}
