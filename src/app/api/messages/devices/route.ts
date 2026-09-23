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

      // If peer has not logged in on a device yet, auto-provision an initial P-256 keypair
      // so the sender can immediately encrypt and send messages while peer is offline
      if (peerDevices.length === 0) {
        try {
          const { webcrypto } = await import("node:crypto");
          const keyPair = await webcrypto.subtle.generateKey(
            { name: "ECDH", namedCurve: "P-256" },
            true,
            ["deriveKey", "deriveBits"]
          );
          const spkiBuf = await webcrypto.subtle.exportKey("spki", keyPair.publicKey);
          const pkcs8Buf = await webcrypto.subtle.exportKey("pkcs8", keyPair.privateKey);
          const publicKey = Buffer.from(spkiBuf).toString("base64");
          const initialPrivate = Buffer.from(pkcs8Buf).toString("base64");

          const autoDevice = await db.userDevice.create({
            data: {
              userId: peerUserId,
              deviceId: `primary_${peerUserId}`,
              deviceName: JSON.stringify({ name: "Primary Mobile Device", initialKey: initialPrivate }),
              publicKey,
              lastActiveAt: new Date(),
            },
            select: {
              id: true,
              deviceId: true,
              deviceName: true,
              publicKey: true,
              lastActiveAt: true,
            },
          });

          peerDevices = [
            {
              id: autoDevice.id,
              deviceId: autoDevice.deviceId,
              deviceName: "Primary Mobile Device",
              publicKey: autoDevice.publicKey,
              lastActiveAt: autoDevice.lastActiveAt,
            },
          ];
        } catch (e) {
          console.error("Auto-provision device key error:", e);
        }
      }

      return NextResponse.json({ devices: peerDevices });
    }

    // List current user's active devices
    let myDevices = await db.userDevice.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        deviceId: true,
        deviceName: true,
        publicKey: true,
        lastActiveAt: true,
        createdAt: true,
      },
      orderBy: { lastActiveAt: "desc" },
    });

    if (myDevices.length === 0) {
      try {
        const { webcrypto } = await import("node:crypto");
        const keyPair = await webcrypto.subtle.generateKey(
          { name: "ECDH", namedCurve: "P-256" },
          true,
          ["deriveKey", "deriveBits"]
        );
        const spkiBuf = await webcrypto.subtle.exportKey("spki", keyPair.publicKey);
        const pkcs8Buf = await webcrypto.subtle.exportKey("pkcs8", keyPair.privateKey);
        const publicKey = Buffer.from(spkiBuf).toString("base64");
        const initialPrivate = Buffer.from(pkcs8Buf).toString("base64");

        const autoDevice = await db.userDevice.create({
          data: {
            userId: user.id,
            deviceId: `primary_${user.id}`,
            deviceName: JSON.stringify({ name: "Primary Mobile Device", initialKey: initialPrivate }),
            publicKey,
            lastActiveAt: new Date(),
          },
          select: {
            id: true,
            deviceId: true,
            deviceName: true,
            publicKey: true,
            lastActiveAt: true,
            createdAt: true,
          },
        });
        myDevices = [autoDevice];
      } catch (e) {
        console.error("Auto-provision own device key error:", e);
      }
    }

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
