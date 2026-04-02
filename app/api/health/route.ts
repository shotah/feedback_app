import { connectDb } from "@/lib/db";
import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const checkMongo =
    url.searchParams.get("mongo") === "1" || url.searchParams.get("mongo") === "true";

  if (!checkMongo) {
    return NextResponse.json({ ok: true, mongo: "skipped" as const });
  }

  if (!process.env.MONGODB_URI?.trim()) {
    return NextResponse.json(
      { ok: false, mongo: "error" as const, missing: ["MONGODB_URI"] },
      { status: 503 },
    );
  }

  try {
    await Promise.race([
      connectDb(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 2500)),
    ]);
    const ok = mongoose.connection.readyState === 1;
    return NextResponse.json(
      {
        ok,
        mongo: ok ? ("ok" as const) : ("error" as const),
      },
      { status: ok ? 200 : 503 },
    );
  } catch {
    return NextResponse.json({ ok: false, mongo: "error" as const }, { status: 503 });
  }
}
