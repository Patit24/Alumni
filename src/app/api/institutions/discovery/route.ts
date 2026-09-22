import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const targetInstId = searchParams.get("institutionId") || currentUser.institutionId;

    if (!targetInstId) {
      return NextResponse.json({ error: "Institution ID is required" }, { status: 400 });
    }

    // 1. Fetch institution details
    const institution = await db.institution.findUnique({
      where: { id: targetInstId },
      select: {
        id: true,
        name: true,
        type: true,
        city: true,
        state: true,
        country: true,
        logoUrl: true,
      },
    });

    if (!institution) {
      return NextResponse.json({ error: "Institution not found" }, { status: 404 });
    }

    // 2. Fetch users who selected this institution (excluding current user)
    const rawUsers = await db.user.findMany({
      where: {
        institutionId: targetInstId,
        id: { not: currentUser.id },
      },
      select: {
        id: true,
        name: true,
        username: true,
        avatarUrl: true,
        course: true,
        batchYear: true,
        currentRole: true,
        currentCompany: true,
        city: true,
        department: { select: { name: true } },
        privacySettings: {
          select: {
            allowInstitutionDiscovery: true,
            showInstitution: true,
            showCourse: true,
            showGraduationYear: true,
          },
        },
      },
      take: 50,
      orderBy: { createdAt: "desc" },
    });

    // Filter out users who opted out of institution discovery
    const candidateUsers = rawUsers.filter(
      (u) => u.privacySettings?.allowInstitutionDiscovery !== false
    );
    const candidateIds = candidateUsers.map((u) => u.id);

    // 3. Compute mutual connections with current user
    const myTrusts = await db.contactTrust.findMany({
      where: {
        userId: currentUser.id,
        trustLevel: { in: ["CONNECTED", "TRUSTED"] },
      },
      select: { contactId: true },
    });
    const myConnectedIds = new Set(myTrusts.map((t) => t.contactId));

    // Candidate connections with anyone in myConnectedIds
    const candidateTrusts = candidateIds.length > 0
      ? await db.contactTrust.findMany({
          where: {
            userId: { in: candidateIds },
            contactId: { in: Array.from(myConnectedIds) },
            trustLevel: { in: ["CONNECTED", "TRUSTED"] },
          },
          select: { userId: true, contactId: true },
        })
      : [];

    const mutualCountMap: Record<string, number> = {};
    for (const ct of candidateTrusts) {
      mutualCountMap[ct.userId] = (mutualCountMap[ct.userId] || 0) + 1;
    }

    // 4. Fetch relationship status between currentUser and candidate users
    const existingRequests = candidateIds.length > 0
      ? await db.connectionRequest.findMany({
          where: {
            OR: [
              { senderId: currentUser.id, receiverId: { in: candidateIds } },
              { senderId: { in: candidateIds }, receiverId: currentUser.id },
            ],
          },
          select: { senderId: true, receiverId: true, status: true },
        })
      : [];

    const statusMap: Record<string, "NONE" | "PENDING_OUTGOING" | "PENDING_INCOMING" | "CONNECTED"> = {};
    for (const cid of candidateIds) {
      if (myConnectedIds.has(cid)) {
        statusMap[cid] = "CONNECTED";
        continue;
      }
      const reqFromMe = existingRequests.find((r) => r.senderId === currentUser.id && r.receiverId === cid);
      if (reqFromMe) {
        if (reqFromMe.status === "ACCEPTED") {
          statusMap[cid] = "CONNECTED";
          continue;
        } else if (reqFromMe.status === "PENDING") {
          statusMap[cid] = "PENDING_OUTGOING";
          continue;
        }
      }
      const reqToMe = existingRequests.find((r) => r.senderId === cid && r.receiverId === currentUser.id);
      if (reqToMe) {
        if (reqToMe.status === "ACCEPTED") {
          statusMap[cid] = "CONNECTED";
          continue;
        } else if (reqToMe.status === "PENDING") {
          statusMap[cid] = "PENDING_INCOMING";
          continue;
        }
      }
      statusMap[cid] = "NONE";
    }

    // 5. Structure final sanitized output respecting privacy
    const users = candidateUsers.map((u) => {
      const showCourse = u.privacySettings?.showCourse !== false;
      const showYear = u.privacySettings?.showGraduationYear !== false;

      return {
        id: u.id,
        name: u.name,
        username: u.username,
        avatarUrl: u.avatarUrl,
        course: showCourse ? (u.course || u.department?.name || null) : null,
        departmentName: showCourse ? (u.department?.name || null) : null,
        batchYear: showYear ? u.batchYear : null,
        currentRole: u.currentRole,
        currentCompany: u.currentCompany,
        city: u.city,
        mutualCount: mutualCountMap[u.id] || 0,
        relationshipStatus: statusMap[u.id] || "NONE",
      };
    });

    return NextResponse.json({
      success: true,
      institution,
      users,
      totalCount: users.length,
    });
  } catch (error: any) {
    console.error("GET /api/institutions/discovery error:", error);
    return NextResponse.json({ error: error.message || "Failed to load institution discovery" }, { status: 500 });
  }
}
