import { NextResponse } from "next/server";
import { isApplicationType, proxyUpstreamJSON } from "@/src/lib/supportApiProxy";

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
  const email = body?.email;
  const phone = body?.phone;
  const name = body?.name;
  const reason = body?.reason;

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
  if (typeof email !== "string" || !email.trim()) {
    return NextResponse.json(
      { success: false, message: "Geçersiz email." },
      { status: 400 }
    );
  }
  if (typeof phone !== "string" || !phone.trim()) {
    return NextResponse.json(
      { success: false, message: "Geçersiz phone." },
      { status: 400 }
    );
  }
  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json(
      { success: false, message: "Geçersiz name." },
      { status: 400 }
    );
  }
  if (typeof reason !== "string" || !reason.trim()) {
    return NextResponse.json(
      { success: false, message: "Geçersiz reason." },
      { status: 400 }
    );
  }

  return proxyUpstreamJSON({
    path: "/support/applications/blacklist",
    method: "POST",
    body: {
      application_type,
      application_id: String(application_id),
      email,
      phone,
      name,
      reason,
    },
  });
}

