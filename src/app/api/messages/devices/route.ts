import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/messages/devices - Get device public keys for a peer or list active devices for current user
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const peerUserId = searchParams.get("userId");

    if (peerUserId) {
      // Check if blocked
      const isBlocked = await db.userBlock.findFirst({
        where: {
          OR: [
            { blockerId: user.id, blockedId: peerUserId },
            { blockerId: peerUserId, blockedId: user.id },
          ],
        },
      });

      if (isBlocked) {
        return NextResponse.json({ error: "Cannot communicate with this user" }, { status: 403 });
      }

      // Fetch peer devices and public keys
      let peerDevices = await db.userDevice.findMany({
        where: { userId: peerUserId },
        select: {
          id: true,
          deviceId: true,
          deviceName: true,
          publicKey: true,
          lastActiveAt: true,
        },
        orderBy: { lastActiveAt: "desc" },
      });

      return NextResponse.json({ devices: peerDevices });
    }

    // List current user's active devices
    const myDevices = await db.userDevice.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        deviceId: true,
        deviceName: true,
        lastActiveAt: true,
        createdAt: true,
      },
      orderBy: { lastActiveAt: "desc" },
    });

    return NextResponse.json({ devices: myDevices });
  } catch (error) {
    console.error("Error in /api/messages/devices GET:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// POST /api/messages/devices - Register or update a device's public key
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { deviceId, deviceName, publicKey } = await req.json();

    if (!deviceId || !publicKey) {
      return NextResponse.json({ error: "deviceId and publicKey are required" }, { status: 400 });
    }

    const device = await db.userDevice.upsert({
      where: { deviceId },
      update: {
        publicKey,
        deviceName: deviceName || "Unknown Device",
        lastActiveAt: new Date(),
      },
      create: {
        userId: user.id,
        deviceId,
        deviceName: deviceName || "Unknown Device",
        publicKey,
        lastActiveAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, deviceId: device.deviceId });
  } catch (error) {
    console.error("Error in /api/messages/devices POST:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// DELETE /api/messages/devices - Revoke an active device
export async function DELETE(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const deviceId = searchParams.get("deviceId");

    if (!deviceId) {
      return NextResponse.json({ error: "deviceId is required" }, { status: 400 });
    }

    await db.userDevice.deleteMany({
      where: {
        userId: user.id,
        deviceId,
      },
    });

    return NextResponse.json({ success: true, revokedDeviceId: deviceId });
  } catch (error) {
    console.error("Error in /api/messages/devices DELETE:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
