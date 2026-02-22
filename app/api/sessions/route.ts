import { NextResponse } from "next/server";

const GATEWAY_URL = "http://127.0.0.1:18789";
const GATEWAY_TOKEN = "4dcb0b18fdbaa35b67011ac30970ebb1cfc39e7aec5514c3";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const res = await fetch(`${GATEWAY_URL}/tools/invoke`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GATEWAY_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tool: "sessions_list",
        action: "json",
        args: {},
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Gateway error", status: res.status }, { status: 502 });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
