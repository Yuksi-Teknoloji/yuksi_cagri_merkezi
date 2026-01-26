export type ApplicationType = "dealer_form" | "corporate_form" | "carrier_application";
export type ReviewStatus = "pending" | "approved" | "rejected";

export function fmtDateTR(iso?: string | null): string {
  if (!iso) return "-";
  try {
    // Eğer timezone bilgisi yoksa (Z veya +/- yoksa), UTC olarak kabul et
    let dateStr = iso.trim();
    const hasTimezone = dateStr.endsWith("Z") || dateStr.match(/[+-]\d{2}:?\d{2}$/);
    if (!hasTimezone) {
      // Timezone bilgisi yok, UTC olarak parse et
      dateStr = dateStr + "Z";
    }
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return iso;
    // Türkiye saati için timezone'u açıkça belirt
    return d.toLocaleString("tr-TR", {
      timeZone: "Europe/Istanbul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
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

