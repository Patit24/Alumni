import { NextResponse } from "next/server";
import { runRetentionCleanup } from "@/lib/lifecycle/retention-worker";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      const { searchParams } = new URL(req.url);
      const token = searchParams.get("token");
      if (token !== cronSecret) {
        return NextResponse.json({ error: "Unauthorized cron call" }, { status: 401 });
      }
    }

    const report = await runRetentionCleanup();

    return NextResponse.json({
      success: true,
      message: "48-Hour ephemeral retention cleanup completed",
      report,
    });
  } catch (error) {
    console.error("Cron retention cleanup error:", error);
    return NextResponse.json({ error: "Retention cleanup failed" }, { status: 500 });
  }
}
