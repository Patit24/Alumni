import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { uploadFileToStorage } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const category = (formData.get("category") as "avatars" | "feed" | "chats" | "groups") || "feed";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await uploadFileToStorage(
      buffer,
      file.type || "application/octet-stream",
      category,
      file.name
    );

    return NextResponse.json({
      success: true,
      url: result.url,
      key: result.key,
      size: result.size,
      contentType: result.contentType,
    });
  } catch (error: any) {
    console.error("Storage upload error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to upload file" },
      { status: 500 }
    );
  }
}
