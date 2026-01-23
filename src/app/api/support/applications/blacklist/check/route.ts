import { NextResponse } from "next/server";
import { proxyUpstreamJSON } from "@/src/lib/supportApiProxy";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const email = (url.searchParams.get("email") || "").trim();
  const phone = (url.searchParams.get("phone") || "").trim();

  if (!email && !phone) {
    return NextResponse.json(
      { success: false, message: "email veya phone parametresi zorunludur." },
      { status: 400 }
    );
  }

  return proxyUpstreamJSON({
    path: "/support/applications/blacklist/check",
    method: "GET",
    query: url.searchParams,
  });
}

