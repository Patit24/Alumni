import { NextResponse } from "next/server";
import os from "os";

export const dynamic = "force-dynamic";

export async function GET() {
  let lanIp: string | null = null;
  const interfaces = os.networkInterfaces();

  for (const name of Object.keys(interfaces)) {
    const netList = interfaces[name];
    if (!netList) continue;
    for (const net of netList) {
      if (net.family === "IPv4" && !net.internal) {
        lanIp = net.address;
        break;
      }
    }
    if (lanIp) break;
  }

  const port = process.env.PORT || "3000";

  return NextResponse.json({
    lanIp,
    lanOrigin: lanIp ? `http://${lanIp}:${port}` : null,
  });
}
