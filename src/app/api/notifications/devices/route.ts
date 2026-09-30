import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// POST /api/notifications/devices - Register or update a device with push capability
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { deviceId, deviceName, publicKey } = body;

    if (!deviceId) {
      return NextResponse.json({ error: "deviceId is required" }, { status: 400 });
    }

    const device = await db.userDevice.upsert({
      where: { deviceId },
      update: {
        userId: user.id,
        deviceName: deviceName || "Samparka Device",
        ...(publicKey ? { publicKey } : {}),
        lastActiveAt: new Date(),
      },
      create: {
        userId: user.id,
        deviceId,
        deviceName: deviceName || "Samparka Device",
        publicKey: publicKey || "NONE",
      },
    });

    return NextResponse.json({
      success: true,
      device: {
        id: device.id,
        deviceId: device.deviceId,
        deviceName: device.deviceName,
        lastActiveAt: device.lastActiveAt,
      },
    });
  } catch (error) {
    console.error("Device registration error:", error);
    return NextResponse.json({ error: "Failed to register device" }, { status: 500 });
  }
}

// DELETE /api/notifications/devices - Unregister device on logout
export async function DELETE(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const deviceId = searchParams.get("deviceId");

    if (!deviceId) {
      return NextResponse.json({ error: "deviceId query param is required" }, { status: 400 });
    }

    await db.userDevice.deleteMany({
      where: {
        deviceId,
        userId: user.id,
      },
    });

    return NextResponse.json({ success: true, message: "Device unregistered successfully" });
  } catch (error) {
    console.error("Device unregister error:", error);
    return NextResponse.json({ error: "Failed to unregister device" }, { status: 500 });
  }
}
