"use client";

import * as React from "react";
import "leaflet/dist/leaflet.css";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  PolyLine,
  ToolTip,
  useMap,
} from "react-leaflet";
import { getAuthToken } from "@/src/utils/auth";
import { useSupportAccess } from "@/src/hooks/useSupportAccess";

function bearerHeaders(token?: string | null): HeadersInit {
  const h: HeadersInit = { Accept: "application/json" };
  if (token) (h as any).Authorization = `Bearer ${token}`;
  return h;
}

async function readJson<T = any>(res: Response): Promise<T> {
  const txt = await res.text().catch(() => "");
  try {
    return txt ? JSON.parse(txt) : ({} as any);
  } catch {
    return txt as any;
  }
}

const pickMsg = (d: any, fb: string) =>
  d?.error?.message || d?.message || d?.detail || d?.title || fb;

function fmtDate(iso?: string | null) {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("tr-TR");
  } catch {
    return iso;
  }
}

type Restaurant = {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  contactPerson?: string | null;
  taxNumber?: string | null;
  fullAddress?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  openingHour?: string | null;
  closingHour?: string | null;
  createdAt?: string | null;
  deletedAt?: string | null;
  location?: {
    cityId?: number | null;
    cityName?: string | null;
    stateId?: number | null;
    stateName?: string | null;
    countryId?: number | null;
    countryName?: string | null;
  } | null;
  dealer?: {
    id?: string | null;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    linkedAt?: string | null;
  } | null;
};

type RestaurantListResponse = {
  success?: boolean;
  message?: string;
  data?: Restaurant[];
};

type LatLngApi = { latitude: number; longitude: number };

export default function RestaurantList() {
  const token = React.useMemo(() => getAuthToken(), []);
  const headers = React.useMemo<HeadersInit>(
    () => bearerHeaders(token),
    [token]
  );

  const { access } = useSupportAccess();
  const hasRestaurantAccess = !access ? null : access.includes(1);

  const [rows, setRows] = React.useState<Restaurant[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [limit, setLimit] = React.useState<number | "">("");
  const [offset, setOffset] = React.useState<number>(0);
  const [search, setSearch] = React.useState("");

  const [info, setInfo] = React.useState<string | null>(null);
  function toast(msg: string) {
    setInfo(msg);
    setTimeout(() => setInfo(null), 2500);
  }

  const load = React.useCallback(async () => {
    if (!token) {
      setError("Oturum bulunamadı.");
      setRows([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const url = new URL("/yuksi/support/restaurants", window.location.origin);
      if (limit !== "") url.searchParams.set("limit", String(limit));
      url.searchParams.set("offset", String(offset));
      if (search.trim()) url.searchParams.set("search", search.trim());

      const res = await fetch(url.toString(), {
        headers,
        cache: "no-store",
      });

      const data = await readJson<RestaurantListResponse>(res);

      if (!res.ok || (data && (data as any).success === false))
        throw new Error(pickMsg(data, `HTTP ${res.status}`));

      const arr: any[] = Array.isArray(data?.data)
        ? (data!.data as any[])
        : Array.isArray(data)
        ? (data as any as any[])
        : [];

      const mapped: Restaurant[] = arr.map((x) => ({
        id: String(x.id),

        name: String(x.name ?? ""),

        email: x.email ?? null,
        phone: x.phone ?? null,
        contactPerson: x.contactPerson ?? null,
        taxNumber: x.taxNumber ?? null,
        fullAddress: x.fullAddress ?? null,
        latitude: x.latitude ?? null,
        longitude: x.longitude ?? null,
        openingHour: x.openingHour ?? null,
        closingHour: x.closingHour ?? null,
        createdAt: x.createdAt ?? null,
        deletedAt: x.deletedAt ?? null,
        location: x.location
          ? {
              cityId: x.location.cityId ?? null,
              cityName: x.location.cityName ?? null,
              stateId: x.location.stateId ?? null,
              stateName: x.location.stateName ?? null,
              countryId: x.location.countryId ?? null,
              countryName: x.location.countryName ?? null,
            }
          : null,
        dealer: x.dealer
          ? {
              id: x.dealer.id ?? null,
              name: x.dealer.name ?? null,
              email: x.dealer.email ?? null,
              phone: x.dealer.phone ?? null,
              linkedAt: x.dealer.linkedAt ?? null,
            }
          : null,
      }));
      setRows(mapped);
      if (!arr.length) toast("Kayıt bulunamadı veya liste boş.");
    } catch (e: any) {
      setError(e?.message || "Restoran listesi getirilemedi.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [headers, limit, offset, search, token]);

  React.useEffect(() => {
    if (hasRestaurantAccess === null) return;
    if (!hasRestaurantAccess) return;
    load();
  }, [load, hasRestaurantAccess]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Restoran Listesi
          </h1>
          <p className="text-sm text-neutral-600">
            Çağrı merkezi için tüm restoranların listesini görüntüleyin. (Modül
            3 gerekli).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-neutral-600">Limit</label>
          <input
            type="number"
            min={1}
            value={limit}
            onChange={(e) =>
              setLimit(e.target.value === "" ? "" : Number(e.target.value))
            }
            className="w-24 rounded-lg border border-neutral-300 bg-neutral-100 px-2 py-1.5 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-orange-200"
            placeholder="200"
          />
          <label className="text-xs text-neutral-600">Offset</label>
          <input
            type="number"
            min={1}
            value={offset}
            onChange={(e) =>
              setOffset(e.target.value === "" ? 0 : Number(e.target.value))
            }
            className="w-24 rounded-lg border border-neutral-300 bg-neutral-100 px-2 py-1.5 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-orange-200"
            placeholder="200"
          />
          <button
            onClick={load}
            className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-orange-600"
          >
            Yenile
          </button>
        </div>
      </div>

      <section className="rounded-2xl border border-neutral-200/70 bg-white shadow-sm">
        <div className="border-b border-neutral-200/70 p-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ara: Restoran adı, e-posta, telefon…"
              className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-neutral-800 outline-none ring-2 ring-transparent transition placeholder:text-neutral-400 focus:bg-white focus:ring-orange-200"
            />
            <p className="mt-1 text-xs text-neutral-500">
              Toplam {rows.length} kayıt yüklendi.
            </p>
          </div>
        </div>

        {error && (
          <div className="px-4 pt-3 pb-2 text-sm text-rose-600">{error}</div>
        )}

        <div className="overflow-x-auto">
          <div className="min-w-full border-t border-neutral-200/70">
            <div className="hidden md:grid md:grid-cols-6 text-sm text-neutral-500 border-b text-center">
              <div className="px-6 py-3 font-medium">Restoran</div>
              <div className="px-6 py-3 font-medium">İletişim</div>
              <div className="px-6 py-3 font-medium">Adres</div>
              <div className="px-6 py-3 font-medium">Oluşturma</div>
              <div className="px-6 py-3 font-medium">Ekleyen Bayi</div>
              <div className="px-6 py-3 font-medium">İşlemler</div>
            </div>

            {loading && (
              <div className="px-6 py-10 text-center text-sm text-neutral-500">
                Yükleniyor…
              </div>
            )}

            {!loading &&
              rows.map((r) => (
                <div
                  key={r.id}
                  className="border-b border-neutral-200/70 md:grid md:grid-cols-6 hover:bg-neutral-50 bg-[#FFF4EE]"
                >
                  <div className="px-3 py-3 text-center md:text-left">
                    <div className="text-sm font-semibold text-neutral-900">
                      <div className="md:hidden text-[11px] text-neutral-500">
                        Restoran
                      </div>
                      {r.name}
                    </div>
                    <div className="mt-1 text-[11px] text-neutral-400">
                      #{r.id}
                    </div>
                  </div>
                  <div className="px-3 py-3 text-center md:text-left">
                    <div className="md:hidden text-[11px] text-neutral-500">
                      İletişim
                    </div>
                    <div className="text-neutral-800">
                      {r.email || <span className="text-neutral-400">–</span>}
                    </div>
                    <div className="text-neutral-700">
                      {r.phone || <span className="text-neutral-400">–</span>}
                    </div>
                  </div>
                  <div className="px-3 py-3 text-center md:text-left">
                    <div className="md:hidden text-[11px] text-neutral-500">
                      Adres
                    </div>
                    {r.fullAddress}
                  </div>
                  <div className="px-3 py-3 text-center md:text-left">
                    <div className="md:hidden text-[11px] text-neutral-500">
                      Oluşturulma
                    </div>
                    {fmtDate(r.createdAt)}
                  </div>
                  <div className="px-3 py-3 text-center md:text-left">
                    <div className="md:hidden text-[11px] text-neutral-500">
                      Ekleyen Bayi
                    </div>
                    {r.dealer?.name}
                    <div className="mt-1 text-[11px] text-neutral-400">
                      #{r.dealer?.id}
                    </div>
                  </div>
                  <div className="px-3 py-3 text-center">
                      <div className="md:hidden text-[11px] text-neutral-500 mb-1">
                        İşlemler
                      </div>
                      <div className="flex items-center justify-center gap-2">
                        <button
                          className="rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-sky-600"
                        >
                          Detay
                        </button>
                        <button
                          className="rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-semibold text-white shadow hover:bg-amber-600"
                        >
                          Düzenle
                        </button>
                        <button
                          className="rounded-lg bg-rose-500 px-3 py-1.5 text-sm font-semibold text-white shadow hover:bg-rose-600"
                        >
                          Sil
                        </button>
                      </div>
                    </div>
                </div>
              ))}
          </div>
        </div>
      </section>
    </div>
  );
}
