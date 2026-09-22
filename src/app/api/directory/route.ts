import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const currentUser = await getCurrentUser();
    const { searchParams } = new URL(req.url);

    const q = searchParams.get("q")?.trim() || "";
    const institutionScope = searchParams.get("institutionScope") || "my";
    const batchScope = searchParams.get("batchScope") || "my";
    const city = searchParams.get("city")?.trim() || "";
    const department = searchParams.get("department")?.trim() || "";

    const id = searchParams.get("id")?.trim() || "";
    const usernameParam = searchParams.get("username")?.trim() || "";

    // Build Prisma where filter
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (id) {
      where.id = id;
    } else if (usernameParam) {
      const cleanUsername = usernameParam.startsWith("@") ? usernameParam.slice(1).trim() : usernameParam.trim();
      where.OR = [
        { username: { equals: cleanUsername } },
        { username: { contains: cleanUsername } },
        { name: { contains: cleanUsername } },
      ];
    } else {
      // Only filter by batch/institution if NOT searching by query and NOT requesting "all"
      if (!q) {
        // 1. Institution filter
        if (institutionScope === "my" && currentUser?.institutionId) {
          where.institutionId = currentUser.institutionId;
        }

        // 2. Batch year filter
        if (batchScope === "my" && currentUser?.batchYear) {
          where.batchYear = currentUser.batchYear;
        } else if (batchScope !== "all" && batchScope !== "my" && !isNaN(parseInt(batchScope, 10))) {
          where.batchYear = parseInt(batchScope, 10);
        }
      }

      // 3. City filter
      if (city && city !== "all") {
        where.city = city;
      }

      // 4. Department filter
      if (department && department !== "all") {
        where.department = {
          name: department,
        };
      }

      // 5. Search query (searches across all alumni globally)
      if (q) {
        const cleanQ = q.startsWith("@") ? q.slice(1).trim() : q.trim();
        where.OR = [
          { name: { contains: q } },
          { username: { contains: cleanQ } },
          { currentCompany: { contains: q } },
          { currentRole: { contains: q } },
          { city: { contains: q } },
          { phone: { contains: cleanQ } },
        ];
      }
    }

    const alumni = await db.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        username: true,
        phone: true,
        email: true,
        avatarUrl: true,
        role: true,
        verificationStatus: true,
        batchYear: true,
        currentCompany: true,
        currentRole: true,
        city: true,
        linkedinUrl: true,
        isOpenToMentor: true,
        mentorTopics: true,
        isPhoneVisible: true,
        institution: {
          select: { id: true, name: true, city: true },
        },
        batch: {
          select: { id: true, year: true },
        },
        department: {
          select: { id: true, name: true },
        },
      },
      orderBy: [
        { verificationStatus: "desc" }, // VERIFIED first
        { name: "asc" },
      ],
    });

    // Fetch available filter options
    const allUsers = await db.user.findMany({
      select: {
        batchYear: true,
        city: true,
        department: { select: { name: true } },
      },
    });

    const availableBatches = Array.from(new Set(allUsers.map((u) => u.batchYear))).sort(
      (a, b) => b - a
    );
    const availableCities = Array.from(
      new Set(allUsers.map((u) => u.city).filter((c): c is string => Boolean(c)))
    ).sort();
    const availableDepartments = Array.from(
      new Set(allUsers.map((u) => u.department?.name).filter((d): d is string => Boolean(d)))
    ).sort();

    return NextResponse.json({
      currentUser: currentUser
        ? {
            id: currentUser.id,
            name: currentUser.name,
            username: (currentUser as any).username || null,
            institutionId: currentUser.institutionId,
            institutionName: currentUser.institution?.name,
            batchYear: currentUser.batchYear,
          }
        : null,
      alumni,
      totalCount: alumni.length,
      availableBatches,
      availableCities,
      availableDepartments,
    });
  } catch (error) {
    console.error("Directory GET error:", (error as Error)?.stack || error);
    return NextResponse.json({ error: "Failed to load directory" }, { status: 500 });
  }
}
