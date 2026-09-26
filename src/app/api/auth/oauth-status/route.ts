import { NextResponse } from "next/server";
import { getOAuthResult } from "@/lib/oauth-store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const session = searchParams.get("session");

    if (!session) {
      return NextResponse.json({ ready: false, error: "Missing session ID" }, { status: 400 });
    }

    const result = getOAuthResult(session);

    if (result && result.ready) {
      return NextResponse.json(result, {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      });
    }

    return NextResponse.json({ ready: false }, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (err: any) {
    return NextResponse.json({ ready: false, error: err?.message }, { status: 500 });
  }
}
