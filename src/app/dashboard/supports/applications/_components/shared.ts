export type ApplicationType = "dealer_form" | "corporate_form" | "carrier_application";
export type ReviewStatus = "pending" | "approved" | "rejected";

export function fmtDateTR(iso?: string | null) {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" });
  } catch {
    return iso;
  }
}

export function pickMsg(d: any, fb: string) {
  return d?.error?.message || d?.message || d?.detail || d?.title || fb;
}

export async function readJson<T = any>(res: Response): Promise<T> {
  const txt = await res.text().catch(() => "");
  try {
    return (txt ? JSON.parse(txt) : ({} as any)) as T;
  } catch {
    return txt as any;
  }
}

export function statusBadge(status?: string | null) {
  const s = String(status || "").toLowerCase();
  if (s === "approved")
    return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100";
  if (s === "rejected")
    return "bg-rose-50 text-rose-700 ring-1 ring-rose-100";
  return "bg-amber-50 text-amber-800 ring-1 ring-amber-100";
}

const vehicleTypeMap: Record<string, string> = {
  motorcycle: "Motosiklet",
  minivan: "Minivan",
  panelvan: "Panelvan",
  pickup: "Kamyonet",
  truck: "Kamyon",
};

export function translateVehicleType(type?: string | null): string {
  if (!type) return "-";
  const key = type.toLowerCase().trim();
  return vehicleTypeMap[key] || type;
}

