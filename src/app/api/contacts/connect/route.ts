import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendRealtimeBroadcast } from "@/lib/realtime-broadcast";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { targetUserId, action } = body as {
      targetUserId?: string;
      action?: "REQUEST" | "ACCEPT" | "REJECT" | "CANCEL" | "BLOCK";
    };

    if (!targetUserId || typeof targetUserId !== "string") {
      return NextResponse.json({ error: "targetUserId is required" }, { status: 400 });
    }

    if (targetUserId === user.id) {
      return NextResponse.json({ error: "Cannot connect with yourself" }, { status: 400 });
    }

    const targetUser = await db.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, name: true, username: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if blocked
    const isBlocked = await db.userBlock.findFirst({
      where: {
        OR: [
          { blockerId: user.id, blockedId: targetUserId },
          { blockerId: targetUserId, blockedId: user.id },
        ],
      },
    });

    if (isBlocked && action !== "BLOCK") {
      return NextResponse.json({ error: "Unable to interact with this user" }, { status: 403 });
    }

    // 1. ACTION: REQUEST (Send connection request or auto-accept if mutual)
    if (action === "REQUEST") {
      // Check if targetUser already sent currentUser a pending request -> auto-accept
      const reversePending = await db.connectionRequest.findFirst({
        where: {
          senderId: targetUserId,
          receiverId: user.id,
          status: "PENDING",
        },
      });

      if (reversePending) {
        // Mutual intention -> immediately establish connection
        await db.$transaction([
          db.connectionRequest.update({
            where: { id: reversePending.id },
            data: { status: "ACCEPTED" },
          }),
          db.contactTrust.upsert({
            where: { userId_contactId: { userId: user.id, contactId: targetUserId } },
            update: { trustLevel: "CONNECTED" },
            create: { userId: user.id, contactId: targetUserId, trustLevel: "CONNECTED" },
          }),
          db.contactTrust.upsert({
            where: { userId_contactId: { userId: targetUserId, contactId: user.id } },
            update: { trustLevel: "CONNECTED" },
            create: { userId: targetUserId, contactId: user.id, trustLevel: "CONNECTED" },
          }),
          db.appNotification.create({
            data: {
              userId: targetUserId,
              actorId: user.id,
              type: "CONNECTION_ACCEPTED",
              title: "Connection Accepted",
              body: `${user.name} accepted your connection request.`,
              data: JSON.stringify({ peerId: user.id, peerName: user.name, peerUsername: user.username }),
            },
          }),
          db.appNotification.updateMany({
            where: {
              userId: user.id,
              actorId: targetUserId,
              type: "CONNECTION_REQUEST",
              isRead: false,
            },
            data: { isRead: true },
          }),
        ]);

        sendRealtimeBroadcast(`p2p-signal:${targetUserId}`, "connection-accepted", {
          peerId: user.id,
          peerName: user.name,
          peerUsername: user.username,
        }).catch((e) => console.warn("Broadcast connection-accepted notice:", e));

        return NextResponse.json({
          success: true,
          status: "CONNECTED",
          message: `Connected with ${targetUser.name}`,
        });
      }

      // Check if already connected
      const existingAccepted = await db.connectionRequest.findFirst({
        where: {
          OR: [
            { senderId: user.id, receiverId: targetUserId, status: "ACCEPTED" },
            { senderId: targetUserId, receiverId: user.id, status: "ACCEPTED" },
          ],
        },
      });

      if (existingAccepted) {
        // Ensure bidirectional contactTrust is present
        await Promise.all([
          db.contactTrust.upsert({
            where: { userId_contactId: { userId: user.id, contactId: targetUserId } },
            update: { trustLevel: "CONNECTED" },
            create: { userId: user.id, contactId: targetUserId, trustLevel: "CONNECTED" },
          }),
          db.contactTrust.upsert({
            where: { userId_contactId: { userId: targetUserId, contactId: user.id } },
            update: { trustLevel: "CONNECTED" },
            create: { userId: targetUserId, contactId: user.id, trustLevel: "CONNECTED" },
          }),
        ]);

        return NextResponse.json({
          success: true,
          status: "CONNECTED",
          message: `Already connected with ${targetUser.name}`,
        });
      }

      // Create or update connection request to PENDING
      const request = await db.connectionRequest.upsert({
        where: {
          senderId_receiverId: {
            senderId: user.id,
            receiverId: targetUserId,
          },
        },
        update: {
          status: "PENDING",
        },
        create: {
          senderId: user.id,
          receiverId: targetUserId,
          status: "PENDING",
        },
      });

      // Send notification to recipient
      await db.appNotification.create({
        data: {
          userId: targetUserId,
          actorId: user.id,
          type: "CONNECTION_REQUEST",
          title: "Connection Request",
          body: `${user.name} sent you a connection request.`,
          data: JSON.stringify({
            peerId: user.id,
            peerName: user.name,
            peerUsername: user.username,
            peerAvatarUrl: user.avatarUrl,
          }),
        },
      });

      // Broadcast Realtime event to recipient
      sendRealtimeBroadcast(`p2p-signal:${targetUserId}`, "connection-request-received", {
        peerId: user.id,
        peerName: user.name,
        peerUsername: user.username,
      }).catch((e) => console.warn("Broadcast connection-request notice:", e));

      return NextResponse.json({
        success: true,
        status: "PENDING",
        message: `Connection request sent to ${targetUser.name}`,
        request,
      });
    }

    // 2. ACTION: ACCEPT (User accepts an incoming connection request)
    if (action === "ACCEPT") {
      const pendingReq = await db.connectionRequest.findFirst({
        where: {
          OR: [
            { senderId: targetUserId, receiverId: user.id, status: "PENDING" },
            { senderId: user.id, receiverId: targetUserId, status: "PENDING" },
          ],
        },
      });

      if (!pendingReq) {
        // Also check if already accepted
        const existing = await db.connectionRequest.findFirst({
          where: {
            OR: [
              { senderId: targetUserId, receiverId: user.id, status: "ACCEPTED" },
              { senderId: user.id, receiverId: targetUserId, status: "ACCEPTED" },
            ],
          },
        });

        if (existing) {
          await Promise.all([
            db.contactTrust.upsert({
              where: { userId_contactId: { userId: user.id, contactId: targetUserId } },
              update: { trustLevel: "CONNECTED" },
              create: { userId: user.id, contactId: targetUserId, trustLevel: "CONNECTED" },
            }),
            db.contactTrust.upsert({
              where: { userId_contactId: { userId: targetUserId, contactId: user.id } },
              update: { trustLevel: "CONNECTED" },
              create: { userId: targetUserId, contactId: user.id, trustLevel: "CONNECTED" },
            }),
          ]);
          return NextResponse.json({ success: true, status: "CONNECTED", message: "Already connected" });
        }

        return NextResponse.json({ error: "No pending connection request found to accept" }, { status: 404 });
      }

      // Atomically update relationship state
      await db.$transaction([
        db.connectionRequest.update({
          where: { id: pendingReq.id },
          data: { status: "ACCEPTED" },
        }),
        db.contactTrust.upsert({
          where: { userId_contactId: { userId: user.id, contactId: targetUserId } },
          update: { trustLevel: "CONNECTED" },
          create: { userId: user.id, contactId: targetUserId, trustLevel: "CONNECTED" },
        }),
        db.contactTrust.upsert({
          where: { userId_contactId: { userId: targetUserId, contactId: user.id } },
          update: { trustLevel: "CONNECTED" },
          create: { userId: targetUserId, contactId: user.id, trustLevel: "CONNECTED" },
        }),
        // Notify original sender
        db.appNotification.create({
          data: {
            userId: targetUserId,
            actorId: user.id,
            type: "CONNECTION_ACCEPTED",
            title: "Connection Accepted",
            body: `${user.name} accepted your connection request.`,
            data: JSON.stringify({ peerId: user.id, peerName: user.name, peerUsername: user.username }),
          },
        }),
        // Mark pending notification as read
        db.appNotification.updateMany({
          where: {
            userId: user.id,
            actorId: targetUserId,
            type: "CONNECTION_REQUEST",
            isRead: false,
          },
          data: { isRead: true },
        }),
      ]);

      // Broadcast Realtime to original sender
      sendRealtimeBroadcast(`p2p-signal:${targetUserId}`, "connection-accepted", {
        peerId: user.id,
        peerName: user.name,
        peerUsername: user.username,
      }).catch((e) => console.warn("Broadcast connection-accepted notice:", e));

      return NextResponse.json({
        success: true,
        status: "CONNECTED",
        message: `Connected with ${targetUser.name}`,
      });
    }

    // 3. ACTION: REJECT / IGNORE
    if (action === "REJECT") {
      await db.connectionRequest.updateMany({
        where: {
          senderId: targetUserId,
          receiverId: user.id,
          status: "PENDING",
        },
        data: { status: "REJECTED" },
      });

      await db.appNotification.updateMany({
        where: {
          userId: user.id,
          actorId: targetUserId,
          type: "CONNECTION_REQUEST",
          isRead: false,
        },
        data: { isRead: true },
      });

      return NextResponse.json({ success: true, status: "REJECTED" });
    }

    // 4. ACTION: CANCEL (User cancels outgoing request)
    if (action === "CANCEL") {
      await db.connectionRequest.updateMany({
        where: {
          senderId: user.id,
          receiverId: targetUserId,
          status: "PENDING",
        },
        data: { status: "CANCELLED" },
      });

      return NextResponse.json({ success: true, status: "CANCELLED" });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Connection API error:", error);
    return NextResponse.json({ error: "Failed to process connection request" }, { status: 500 });
  }
}
