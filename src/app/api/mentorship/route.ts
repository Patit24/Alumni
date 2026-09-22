import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

// GET /api/mentorship - List available mentors and current user's requests
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const topic = searchParams.get("topic") || "";
    const scope = searchParams.get("scope") || "institution"; // "institution" or "all"

    // Filter mentors who have isOpenToMentor: true
    const mentorWhere: Prisma.UserWhereInput = {
      isOpenToMentor: true,
      id: { not: user.id }, // don't list self in find mentor
    };

    if (scope === "institution") {
      mentorWhere.institutionId = user.institutionId;
    }

    if (topic && topic !== "ALL") {
      mentorWhere.mentorTopics = { contains: topic };
    }

    const mentors = await db.user.findMany({
      where: mentorWhere,
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        batchYear: true,
        currentRole: true,
        currentCompany: true,
        city: true,
        linkedinUrl: true,
        verificationStatus: true,
        isOpenToMentor: true,
        mentorTopics: true,
        mentorScope: true,
        institution: { select: { name: true } },
        department: { select: { name: true } },
      },
      orderBy: { batchYear: "asc" },
    });

    // Fetch mentorship requests sent by current user
    const sentRequests = await db.mentorshipRequest.findMany({
      where: { senderId: user.id },
      include: {
        mentor: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            currentRole: true,
            currentCompany: true,
            institution: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Fetch mentorship requests received by current user (if user is mentor)
    const receivedRequests = await db.mentorshipRequest.findMany({
      where: { mentorId: user.id },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            batchYear: true,
            currentRole: true,
            currentCompany: true,
            institution: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      currentUser: {
        id: user.id,
        name: user.name,
        verificationStatus: user.verificationStatus,
        isOpenToMentor: user.isOpenToMentor,
        mentorTopics: user.mentorTopics,
        mentorScope: user.mentorScope,
      },
      mentors,
      sentRequests,
      receivedRequests,
    });
  } catch (error) {
    console.error("Mentorship GET error:", error);
    return NextResponse.json({ error: "Failed to fetch mentorship data" }, { status: 500 });
  }
}

// POST /api/mentorship - Send request OR update mentor availability
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { action } = body;

    // Action A: Toggle own mentor availability
    if (action === "UPDATE_MENTOR_PROFILE") {
      const { isOpenToMentor, mentorTopics, mentorScope } = body;

      const updated = await db.user.update({
        where: { id: user.id },
        data: {
          isOpenToMentor: Boolean(isOpenToMentor),
          mentorTopics: mentorTopics || "",
          mentorScope: mentorScope || "INSTITUTION_ONLY",
        },
      });

      return NextResponse.json({
        success: true,
        message: "Your mentorship settings have been saved!",
        user: updated,
      });
    }

    // Action B: Send a mentorship request to a mentor
    if (action === "SEND_REQUEST") {
      const { mentorId, topic, message } = body;

      if (!mentorId || !topic || !message) {
        return NextResponse.json({ error: "Mentor, topic, and message are required" }, { status: 400 });
      }

      // Check if user is verified (anti-spam gate)
      if (user.verificationStatus !== "VERIFIED") {
        return NextResponse.json(
          { error: "Only verified members can send direct mentorship requests. Get verified first via Passive Verification!" },
          { status: 403 }
        );
      }

      const request = await db.mentorshipRequest.create({
        data: {
          senderId: user.id,
          mentorId,
          topic,
          message,
          status: "PENDING",
        },
      });

      return NextResponse.json({
        success: true,
        message: "Mentorship request sent successfully!",
        request,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Mentorship POST error:", error);
    return NextResponse.json({ error: "Failed to process mentorship action" }, { status: 500 });
  }
}

// PATCH /api/mentorship - Accept / Decline request
export async function PATCH(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { requestId, status } = await req.json();

    if (!requestId || !["ACCEPTED", "DECLINED", "COMPLETED"].includes(status)) {
      return NextResponse.json({ error: "Valid requestId and status required" }, { status: 400 });
    }

    const updated = await db.mentorshipRequest.update({
      where: { id: requestId },
      data: { status },
    });

    return NextResponse.json({
      success: true,
      message: `Mentorship request marked as ${status.toLowerCase()}`,
      request: updated,
    });
  } catch (error) {
    console.error("Mentorship PATCH error:", error);
    return NextResponse.json({ error: "Failed to update request" }, { status: 500 });
  }
}
