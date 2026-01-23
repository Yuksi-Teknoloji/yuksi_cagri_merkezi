import { NextResponse } from "next/server";
import { isApplicationType, proxyUpstreamJSON } from "@/src/lib/supportApiProxy";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ application_type: string; application_id: string }> }
) {
  const { application_type, application_id } = await ctx.params;

  if (!isApplicationType(application_type)) {
    return NextResponse.json(
      { success: false, message: "Geçersiz başvuru tipi." },
      { status: 400 }
    );
  }

  return proxyUpstreamJSON({
    path: `/support/applications/${encodeURIComponent(application_type)}/${encodeURIComponent(
      application_id
    )}`,
    method: "GET",
    query: new URL(req.url).searchParams,
  });
}

