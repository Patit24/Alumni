import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE } from "@/lib/auth";

export async function POST() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(AUTH_COOKIE.name);

    return NextResponse.json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    console.error("logout error:", error);
    return NextResponse.json({ error: "Failed to logout" }, { status: 500 });
  }
}
