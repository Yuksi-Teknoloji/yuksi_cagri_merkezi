import { NextResponse } from "next/server";
import {
  isApplicationType,
  isReviewStatus,
  parseCallDurationSeconds,
  proxyUpstreamJSON,
} from "@/src/lib/supportApiProxy";

export async function POST(req: Request) {
  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "Geçersiz JSON body." },
      { status: 400 }
    );
  }

  const application_type = body?.application_type;
  const application_id = body?.application_id;
  const status = body?.status;
  const review_notes = body?.review_notes;
  const call_duration = body?.call_duration;

  if (!isApplicationType(application_type)) {
    return NextResponse.json(
      { success: false, message: "Geçersiz başvuru tipi." },
      { status: 400 }
    );
  }
  if (
    (typeof application_id !== "string" || !application_id.trim()) &&
    typeof application_id !== "number"
  ) {
    return NextResponse.json(
      { success: false, message: "Geçersiz application_id." },
      { status: 400 }
    );
  }
  if (!isReviewStatus(status)) {
    return NextResponse.json(
      { success: false, message: "Geçersiz status." },
      { status: 400 }
    );
  }

  const callDurationSeconds = parseCallDurationSeconds(call_duration);
  if (callDurationSeconds === null) {
    return NextResponse.json(
      { success: false, message: "Geçersiz görüşme süresi formatı." },
      { status: 400 }
    );
  }

  // Upstream API application_id'yi string olarak bekliyor.
  const upstreamBody = {
    application_type,
    application_id: String(application_id),
    status,
    review_notes: typeof review_notes === "string" ? review_notes : String(review_notes ?? ""),
    call_duration: callDurationSeconds,
  };

  return proxyUpstreamJSON({
    path: "/support/applications/review",
    method: "POST",
    body: upstreamBody,
  });
}

