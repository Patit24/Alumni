import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

// GET /api/jobs - List jobs and referrals
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const roleType = searchParams.get("roleType") || "ALL";
    const scope = searchParams.get("scope") || "institution";
    const query = (searchParams.get("q") || "").toLowerCase();

    const where: Prisma.JobWhereInput = {};

    if (scope === "institution") {
      where.institutionId = user.institutionId;
    }

    if (roleType !== "ALL") {
      where.roleType = roleType;
    }

    const jobs = await db.job.findMany({
      where,
      include: {
        poster: {
          select: {
            id: true,
            name: true,
            currentRole: true,
            currentCompany: true,
            batchYear: true,
            verificationStatus: true,
            linkedinUrl: true,
          },
        },
        institution: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const filtered = query
      ? jobs.filter(
          (j) =>
            j.title.toLowerCase().includes(query) ||
            j.company.toLowerCase().includes(query) ||
            j.location.toLowerCase().includes(query) ||
            j.poster.name.toLowerCase().includes(query)
        )
      : jobs;

    return NextResponse.json({
      currentUser: {
        id: user.id,
        name: user.name,
        verificationStatus: user.verificationStatus,
      },
      jobs: filtered,
    });
  } catch (error) {
    console.error("Jobs GET error:", error);
    return NextResponse.json({ error: "Failed to fetch jobs" }, { status: 500 });
  }
}

// POST /api/jobs - Post a new job or referral
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Gating check: Must be verified
    if (user.verificationStatus !== "VERIFIED") {
      return NextResponse.json(
        { error: "Only verified members can post jobs or referrals. Please verify your account first." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { title, company, location, roleType, description, applyUrl, visibility } = body;

    if (!title || !company || !location || !description) {
      return NextResponse.json(
        { error: "Title, company, location, and description are required." },
        { status: 400 }
      );
    }

    const newJob = await db.job.create({
      data: {
        posterId: user.id,
        institutionId: user.institutionId,
        title,
        company,
        location,
        roleType: roleType || "FULL_TIME",
        description,
        applyUrl: applyUrl || null,
        visibility: visibility || "ALL",
      },
    });

    return NextResponse.json({
      success: true,
      message: "Job / Referral opportunity posted successfully!",
      job: newJob,
    });
  } catch (error) {
    console.error("Jobs POST error:", error);
    return NextResponse.json({ error: "Failed to post job" }, { status: 500 });
  }
}
