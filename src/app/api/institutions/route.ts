import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const DEFAULT_INSTITUTIONS = [
  { id: "inst-kgec", name: "Kalyani Government Engineering College", type: "COLLEGE", city: "Kalyani", departments: [{ id: "d1", name: "MCA" }, { id: "d2", name: "Computer Science" }], _count: { users: 12 } },
  { id: "inst-bwu", name: "Brainware University", type: "COLLEGE", city: "Barasat", departments: [{ id: "d3", name: "MCA" }, { id: "d4", name: "B.Tech CSE" }], _count: { users: 8 } },
  { id: "inst-ju", name: "Jadavpur University", type: "COLLEGE", city: "Kolkata", departments: [{ id: "d5", name: "Computer Science" }], _count: { users: 15 } },
  { id: "inst-iitkgp", name: "IIT Kharagpur", type: "COLLEGE", city: "Kharagpur", departments: [{ id: "d6", name: "Computer Science" }], _count: { users: 20 } },
];

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q")?.toLowerCase().trim() || "";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let institutions: any[] = [];
    try {
      institutions = await db.institution.findMany({
        where: query
          ? {
              name: {
                contains: query,
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
    } catch (dbErr) {
      console.error("DB query error in institutions GET:", (dbErr as Error)?.stack || dbErr);
    }

    // If DB has none yet, provide curated default list
    if (institutions.length === 0) {
      institutions = DEFAULT_INSTITUTIONS.filter((inst) =>
        query ? inst.name.toLowerCase().includes(query) : true
      );
    }

    return NextResponse.json({ institutions });
  } catch (error) {
    console.error("institutions GET fatal error:", (error as Error)?.stack || error);
    return NextResponse.json({ institutions: DEFAULT_INSTITUTIONS });
  }
}
