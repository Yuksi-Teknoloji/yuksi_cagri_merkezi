//src/app/dshboard/supports/couriers/courier-location/CourierLocationClient.tsx
'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { getAuthToken } from '@/src/utils/auth';
import { useSupportAccess } from '@/src/hooks/useSupportAccess';

// Leaflet map (SSR kapalı)
const LiveLeaflet = dynamic(
  () => import('@/src/components/map/LiveLeaflet'),
  { ssr: false }
);

/* ========= helpers ========= */

function bearerHeaders(token?: string | null): HeadersInit {
  const h: HeadersInit = { Accept: 'application/json' };
  if (token) (h as any).Authorization = `Bearer ${token}`;
  return h;
}

async function readJson<T = any>(res: Response): Promise<T> {
  const txt = await res.text().catch(() => '');
  try {
    return txt ? JSON.parse(txt) : ({} as any);
  } catch {
    return txt as any;
  }
}

const pickMsg = (d: any, fb: string) =>
  d?.error?.message || d?.message || d?.detail || d?.title || fb;

function fmtDate(iso?: string | null) {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString('tr-TR');
  } catch {
    return iso;
  }
}

/* ========= types ========= */

type LatLngApi = {
  latitude: number;
  longitude: number;
};

type CourierApi = {
  id: string;
  firstName?: string;
  lastName?: string;
  first_name?: string;
  last_name?: string;
  email?: string | null;
  phone?: string | null;
  plate?: string | null;
  vehicleType?: string | null;
  vehicle_type?: string | null;
  city?: string | null;
  stateName?: string | null;
  address?: string | null;
  is_active?: boolean;
  isActive?: boolean;
  active?: boolean;
  created_at?: string | null;
  createdAt?: string | null;
  updated_at?: string | null;
  updatedAt?: string | null;
  location?: LatLngApi | null;
};

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
  location?: LatLngApi | null;
};

type CourierListResponse = {
  success?: boolean;
  message?: string;
  data?: CourierApi[];
};

type Marker = {
  id: string;
  name: string;
  phone: string;
  lat: number;
  lng: number;
};

/* ========= page ========= */

export default function CourierLocationClient() {
  const token = React.useMemo(() => getAuthToken(), []);
  const headers = React.useMemo<HeadersInit>(() => bearerHeaders(token), [token]);

  // access kontrolü (Modül 1: Kurye)
  const { access } = useSupportAccess();
  const hasCourierAccess = !access ? null : access.includes(1);

  const [rows, setRows] = React.useState<Courier[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [limit, setLimit] = React.useState<number | ''>('');
  const [offset, setOffset] = React.useState<number>(0);
  const [search, setSearch] = React.useState('');

  const [info, setInfo] = React.useState<string | null>(null);
  function toast(msg: string) {
    setInfo(msg);
    setTimeout(() => setInfo(null), 2500);
  }

  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    if (!token) {
      setError('Oturum bulunamadı.');
      setRows([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // backend: GET /api/support/couriers
      // front:   /yuksi/support/couriers
      const url = new URL('/yuksi/support/couriers', window.location.origin);
      if (limit !== '') url.searchParams.set('limit', String(limit));
      url.searchParams.set('offset', String(offset));
      if (search.trim()) url.searchParams.set('search', search.trim());

      const res = await fetch(url.toString(), {
        headers,
        cache: 'no-store',
      });

      const data = await readJson<CourierListResponse>(res);

      if (!res.ok || (data && (data as any).success === false)) {
        throw new Error(pickMsg(data, `HTTP ${res.status}`));
      }

      const arr: CourierApi[] = Array.isArray(data?.data)
        ? (data!.data as CourierApi[])
        : Array.isArray(data)
        ? (data as any as CourierApi[])
        : [];

      const mapped: Courier[] = arr.map((x) => {
        const loc = x.location || (x as any).location || null;
        const location: LatLngApi | null =
          loc && loc.latitude != null && loc.longitude != null
            ? {
                latitude: Number(loc.latitude),
                longitude: Number(loc.longitude),
              }
            : null;

        return {
          id: String(x.id),
          first_name: String(x.first_name ?? x.firstName ?? ""),
        last_name: String(x.last_name ?? x.lastName ?? ""),
          email: (x.email as any) ?? null,
          phone: (x.phone as any) ?? null,
          plate: x.plate ?? null,
          vehicle_type:
            x.vehicle_type ??
            x.vehicleType ??
            (typeof x.vehicleType === 'number'
              ? String(x.vehicleType)
              : x.vehicleType ??
                null),
          city: x.city ?? x.stateName ?? null,
          address: x.address ?? null,
          is_active: Boolean(x.is_active ?? x.isActive ?? x.active ?? true),
          created_at: x.created_at ?? x.createdAt ?? null,
          updated_at: x.updated_at ?? x.updatedAt ?? null,
          location,
        };
      });

      setRows(mapped);
      if (!arr.length) toast('Kayıt bulunamadı veya liste boş.');
    } catch (e: any) {
      setError(e?.message || 'Kurye listesi getirilemedi.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [headers, limit, offset, search, token]);

  React.useEffect(() => {
    if (hasCourierAccess === null) return;
    if (!hasCourierAccess) return;
    load();
  }, [load, hasCourierAccess]);

  const markers: Marker[] = React.useMemo(() => {
    const list: Marker[] = [];
    for (const c of rows) {
      if (!c.location) continue;
      const { latitude, longitude } = c.location;
      if (latitude == null || longitude == null) continue;
      list.push({
        id: c.id,
        name: `${c.first_name} ${c.last_name}`.trim() || `#${c.id}`,
        phone: c.phone || '',
        lat: Number(latitude),
        lng: Number(longitude),
      });
    }
    return list;
  }, [rows]);

  React.useEffect(() => {
    // ilk marker'ı otomatik seç
    if (!selectedId && markers.length > 0) {
      setSelectedId(markers[0].id);
    }
  }, [markers, selectedId]);

  // access yoksa uyarı
  if (hasCourierAccess === false) {
    return (
      <div className="rounded-2xl bg-white p-6 shadow">
        <h1 className="text-xl font-semibold mb-2">Kurye Konumları</h1>
        <p className="text-sm text-rose-600">
          Bu sayfayı görüntülemek için <strong>Kurye (Modül 1)</strong> yetkisine
          sahip olmanız gerekiyor.
        </p>
      </div>
    );
  }

  const selectedCourier = rows.find((c) => c.id === selectedId) || null;

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Kurye Konumları</h1>
          <p className="text-sm text-neutral-600">
            Çağrı merkezi için kuryelerin anlık konumlarını harita üzerinde görüntüleyin.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-neutral-600">Limit</label>
          <input
            type="number"
            min={1}
            value={limit}
            onChange={(e) =>
              setLimit(e.target.value === '' ? '' : Number(e.target.value))
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

      {/* search + map + side list */}
      <section className="rounded-2xl border border-neutral-200/70 bg-white shadow-sm p-4 space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex-1">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ara: ad, soyad, telefon…"
              className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-neutral-800 outline-none ring-2 ring-transparent transition placeholder:text-neutral-400 focus:bg-white focus:ring-orange-200"
            />
            <p className="mt-1 text-xs text-neutral-500">
              Toplam {rows.length} kurye, haritada {markers.length} konum.
            </p>
          </div>
        </div>

        {error && (
          <div className="px-1 text-sm text-rose-600">{error}</div>
        )}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.25fr)]">
          {/* Harita */}
          <div className="rounded-2xl border border-neutral-200/70 bg-neutral-50 p-3">
            {markers.length > 0 ? (
              <LiveLeaflet
                markers={markers}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            ) : (
              <div className="flex h-[420px] items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-white text-sm text-neutral-500">
                Konum bilgisi olan kurye bulunamadı.
              </div>
            )}
          </div>

          {/* Sağ panel: seçili kurye / liste */}
          <div className="flex flex-col gap-3">
            <div className="rounded-2xl border border-neutral-200/70 bg-neutral-50 p-3">
              <div className="mb-2 text-sm font-semibold text-neutral-700">
                Seçili Kurye
              </div>
              {selectedCourier ? (
                <div className="space-y-1 text-sm">
                  <div className="text-base font-semibold text-neutral-900">
                    {selectedCourier.first_name} {selectedCourier.last_name}
                  </div>
                  <div className="text-xs text-neutral-500">#{selectedCourier.id}</div>
                  <div className="mt-2 text-neutral-800">
                    {selectedCourier.phone || <span className="text-neutral-400">Telefon yok</span>}
                  </div>
                  <div className="text-neutral-800">
                    {selectedCourier.email || <span className="text-neutral-400">E-posta yok</span>}
                  </div>
                  <div className="mt-2 text-xs text-neutral-600">
                    {selectedCourier.city || '-'}
                  </div>
                  {selectedCourier.address && (
                    <div className="text-xs text-neutral-600 line-clamp-3">
                      {selectedCourier.address}
                    </div>
                  )}
                  <div className="mt-2 text-xs text-neutral-500">
                    Oluşturma: {fmtDate(selectedCourier.created_at)}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-neutral-500">
                  Haritadaki bir kuryeye tıklayarak detayları burada görebilirsiniz.
                </div>
              )}
            </div>

            <div className="flex-1 overflow-auto rounded-2xl border border-neutral-200/70 bg-white">
              <div className="border-b border-neutral-200/70 px-3 py-2 text-xs font-semibold text-neutral-600">
                Kurye Listesi
              </div>
              <div className="max-h-[280px] overflow-auto">
                {loading && (
                  <div className="px-4 py-4 text-sm text-neutral-500">
                    Yükleniyor…
                  </div>
                )}

                {!loading && rows.length === 0 && !error && (
                  <div className="px-4 py-4 text-sm text-neutral-500">
                    Kayıt bulunamadı.
                  </div>
                )}

                {!loading && rows.length > 0 && (
                  <ul className="divide-y divide-neutral-200/70">
                    {rows.map((c) => {
                      const hasLoc = !!c.location;
                      const active = selectedId === c.id;
                      return (
                        <li key={c.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedId(c.id)}
                            className={`flex w-full items-start justify-between gap-2 px-3 py-2 text-left text-sm ${
                              active ? 'bg-orange-50' : 'hover:bg-neutral-50'
                            }`}
                          >
                            <div>
                              <div className="font-semibold text-neutral-900">
                                {c.first_name} {c.last_name}
                              </div>
                              <div className="text-[11px] text-neutral-500">
                                #{c.id}
                              </div>
                              <div className="mt-1 text-xs text-neutral-700">
                                {c.phone || <span className="text-neutral-400">Telefon yok</span>}
                              </div>
                              <div className="text-[11px] text-neutral-500">
                                {c.city || '-'}
                              </div>
                            </div>
                            <div className="mt-1 shrink-0 text-[11px]">
                              {hasLoc ? (
                                <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700 ring-1 ring-emerald-100">
                                  Konum Var
                                </span>
                              ) : (
                                <span className="rounded-full bg-neutral-100 px-2 py-0.5 font-semibold text-neutral-500 ring-1 ring-neutral-200">
                                  Konum Yok
                                </span>
                              )}
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* toast */}
      {info && (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm text-neutral-800 shadow-lg">
          {info}
        </div>
      )}
    </div>
  );
}
