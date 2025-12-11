"use client";

import * as React from "react";
import "leaflet/dist/leaflet.css";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Polyline,
  Tooltip,
  useMap,
} from "react-leaflet";
import { getAuthToken } from "@/src/utils/auth";
import { useSupportAccess } from "@/src/hooks/useSupportAccess";
import dynamic from "next/dynamic";

const MapPicker = dynamic(() => import("@/src/components/map/MapPicker"), {
  ssr: false,
});

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
  addressLine1?: string | null;
  addressLine2?: string | null;
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
  const [okMsg, setOkMsg] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const ok = (m: string) => {
    setOkMsg(m);
    setTimeout(() => setOkMsg(null), 3500);
  };
  const err = (m: string) => {
    setError(m);
    setTimeout(() => setError(null), 4500);
  };

  const [limit, setLimit] = React.useState<number | "">("");
  const [offset, setOffset] = React.useState<number>(0);
  const [search, setSearch] = React.useState("");

  const [editOpen, setEditOpen] = React.useState(false);
  const [editBusy, setEditBusy] = React.useState(false);
  const [editing, setEditing] = React.useState<Restaurant | null>(null);

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
        addressLine1: x.addressLine1 ?? null,
        addressLine2: x.addressLine2 ?? null,
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

  const showEdit = async (row: Restaurant) => {
    setEditing({ ...row });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editing) return;
    setEditBusy(true);
    try {
      const id = editing.id;
      const body = {
        email: editing.email,
        phone: editing.phone,
        name: editing.name,
        contact_person: editing.contactPerson,
        tax_number: editing.taxNumber,
        address_line1: editing.addressLine1,
        address_line2: editing.addressLine2,
        opening_hour: editing.openingHour,
        closing_hour: editing.closingHour,
        latitude: editing.latitude,
        longitude: editing.longitude,
      };
      const res = await fetch(`/yuksi/support/restaurants/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body),
      });
      const j: any = await readJson(res);
      if (!res.ok) throw new Error(pickMsg(j, `HTTP ${res.status}`));
      ok("Yük güncellendi.");
      setEditOpen(false);
      await load();
    } catch (e: any) {
      err(e?.message || "Güncelleme başarısız.");
    } finally {
      setEditBusy(false);
    }
  };

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

        {(okMsg || error) && (
          <div className="space-y-2">
            {okMsg && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {okMsg}
              </div>
            )}
            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            )}
          </div>
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
                  <div className="px-3 py-3 text-sm text-center md:text-left truncate">
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
                      <button className="rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-sky-600">
                        Detay
                      </button>
                      <button
                        onClick={() => showEdit(r)}
                        className="rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-semibold text-white shadow hover:bg-amber-600"
                      >
                        Düzenle
                      </button>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </section>

      {editOpen && editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-lg font-semibold">
                Restoran Düzenle <br />{" "}
                <span className="text-sm">
                  (Sistemsel sorun anında müdahale için.)
                </span>
              </div>
              <button
                onClick={() => setEditOpen(false)}
                className="rounded-full p-2 hover:bg-neutral-100"
                aria-label="Kapat"
              >
                ✕
              </button>
            </div>

            <div className="max-h-[75vh] overflow-auto grid gap-4 p-1 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">
                  E-Posta
                </label>
                <input
                  value={editing.email ?? ""}
                  onChange={(e) =>
                    setEditing({ ...editing, email: e.target.value })
                  }
                  required
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2 outline-none focus:ring-2 focus:ring-sky-200"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Telefon
                </label>
                <input
                  type="phone"
                  value={editing.phone ?? ""}
                  onChange={(e) =>
                    setEditing({ ...editing, phone: e.target.value })
                  }
                  required
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2 outline-none focus:ring-2 focus:ring-sky-200"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Restoran Adı
                </label>
                <input
                  value={editing.name ?? ""}
                  onChange={(e) =>
                    setEditing({ ...editing, name: e.target.value })
                  }
                  required
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2 outline-none focus:ring-2 focus:ring-sky-200"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Yetkili Kişi
                </label>
                <input
                  value={editing.contactPerson ?? ""}
                  onChange={(e) =>
                    setEditing({ ...editing, contactPerson: e.target.value })
                  }
                  required
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2 outline-none focus:ring-2 focus:ring-sky-200"
                />
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-sm font-medium">
                  Vergi Numarası
                </label>
                <input
                  value={editing.taxNumber ?? ""}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      taxNumber: e.target.value,
                    })
                  }
                  required
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2 outline-none focus:ring-2 focus:ring-sky-200"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Adres Satırı 1
                </label>
                <input
                  value={editing.addressLine1 ?? ""}
                  onChange={(e) =>
                    setEditing({ ...editing, addressLine1: e.target.value })
                  }
                  required
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2 outline-none focus:ring-2 focus:ring-sky-200"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Adres Satırı 2
                </label>
                <input
                  value={editing.addressLine2 ?? ""}
                  onChange={(e) =>
                    setEditing({ ...editing, addressLine2: e.target.value })
                  }
                  required
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2 outline-none focus:ring-2 focus:ring-sky-200"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Açılış Saati
                </label>
                <input
                  value={editing.openingHour ?? ""}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      openingHour: e.target.value,
                    })
                  }
                  required
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2 outline-none focus:ring-2 focus:ring-sky-200"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Kapanış Saati
                </label>
                <input
                  value={editing.closingHour ?? ""}
                  onChange={(e) =>
                    setEditing({ ...editing, closingHour: e.target.value })
                  }
                  required
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2 outline-none focus:ring-2 focus:ring-sky-200"
                />
              </div>

              <div>
                <MapPicker
                  value={
                    editing.latitude && editing.longitude
                      ? {
                          lat: Number(editing.latitude),
                          lng: Number(editing.longitude),
                        }
                      : null
                  }
                  onChange={(pos: any) => {
                    setEditing({ 
                    ...editing, latitude: pos.lat, longitude: pos.lng, addressLine1: pos.address
                     })
                  }}
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setEditOpen(false)}
                className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm hover:bg-neutral-50"
              >
                İptal
              </button>
              <button
                onClick={saveEdit}
                disabled={editBusy}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {editBusy ? "Kaydediliyor…" : "Kaydet"}
              </button>
            </div>
          </div>
        </div>
      )}

      {info && (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm text-neutral-800 shadow-lg">
          {info}
        </div>
      )}
    </div>
  );
}
