//src/app/dashboard/supports/couriers/courier-list/CourierList.tsx
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

/* ========= helpers ========= */

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

/* ========= types ========= */

type Courier = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  plate?: string | null;
  vehicle_type?: string | null;
  city?: string | null;
  address?: string | null;
  is_active?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

type CourierListResponse = {
  success?: boolean;
  message?: string;
  data?: Courier[];
};

type LatLngApi = { latitude: number; longitude: number };

type CourierPackage = {
  id: string;
  code: string;
  customer: string;
  phone: string;
  address: string;
  deliveryAddress: string;
  type: string;
  status: string;
  amount: number;
  carrierType: string;
  vehicleType: string;
  cargoType: string;
  specialRequests?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  pickupCoordinates?: LatLngApi | null;
  dropoffCoordinates?: LatLngApi | null;
};

type CourierPackageListResponse = {
  success?: boolean;
  message?: string;
  data?: CourierPackage[];
};

/* ========= page ========= */

export default function CourierList() {
  const token = React.useMemo(() => getAuthToken(), []);
  const headers = React.useMemo<HeadersInit>(() => bearerHeaders(token), [token]);

  // access kontrolü (Modül 1: Kurye)
  const { access } = useSupportAccess();
  const hasCourierAccess = !access ? null : access.includes(1);

  const [rows, setRows] = React.useState<Courier[]>([]);
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

  // Paket modal state'i
  const [pkgCourier, setPkgCourier] = React.useState<Courier | null>(null);
  const [packages, setPackages] = React.useState<CourierPackage[]>([]);
  const [pkgLoading, setPkgLoading] = React.useState(false);
  const [pkgError, setPkgError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    if (!token) {
      setError("Oturum bulunamadı.");
      setRows([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // backend: GET /api/support/couriers
      // front:   /yuksi/support/couriers
      const url = new URL("/yuksi/support/couriers", window.location.origin);
      if (limit !== "") url.searchParams.set("limit", String(limit));
      url.searchParams.set("offset", String(offset));
      if (search.trim()) url.searchParams.set("search", search.trim());

      const res = await fetch(url.toString(), {
        headers,
        cache: "no-store",
      });

      const data = await readJson<CourierListResponse>(res);

      if (!res.ok || (data && (data as any).success === false)) {
        throw new Error(pickMsg(data, `HTTP ${res.status}`));
      }

      const arr: any[] = Array.isArray(data?.data)
        ? (data!.data as any[])
        : Array.isArray(data)
        ? (data as any as any[])
        : [];

      const mapped: Courier[] = arr.map((x) => ({
        id: String(x.id),

        // isim alanları
        first_name: String(x.first_name ?? x.firstName ?? ""),
        last_name: String(x.last_name ?? x.lastName ?? ""),

        email: x.email ?? null,
        phone: x.phone ?? null,

        plate: x.plate ?? x.vehiclePlate ?? null,
        vehicle_type:
          x.vehicle_type ??
          x.vehicleType ??
          (typeof x.vehicleType === "number" ? String(x.vehicleType) : null),

        city: x.city ?? x.stateName ?? null,
        address: x.address ?? null,

        is_active: Boolean(x.is_active ?? x.isActive ?? x.active ?? true),
        created_at: x.created_at ?? x.createdAt ?? null,
        updated_at: x.updated_at ?? x.updatedAt ?? null,
      }));

      setRows(mapped);
      if (!arr.length) toast("Kayıt bulunamadı veya liste boş.");
    } catch (e: any) {
      setError(e?.message || "Kurye listesi getirilemedi.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [headers, limit, offset, search, token]);

  React.useEffect(() => {
    // access henüz gelmemişse bekle
    if (hasCourierAccess === null) return;
    if (!hasCourierAccess) return;
    load();
  }, [load, hasCourierAccess]);

  // Belirli bir kuryenin paketlerini getir
  async function loadPackages(courier: Courier) {
    if (!token) {
      setPkgError("Oturum bulunamadı.");
      setPackages([]);
      return;
    }

    setPkgCourier(courier);
    setPkgLoading(true);
    setPkgError(null);
    setPackages([]);

    try {
      // backend: GET /api/support/couriers/{courier_id}/packages
      // front:   /yuksi/support/couriers/{courier_id}/packages
      const url = new URL(
        `/yuksi/support/couriers/${courier.id}/packages`,
        window.location.origin
      );
      url.searchParams.set("limit", "200");
      url.searchParams.set("offset", "0");

      const res = await fetch(url.toString(), {
        headers,
        cache: "no-store",
      });

      const data = await readJson<CourierPackageListResponse>(res);

      if (!res.ok || (data && (data as any).success === false)) {
        throw new Error(pickMsg(data, `HTTP ${res.status}`));
      }

      const arr: any[] = Array.isArray(data?.data)
        ? (data!.data as any[])
        : Array.isArray(data)
        ? (data as any as any[])
        : [];

      const mapped: CourierPackage[] = arr.map((x) => {
        const pickup = x.pickupCoordinates || (x as any).pickupCoordinates;
        const dropoff = x.dropoffCoordinates || (x as any).dropoffCoordinates;

        const pickupCoords: LatLngApi | null =
          pickup && pickup.latitude != null && pickup.longitude != null
            ? {
                latitude: Number(pickup.latitude),
                longitude: Number(pickup.longitude),
              }
            : null;

        const dropoffCoords: LatLngApi | null =
          dropoff && dropoff.latitude != null && dropoff.longitude != null
            ? {
                latitude: Number(dropoff.latitude),
                longitude: Number(dropoff.longitude),
              }
            : null;

        return {
          id: String(x.id),
          code: String(x.code ?? ""),
          customer: String(x.customer ?? ""),
          phone: String(x.phone ?? ""),
          address: String(x.address ?? ""),
          deliveryAddress: String(x.deliveryAddress ?? ""),
          type: String(x.type ?? ""),
          status: String(x.status ?? ""),
          amount: Number(x.amount ?? 0),
          carrierType: String(x.carrierType ?? ""),
          vehicleType: String(x.vehicleType ?? ""),
          cargoType: String(x.cargoType ?? ""),
          specialRequests: x.specialRequests ?? null,
          createdAt: x.createdAt ?? null,
          updatedAt: x.updatedAt ?? null,
          pickupCoordinates: pickupCoords,
          dropoffCoordinates: dropoffCoords,
        };
      });

      setPackages(mapped);
    } catch (e: any) {
      setPkgError(e?.message || "Kurye paketleri getirilemedi.");
      setPackages([]);
    } finally {
      setPkgLoading(false);
    }
  }

  // access yoksa uyarı
  if (hasCourierAccess === false) {
    return (
      <div className="rounded-2xl bg-white p-6 shadow">
        <h1 className="text-xl font-semibold mb-2">Kurye Listesi</h1>
        <p className="text-sm text-rose-600">
          Bu sayfayı görüntülemek için <strong>Kurye (Modül 1)</strong> yetkisine
          sahip olmanız gerekiyor.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Kurye Listesi</h1>
          <p className="text-sm text-neutral-600">
            Çağrı merkezi için tüm kuryelerin listesini görüntüleyin (Modül 1 gerekli).
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
            min={0}
            value={offset}
            onChange={(e) => setOffset(Number(e.target.value) || 0)}
            className="w-24 rounded-lg border border-neutral-300 bg-neutral-100 px-2 py-1.5 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-orange-200"
          />
          <button
            onClick={load}
            className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-orange-600"
          >
            Yenile
          </button>
        </div>
      </div>

      {/* arama + tablo */}
      <section className="rounded-2xl border border-neutral-200/70 bg-white shadow-sm">
        <div className="border-b border-neutral-200/70 p-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ara: ad, soyad, e-posta, telefon…"
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
          <table className="min-w-full border-t border-neutral-200/70">
            <thead>
              <tr className="text-left text-sm text-neutral-500">
                <th className="px-4 py-3 font-medium">Kurye</th>
                <th className="px-4 py-3 font-medium">İletişim</th>
                <th className="px-4 py-3 font-medium">Araç / Plaka</th>
                <th className="px-4 py-3 font-medium">Konum</th>
                <th className="px-4 py-3 font-medium">Durum</th>
                <th className="px-4 py-3 font-medium">Oluşturma</th>
                <th className="px-4 py-3 font-medium w-[140px]">Paketler</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-10 text-center text-sm text-neutral-500"
                  >
                    Yükleniyor…
                  </td>
                </tr>
              )}

              {!loading &&
                rows.map((c) => (
                  <tr
                    key={c.id}
                    className="border-t border-neutral-200/70 align-top hover:bg-neutral-50"
                  >
                    <td className="px-4 py-3">
                      <div className="text-sm font-semibold text-neutral-900">
                        {c.first_name} {c.last_name}
                      </div>
                      <div className="mt-1 text-[11px] text-neutral-400">
                        #{c.id}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="text-neutral-800">
                        {c.email || <span className="text-neutral-400">–</span>}
                      </div>
                      <div className="text-neutral-700">
                        {c.phone || <span className="text-neutral-400">–</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div>{c.vehicle_type || "-"}</div>
                      <div className="text-neutral-600 text-xs">
                        {c.plate || ""}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div>{c.city || "-"}</div>
                      <div className="text-xs text-neutral-600 line-clamp-2">
                        {c.address || ""}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {c.is_active ? (
                        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">
                          Aktif
                        </span>
                      ) : (
                        <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 ring-1 ring-rose-100">
                          Pasif
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {fmtDate(c.created_at)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <button
                        onClick={() => loadPackages(c)}
                        className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-orange-600"
                      >
                        Paketleri Gör
                      </button>
                    </td>
                  </tr>
                ))}

              {!loading && rows.length === 0 && !error && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-12 text-center text-sm text-neutral-500"
                  >
                    Kayıt bulunamadı.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* toast */}
      {info && (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm text-neutral-800 shadow-lg">
          {info}
        </div>
      )}

      {/* Paket modalı */}
      {pkgCourier && (
        <PackagesModal
          courier={pkgCourier}
          packages={packages}
          loading={pkgLoading}
          error={pkgError}
          onClose={() => {
            setPkgCourier(null);
            setPackages([]);
            setPkgError(null);
          }}
        />
      )}
    </div>
  );
}

/* ========= Modal ========= */

function PackagesModal(props: {
  courier: Courier;
  packages: CourierPackage[];
  loading: boolean;
  error: string | null;
  onClose: () => void;
}) {
  const { courier, packages, loading, error, onClose } = props;

  // Haritada gösterilecek paket
  const [selectedPkgId, setSelectedPkgId] = React.useState<string | null>(null);

  const selectedPkg = React.useMemo(
    () => packages.find((p) => p.id === selectedPkgId) || null,
    [packages, selectedPkgId]
  );

  // start/end (pickup/dropoff) map formatına çevrilmiş hali
  const start = React.useMemo(
    () =>
      selectedPkg?.pickupCoordinates
        ? {
            lat: selectedPkg.pickupCoordinates.latitude,
            lng: selectedPkg.pickupCoordinates.longitude,
          }
        : null,
    [selectedPkg]
  );

  const end = React.useMemo(
    () =>
      selectedPkg?.dropoffCoordinates
        ? {
            lat: selectedPkg.dropoffCoordinates.latitude,
            lng: selectedPkg.dropoffCoordinates.longitude,
          }
        : null,
    [selectedPkg]
  );

  const coordsAvailable = !!start && !!end;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <div className="w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-xl flex flex-col">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold">Kurye Paketleri</h3>
            <p className="text-xs text-neutral-600">
              {courier.first_name} {courier.last_name} – #{courier.id}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 hover:bg-neutral-100"
            aria-label="Kapat"
          >
            ✕
          </button>
        </div>

        {/* Harita alanı */}
        <div className="px-5 pt-4 pb-3 border-b border-neutral-200/70 bg-neutral-50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-neutral-700">
              Haritada Paket Rotaları
            </span>
            {selectedPkg && (
              <span className="text-xs text-neutral-500">
                Seçili paket: <b>{selectedPkg.code}</b>
              </span>
            )}
          </div>

          {coordsAvailable ? (
            <div style={{ height: 420 }} className="rounded-xl overflow-hidden">
              <RouteMap start={start!} end={end!} />
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-neutral-300 bg-white px-4 py-6 text-sm text-neutral-500 text-center">
              Haritada göstermek için aşağıdaki tablodan bir pakete{" "}
              <span className="font-semibold">“Haritada Göster”</span> butonuyla
              tıklayın. Seçili paketin pickup ve dropoff koordinatları
              bulunmuyorsa rota çizilemez.
            </div>
          )}
        </div>

        <div className="flex-1 overflow-auto">
          {error && (
            <div className="px-5 pt-3 pb-2 text-sm text-rose-600">{error}</div>
          )}

          {loading && (
            <div className="px-5 py-6 text-sm text-neutral-500">
              Paketler yükleniyor…
            </div>
          )}

          {!loading && !error && packages.length === 0 && (
            <div className="px-5 py-6 text-sm text-neutral-500">
              Bu kurye için paket bulunamadı.
            </div>
          )}

          {!loading && packages.length > 0 && (
            <table className="min-w-full border-t border-neutral-200/70 text-sm">
              <thead>
                <tr className="text-left text-xs text-neutral-500">
                  <th className="px-4 py-2 font-medium">Kod</th>
                  <th className="px-4 py-2 font-medium">Müşteri</th>
                  <th className="px-4 py-2 font-medium">Adres</th>
                  <th className="px-4 py-2 font-medium">Tür / Kargo</th>
                  <th className="px-4 py-2 font-medium">Durum</th>
                  <th className="px-4 py-2 font-medium text-right">Tutar</th>
                  <th className="px-4 py-2 font-medium w-[130px]">Harita</th>
                </tr>
              </thead>
              <tbody>
                {packages.map((p) => {
                  const isSelected = p.id === selectedPkgId;
                  const hasCoords =
                    !!p.pickupCoordinates && !!p.dropoffCoordinates;

                  return (
                    <tr
                      key={p.id}
                      className={`border-t border-neutral-200/70 align-top ${
                        isSelected ? "bg-orange-50/60" : ""
                      }`}
                    >
                      <td className="px-4 py-2 align-top">
                        <div className="font-medium">{p.code}</div>
                        <div className="text-[11px] text-neutral-400">
                          {fmtDate(p.createdAt)}
                        </div>
                      </td>
                      <td className="px-4 py-2 align-top">
                        <div>{p.customer}</div>
                        <div className="text-xs text-neutral-600">{p.phone}</div>
                      </td>
                      <td className="px-4 py-2 align-top">
                        <div className="text-xs text-neutral-800 line-clamp-2">
                          {p.address}
                        </div>
                        <div className="mt-1 text-[11px] text-neutral-500 line-clamp-2">
                          Teslim: {p.deliveryAddress}
                        </div>
                      </td>
                      <td className="px-4 py-2 align-top">
                        <div className="text-xs">
                          {p.type} / {p.cargoType}
                        </div>
                        <div className="text-[11px] text-neutral-500">
                          {p.carrierType} – {p.vehicleType}
                        </div>
                      </td>
                      <td className="px-4 py-2 align-top">
                        <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-semibold text-neutral-800">
                          {p.status}
                        </span>
                        {p.specialRequests && (
                          <div className="mt-1 text-[11px] text-neutral-600 line-clamp-2">
                            Not: {p.specialRequests}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2 align-top text-right">
                        {p.amount.toLocaleString("tr-TR", {
                          style: "currency",
                          currency: "TRY",
                        })}
                      </td>
                      <td className="px-4 py-2 align-top text-right">
                        <button
                          type="button"
                          disabled={!hasCoords}
                          onClick={() => {
                            if (!hasCoords) return;
                            setSelectedPkgId(p.id);
                          }}
                          className={`rounded-lg px-3 py-1.5 text-xs font-semibold shadow-sm ${
                            hasCoords
                              ? "bg-sky-500 text-white hover:bg-sky-600"
                              : "bg-neutral-200 text-neutral-500 cursor-not-allowed"
                          }`}
                        >
                          Haritada Göster
                        </button>
                        {!hasCoords && (
                          <div className="mt-1 text-[10px] text-neutral-400">
                            Konum bilgisi yok
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="border-t px-5 py-3 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-xl bg-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-300"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================= Route Map (pickup → dropoff, OSRM polyline) ================= */

type MapLatLng = { lat: number; lng: number };

function FitBounds({ start, end }: { start: MapLatLng; end: MapLatLng }) {
  const map = useMap();
  React.useEffect(() => {
    try {
      map.fitBounds(
        [
          [start.lat, start.lng],
          [end.lat, end.lng],
        ],
        { padding: [30, 30] }
      );
    } catch {}
  }, [map, start, end]);
  return null;
}

function RouteMap({ start, end }: { start: MapLatLng; end: MapLatLng }) {
  const [points, setPoints] = React.useState<[number, number][]>([]);
  const [routeError, setRouteError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    async function fetchRoute() {
      setRouteError(null);
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson&alternatives=false&steps=false`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);
        const j: any = await res.json();
        const coords: [number, number][] =
          j?.routes?.[0]?.geometry?.coordinates?.map(
            (c: [number, number]) => [c[1], c[0]]
          ) ?? [];
        if (!coords.length) throw new Error("Rota bulunamadı");
        if (!cancelled) setPoints(coords);
      } catch (e) {
        console.error("OSRM route error, straight line fallback:", e);
        if (!cancelled) {
          setRouteError(
            "Rota hesaplanamadı, kuş uçuşu çizgi gösteriliyor."
          );
          setPoints([
            [start.lat, start.lng],
            [end.lat, end.lng],
          ]);
        }
      }
    }

    fetchRoute();
    return () => {
      cancelled = true;
    };
  }, [start.lat, start.lng, end.lat, end.lng]);

  const center: [number, number] = [
    (start.lat + end.lat) / 2,
    (start.lng + end.lng) / 2,
  ];

  const polyPositions = points.length
    ? (points as [number, number][])
    : ([[start.lat, start.lng], [end.lat, end.lng]] as [number, number][]);

  return (
    <>
      {routeError && (
        <div className="px-3 py-2 text-xs text-amber-700 bg-amber-50 border-b border-amber-200">
          {routeError}
        </div>
      )}
      <MapContainer
        center={center}
        zoom={12}
        style={{ width: "100%", height: "100%" }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />
        <FitBounds start={start} end={end} />

        <CircleMarker
          center={[start.lat, start.lng]}
          radius={8}
          pathOptions={{ color: "#22c55e", weight: 3, fillOpacity: 0.9 }}
        >
          <Tooltip direction="top" offset={[0, -6]} opacity={1}>
            Çıkış Noktası
          </Tooltip>
        </CircleMarker>

        <CircleMarker
          center={[end.lat, end.lng]}
          radius={8}
          pathOptions={{ color: "#ef4444", weight: 3, fillOpacity: 0.9 }}
        >
          <Tooltip direction="top" offset={[0, -6]} opacity={1}>
            Teslim Noktası
          </Tooltip>
        </CircleMarker>

        <Polyline positions={polyPositions} pathOptions={{ weight: 4, opacity: 0.85 }} />
      </MapContainer>
    </>
  );
}
