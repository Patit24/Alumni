import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ authenticated: false, user: null }, { status: 200 });
    }

    return NextResponse.json({ authenticated: true, user });
  } catch (error) {
    console.error("auth/me error:", error);
    return NextResponse.json({ authenticated: false, error: "Internal error" }, { status: 500 });
  }
}
