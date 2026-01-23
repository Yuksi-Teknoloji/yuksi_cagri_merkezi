import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { API_BASE } from "@/src/configs/api";

export type ApplicationType = "dealer_form" | "corporate_form" | "carrier_application";
export type ReviewStatus = "pending" | "approved" | "rejected";

export function isApplicationType(v: unknown): v is ApplicationType {
  return v === "dealer_form" || v === "corporate_form" || v === "carrier_application";
}

export function isReviewStatus(v: unknown): v is ReviewStatus {
  return v === "pending" || v === "approved" || v === "rejected";
}

export async function requireAuthBearer(): Promise<string | null> {
  const store = await cookies();
  const token = store.get("auth_token")?.value || "";
  return token ? `Bearer ${token}` : null;
}

export function parseCallDurationSeconds(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v) && v >= 0) return Math.floor(v);
  if (typeof v !== "string") return null;

  const s = v.trim();
  if (!s) return null;

  // "m:ss" or "mm:ss"
  const m = s.match(/^(\d{1,4})\s*:\s*([0-5]?\d)$/);
  if (!m) return null;
  const minutes = Number(m[1]);
  const seconds = Number(m[2]);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;
  return minutes * 60 + seconds;
}

export function normalizePaging(params: URLSearchParams) {
  const limitRaw = params.get("limit");
  const offsetRaw = params.get("offset");

  const limit = limitRaw ? Number(limitRaw) : 50;
  const offset = offsetRaw ? Number(offsetRaw) : 0;

  const safeLimit = Number.isFinite(limit) ? Math.min(200, Math.max(1, Math.floor(limit))) : 50;
  const safeOffset = Number.isFinite(offset) ? Math.max(0, Math.floor(offset)) : 0;

  if (String(safeLimit) !== String(limitRaw ?? 50)) params.set("limit", String(safeLimit));
  if (String(safeOffset) !== String(offsetRaw ?? 0)) params.set("offset", String(safeOffset));
}

export async function proxyUpstreamJSON(opts: {
  path: string; // e.g. "/api/support/applications/dealer-forms"
  method: "GET" | "POST" | "PATCH" | "DELETE";
  query?: URLSearchParams;
  body?: any;
}) {
  const bearer = await requireAuthBearer();
  if (!bearer) {
    return NextResponse.json(
      { success: false, message: "Unauthorized: auth_token cookie missing." },
      { status: 401 }
    );
  }

  const url = new URL(`${API_BASE}${opts.path}`);
  if (opts.query) url.search = opts.query.toString();

  const headers: HeadersInit = {
    Accept: "application/json",
    Authorization: bearer,
  };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";

  const upstream = await fetch(url.toString(), {
    method: opts.method,
    headers,
    cache: "no-store",
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });

  const text = await upstream.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  return NextResponse.json(data, { status: upstream.status });
}

