"use client";

import * as React from "react";
import Link from "next/link";
import { useSupportAccess } from "@/src/hooks/useSupportAccess";
import { fmtDateTR, pickMsg, readJson, statusBadge, translateVehicleType } from "./shared";

type ListKind = "dealer-forms" | "corporate-forms" | "carrier-applications";

type ListRow = {
  id: string;
  title: string;
  subtitle?: string | null;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  status?: string | null;
  createdAt?: string | null;
  // route params
  applicationType: "dealer_form" | "corporate_form" | "carrier_application";
};

type Props = {
  kind: ListKind;
  title: string;
  description: string;
};

function kindToType(kind: ListKind): ListRow["applicationType"] {
  if (kind === "dealer-forms") return "dealer_form";
  if (kind === "corporate-forms") return "corporate_form";
  return "carrier_application";
}

export default function ApplicationsList(props: Props) {
  const { kind, title, description } = props;

  const { access } = useSupportAccess();
  const hasAccess = access === null ? null : access.includes(8);

  const [rows, setRows] = React.useState<ListRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [limit, setLimit] = React.useState<number>(50);
  const [offset, setOffset] = React.useState<number>(0);
  const [status, setStatus] = React.useState<string>("");
  const [search, setSearch] = React.useState<string>("");

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = new URL(`/api/support/applications/${kind}`, window.location.origin);
      url.searchParams.set("limit", String(limit));
      url.searchParams.set("offset", String(offset));
      if (status) url.searchParams.set("status", status);
      if (search.trim()) url.searchParams.set("search", search.trim());

      const res = await fetch(url.toString(), { cache: "no-store" });
      const data: any = await readJson(res);
      if (!res.ok || data?.success === false) throw new Error(pickMsg(data, `HTTP ${res.status}`));

      const arr: any[] = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
      const applicationType = kindToType(kind);

      const mapped: ListRow[] = arr.map((x) => {
        if (kind === "carrier-applications") {
          const firstName = String(x.firstName ?? x.first_name ?? "");
          const lastName = String(x.lastName ?? x.last_name ?? "");
          const vehicleType = x.vehicleType ?? x.vehicle_type ?? null;
          return {
            id: String(x.id),
            title: `${firstName} ${lastName}`.trim() || String(x.id),
            subtitle: vehicleType ? `Araç: ${translateVehicleType(vehicleType)}` : null,
            phone: x.phoneNumber ?? x.phone ?? null,
            email: x.email ?? null,
            city: x.city ?? null,
            status: x.status ?? null,
            createdAt: x.createdAt ?? x.created_at ?? null,
            applicationType,
          };
        }

        if (kind === "corporate-forms") {
          const name = String(x.name ?? "");
          const businessName = x.businessName ?? x.business_name ?? null;
          return {
            id: String(x.id),
            title: name || String(x.id),
            subtitle: businessName ? `Firma: ${String(businessName)}` : null,
            phone: x.phone ?? null,
            email: x.email ?? null,
            city: x.city ?? null,
            status: x.status ?? null,
            createdAt: x.createdAt ?? x.created_at ?? null,
            applicationType,
          };
        }

        // dealer-forms
        const name = String(x.name ?? "");
        const subject = x.subject ?? null;
        return {
          id: String(x.id),
          title: name || String(x.id),
          subtitle: subject ? String(subject) : null,
          phone: x.phone ?? null,
          email: x.email ?? null,
          city: x.city ?? null,
          status: x.status ?? null,
          createdAt: x.createdAt ?? x.created_at ?? null,
          applicationType,
        };
      });

      // Durumu onaylandı/reddedildi olanları gösterme
      const filtered = mapped.filter((row) => {
        const st = row.status?.toLowerCase();
        return st !== "approved" && st !== "rejected";
      });

      setRows(filtered);
    } catch (e: any) {
      setError(e?.message || "Liste getirilemedi.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [kind, limit, offset, search, status]);

  React.useEffect(() => {
    if (hasAccess === null) return;
    if (!hasAccess) return;
    load();
  }, [hasAccess, load]);

  if (hasAccess === false) {
    return (
      <div className="rounded-2xl bg-white p-6 shadow">
        <h1 className="text-xl font-semibold mb-2">{title}</h1>
        <p className="text-sm text-rose-600">
          Bu sayfayı görüntülemek için <strong>Başvuru Yönetimi </strong> yetkisine sahip olmanız gerekiyor.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-neutral-600">{description}</p>
        </div>

        <button
          onClick={load}
          className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-orange-600"
          disabled={loading}
        >
          {loading ? "Yükleniyor…" : "Yenile"}
        </button>
      </div>

      <section className="rounded-2xl border border-neutral-200/70 bg-white shadow-sm">
        <div className="border-b border-neutral-200/70 p-4 grid grid-cols-1 gap-3 md:grid-cols-12 md:items-end">
          <div className="md:col-span-5">
            <label className="block text-xs font-semibold text-neutral-600 mb-1">Arama</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ad, email, telefon, şehir…"
              className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-neutral-800 outline-none ring-2 ring-transparent transition placeholder:text-neutral-400 focus:bg-white focus:ring-orange-200"
            />
          </div>

          <div className="md:col-span-3">
            <label className="block text-xs font-semibold text-neutral-600 mb-1">Başvuru Durumu</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm"
            >
              <option value="">Tümü</option>
              <option value="pending">Beklemede</option>
              <option value="approved">Onaylandı</option>
              <option value="rejected">Reddedildi</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-neutral-600 mb-1">Limit</label>
            <input
              type="number"
              min={1}
              max={200}
              value={limit}
              onChange={(e) => setLimit(Math.max(1, Math.min(200, Number(e.target.value) || 50)))}
              className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-neutral-600 mb-1">Offset</label>
            <input
              type="number"
              min={0}
              value={offset}
              onChange={(e) => setOffset(Math.max(0, Number(e.target.value) || 0))}
              className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm"
            />
          </div>

          <div className="md:col-span-12 flex justify-end">
            <button
              onClick={() => {
                setOffset(0);
                load();
              }}
              className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
              disabled={loading}
            >
              Filtrele
            </button>
          </div>
        </div>

        {error && <div className="px-4 pt-3 pb-2 text-sm text-rose-600">{error}</div>}

        <div className="overflow-x-auto">
          <div className="min-w-full border-t border-neutral-200/70">
            <div className="hidden md:grid md:grid-cols-12 text-sm text-neutral-500 border-b text-center">
              <div className="px-4 py-3 font-medium md:col-span-4">Başvuru</div>
              <div className="px-4 py-3 font-medium md:col-span-3">İletişim</div>
              <div className="px-4 py-3 font-medium md:col-span-2">Şehir</div>
              <div className="px-4 py-3 font-medium md:col-span-2">Durum</div>
              <div className="px-4 py-3 font-medium md:col-span-1">Detay</div>
            </div>

            {loading && (
              <div className="px-6 py-10 text-center text-sm text-neutral-500">Yükleniyor…</div>
            )}

            {!loading &&
              rows.map((r) => (
                <div
                  key={r.id}
                  className="border-b border-neutral-200/70 md:grid md:grid-cols-12 hover:bg-neutral-50 bg-[#FFF4EE]"
                >
                  <div className="px-4 py-3 md:col-span-4">
                    <div className="text-sm font-semibold text-neutral-900">
                      <div className="md:hidden text-[11px] text-neutral-500">Başvuru</div>
                      {r.title}
                    </div>
                    <div className="mt-1 text-xs text-neutral-600">{r.subtitle || "-"}</div>
                    <div className="mt-1 text-[11px] text-neutral-400">#{r.id} • {fmtDateTR(r.createdAt)}</div>
                  </div>

                  <div className="px-4 py-3 text-sm md:col-span-3">
                    <div className="md:hidden text-[11px] text-neutral-500">İletişim</div>
                    <div className="text-neutral-800">{r.email || <span className="text-neutral-400">–</span>}</div>
                    <div className="text-neutral-700">{r.phone || <span className="text-neutral-400">–</span>}</div>
                  </div>

                  <div className="px-4 py-3 text-sm md:col-span-2">
                    <div className="md:hidden text-[11px] text-neutral-500">Şehir</div>
                    {r.city || "-"}
                  </div>

                  <div className="px-4 py-3 text-sm md:col-span-2">
                    <div className="md:hidden text-[11px] text-neutral-500">Durum</div>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadge(r.status)}`}>
                      {r.status === "approved"
                        ? "Onaylandı"
                        : r.status === "rejected"
                        ? "Reddedildi"
                        : "Beklemede"}
                    </span>
                  </div>

                  <div className="px-4 py-3 text-sm md:col-span-1 md:flex md:items-center md:justify-center">
                    <Link
                      href={`/dashboard/supports/applications/${encodeURIComponent(
                        r.applicationType
                      )}/${encodeURIComponent(r.id)}`}
                      className="inline-flex items-center justify-center rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-600"
                    >
                      Aç
                    </Link>
                  </div>
                </div>
              ))}

            {!loading && rows.length === 0 && !error && (
              <div className="px-6 py-12 text-center text-sm text-neutral-500">Kayıt bulunamadı.</div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

