import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q") || "";

    const institutions = await db.institution.findMany({
      where: query.trim()
        ? {
            name: {
              contains: query.trim(),
            },
          }
        : undefined,
      include: {
        departments: {
          select: { id: true, name: true },
        },
        _count: {
          select: { users: true },
        },
      },
      take: 20,
      orderBy: {
        users: {
          _count: "desc",
        },
      },
    });

    return NextResponse.json({ institutions });
  } catch (error) {
    console.error("institutions GET error:", error);
    return NextResponse.json({ error: "Failed to fetch institutions" }, { status: 500 });
  }
}
