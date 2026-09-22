import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/communities/permissions";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: communityId } = await params;

    const member = await db.communityMember.findUnique({
      where: {
        communityId_userId: {
          communityId,
          userId: user.id,
        },
      },
      include: {
        role: true,
      },
    });

    if (!member || member.status !== "ACTIVE") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const polls = await db.communityPoll.findMany({
      where: { communityId },
      include: {
        options: {
          include: {
            votes: {
              select: {
                userId: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Format with total vote count and user's voted options
    const enrichedPolls = polls.map((poll) => {
      const totalVotes = poll.options.reduce((acc, opt) => acc + opt.votes.length, 0);
      const userVotedOptionIds = poll.options
        .filter((opt) => opt.votes.some((v) => v.userId === user.id))
        .map((opt) => opt.id);

      return {
        ...poll,
        totalVotes,
        hasVoted: userVotedOptionIds.length > 0,
        userVotedOptionIds,
        options: poll.options.map((opt) => ({
          id: opt.id,
          text: opt.text,
          voteCount: opt.votes.length,
          votedByMe: opt.votes.some((v) => v.userId === user.id),
        })),
      };
    });

    return NextResponse.json({ polls: enrichedPolls });
  } catch (error: any) {
    console.error("Fetch polls error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch polls" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: communityId } = await params;
    const body = await req.json();

    const member = await db.communityMember.findUnique({
      where: {
        communityId_userId: {
          communityId,
          userId: user.id,
        },
      },
      include: {
        role: true,
      },
    });

    if (!member || member.status !== "ACTIVE") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Action 1: Vote in a poll
    if (body.action === "vote") {
      const { pollId, optionId } = body;
      if (!pollId || !optionId) {
        return NextResponse.json({ error: "Missing pollId or optionId" }, { status: 400 });
      }

      const poll = await db.communityPoll.findUnique({
        where: { id: pollId },
        include: { options: true },
      });

      if (!poll || poll.communityId !== communityId) {
        return NextResponse.json({ error: "Poll not found" }, { status: 404 });
      }

      if (poll.closesAt && new Date() > poll.closesAt) {
        return NextResponse.json({ error: "Poll is closed" }, { status: 400 });
      }

      // If single choice, remove previous votes from this poll
      if (!poll.isMultiple) {
        await db.communityPollVote.deleteMany({
          where: {
            pollId,
            userId: user.id,
          },
        });
      }

      // Upsert vote
      const vote = await db.communityPollVote.upsert({
        where: {
          pollId_optionId_userId: {
            pollId,
            optionId,
            userId: user.id,
          },
        },
        create: {
          pollId,
          optionId,
          userId: user.id,
        },
        update: {},
      });

      return NextResponse.json({ success: true, vote });
    }

    // Action 2: Create a poll
    const { question, options, isMultiple, isAnonymous, closesAt } = body;

    if (!question?.trim() || !Array.isArray(options) || options.length < 2) {
      return NextResponse.json({ error: "A question and at least 2 options are required" }, { status: 400 });
    }

    const community = await db.community.findUnique({
      where: { id: communityId },
    });

    if (!community) {
      return NextResponse.json({ error: "Community not found" }, { status: 404 });
    }

    if (!can(member, "CREATE_POLLS", community)) {
      return NextResponse.json({ error: "You lack permission to create polls" }, { status: 403 });
    }

    const poll = await db.communityPoll.create({
      data: {
        communityId,
        question: question.trim(),
        isMultiple: !!isMultiple,
        isAnonymous: !!isAnonymous,
        closesAt: closesAt ? new Date(closesAt) : null,
        options: {
          create: options
            .filter((opt: string) => opt && opt.trim())
            .map((opt: string) => ({
              text: opt.trim(),
            })),
        },
      },
      include: {
        options: true,
      },
    });

    return NextResponse.json({ poll }, { status: 201 });
  } catch (error: any) {
    console.error("Poll action error:", error);
    return NextResponse.json({ error: error.message || "Failed to process poll" }, { status: 500 });
  }
}
