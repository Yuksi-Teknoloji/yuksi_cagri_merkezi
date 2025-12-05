// src/app/dashboard/supports/couriers/courier-stats/page.tsx
'use client';

import * as React from 'react';
import { getAuthToken } from '@/src/utils/auth';
import { useSupportAccess } from '@/src/hooks/useSupportAccess';

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

function pct(a: number, b: number) {
    if (!b) return 0;
    return Math.max(0, Math.min(100, Math.round((a / b) * 100)));
}

function fmtTRY(n?: number | null) {
    if (n == null) return '-';
    try {
        return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });
    } catch {
        return String(n);
    }
}

/* ========= types ========= */

type CourierApi = {
    id: string;
    firstName?: string;
    lastName?: string;
    first_name?: string;
    last_name?: string;
    phone?: string | null;
    email?: string | null;
};

type Courier = {
    id: string;
    fullName: string;
    phone: string | null;
    email: string | null;
};

type CourierListResponse = {
    success?: boolean;
    message?: string;
    data?: CourierApi[];
};

type CourierStatus = {
    isOnline?: boolean;
    isOnBreak?: boolean;
    lastBreakStart?: string | null;
    lastStatusChange?: string | null;
    [key: string]: any;
};

type CourierPackageInfo = {
    packageType?: string | null;
    maxPackage?: number | null;
    deliveredCount?: number | null;
    activeCount?: number | null;
    remainingPackages?: number | null;
    hasPackageLeft?: boolean | null;
    note?: string | null;
    updatedAt?: string | null;

    price?: number | null;
    startDate?: string | null;
    endDate?: string | null;
    remainingDays?: number | null;
    activityDays?: number | null;
    activityHours?: number | null;

    [key: string]: any;
};

type CourierStats = {
    courierId?: string;
    fullName?: string;
    // API:
    deliveredPackagesCount?: number;
    totalDistanceKm?: number;
    dailyDistanceKm?: number;
    package?: any;
    isOnBreak?: boolean;
    lastStatusChange?: string;

    // olası ekstra alanlar:
    deliveredPackageCount?: number;
    activePackageCount?: number;
    canceledPackageCount?: number;
    averageDeliveryTimeMinutes?: number;
    lastDeliveredAt?: string | null;
    lastLocationUpdate?: string | null;
    status?: CourierStatus;
    packageInfo?: CourierPackageInfo;
    package_info?: CourierPackageInfo;
    [key: string]: any;
};

type CourierStatsResponse = {
    success?: boolean;
    message?: string;
    data?: CourierStats;
};

type CourierStatsMeta = {
    success?: boolean;
    message?: string;
};

/* ========= page ========= */

export default function CourierStatsPage() {
    const token = React.useMemo(() => getAuthToken(), []);
    const headers = React.useMemo<HeadersInit>(() => bearerHeaders(token), [token]);

    const { access } = useSupportAccess();
    const hasCourierAccess = !access ? null : access.includes(1);

    const [couriers, setCouriers] = React.useState<Courier[]>([]);
    const [loadingCouriers, setLoadingCouriers] = React.useState(false);
    const [courierError, setCourierError] = React.useState<string | null>(null);

    const [limit, setLimit] = React.useState<number | ''>('');
    const [offset, setOffset] = React.useState<number>(0);
    const [search, setSearch] = React.useState('');

    const [selectedId, setSelectedId] = React.useState<string>('');

    const [stats, setStats] = React.useState<CourierStats | null>(null);
    const [statsMeta, setStatsMeta] = React.useState<CourierStatsMeta | null>(null);
    const [statsLoading, setStatsLoading] = React.useState(false);
    const [statsError, setStatsError] = React.useState<string | null>(null);

    /* ---- Couriers load ---- */
    const loadCouriers = React.useCallback(
        async () => {
            if (!token) {
                setCourierError('Oturum bulunamadı.');
                setCouriers([]);
                return;
            }

            setLoadingCouriers(true);
            setCourierError(null);

            try {
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
                    const first = String(x.first_name ?? x.firstName ?? '').trim();
                    const last = String(x.last_name ?? x.lastName ?? '').trim();
                    const fullName = (first + ' ' + last).trim() || `#${x.id}`;

                    return {
                        id: String(x.id),
                        fullName,
                        phone: (x.phone as any) ?? null,
                        email: (x.email as any) ?? null,
                    };
                });

                setCouriers(mapped);

                if (!selectedId && mapped.length > 0) {
                    setSelectedId(mapped[0].id);
                }
            } catch (e: any) {
                setCourierError(e?.message || 'Kurye listesi getirilemedi.');
                setCouriers([]);
            } finally {
                setLoadingCouriers(false);
            }
        },
        [headers, limit, offset, search, token, selectedId],
    );

    React.useEffect(() => {
        if (hasCourierAccess === null) return;
        if (!hasCourierAccess) return;
        loadCouriers();
    }, [loadCouriers, hasCourierAccess]);

    /* ---- Stats load (seçili kurye değiştiğinde) ---- */
    React.useEffect(() => {
        if (!selectedId || !token) return;

        let cancelled = false;

        async function loadStats() {
            setStatsLoading(true);
            setStatsError(null);
            setStats(null);
            setStatsMeta(null);

            try {
                const url = new URL(
                    `/yuksi/support/couriers/${selectedId}/stats`,
                    window.location.origin,
                );

                const res = await fetch(url.toString(), {
                    headers,
                    cache: 'no-store',
                });

                const data = await readJson<CourierStatsResponse>(res);

                if (!res.ok || (data && (data as any).success === false)) {
                    throw new Error(pickMsg(data, `HTTP ${res.status}`));
                }

                if (!cancelled) {
                    setStats((data as any)?.data ?? null);
                    setStatsMeta({
                        success: data?.success,
                        message: data?.message,
                    });
                }
            } catch (e: any) {
                if (!cancelled) {
                    setStatsError(e?.message || 'Kurye istatistikleri getirilemedi.');
                    setStats(null);
                    setStatsMeta(null);
                }
            } finally {
                if (!cancelled) setStatsLoading(false);
            }
        }

        loadStats();
        return () => {
            cancelled = true;
        };
    }, [selectedId, headers, token]);

    /* ---- Access yoksa ---- */
    if (hasCourierAccess === false) {
        return (
            <div className="rounded-2xl bg-white p-6 shadow">
                <h1 className="text-xl font-semibold mb-2">Kurye İstatistikleri</h1>
                <p className="text-sm text-rose-600">
                    Bu sayfayı görüntülemek için <strong>Kurye (Modül 1)</strong> yetkisine
                    sahip olmanız gerekiyor.
                </p>
            </div>
        );
    }

    const selectedCourier = couriers.find((c) => c.id === selectedId) || null;

    /* ==== normalize alanlar ==== */

    // Teslim edilen paket: deliveredPackagesCount öncelikli
    const deliveredCountNorm = React.useMemo(() => {
        if (!stats) return 0;
        const raw =
            stats.deliveredPackagesCount ??
            stats.deliveredPackageCount ??
            0;
        const num = Number(raw);
        return Number.isFinite(num) ? num : 0;
    }, [stats]);

    // Paket bilgisi: packageInfo / package_info / package(JSON)
    const pkgRaw: CourierPackageInfo | null = React.useMemo(() => {
        if (!stats) return null;
        let base: CourierPackageInfo | null = null;

        const p1 = (stats as any).packageInfo || (stats as any).package_info;
        if (p1 && typeof p1 === 'object') base = { ...(p1 as any) };

        const p2 = (stats as any).package;
        if (p2) {
            let parsed: any = p2;
            if (typeof p2 === 'string') {
                try { parsed = JSON.parse(p2); } catch { parsed = null; }
            }
            if (parsed && typeof parsed === 'object') {
                base = {
                    ...(base || {}),
                    packageType: parsed.packageName ?? (base as any)?.packageType,
                    maxPackage: parsed.durationDays ?? (base as any)?.maxPackage,
                    price: parsed.price ?? (base as any)?.price,
                    startDate: parsed.startDate ?? (base as any)?.startDate,
                    endDate: parsed.endDate ?? (base as any)?.endDate,
                    remainingDays: parsed.remainingDays ?? (base as any)?.remainingDays,
                    activityDays: parsed.activityDays ?? (base as any)?.activityDays,
                    activityHours: parsed.activityHours ?? (base as any)?.activityHours,
                };
            }
        }

        return base;
    }, [stats]);

    const pkgMax = pkgRaw?.maxPackage ?? (pkgRaw as any)?.max_package ?? null;
    const pkgDelivered =
        pkgRaw?.deliveredCount ??
        (pkgRaw as any)?.delivered_count ??
        deliveredCountNorm ??
        null;
    const pkgRemaining =
        pkgRaw?.remainingPackages ??
        (pkgRaw as any)?.remaining_packages ??
        null;
    const pkgHasLeft =
        pkgRaw?.hasPackageLeft ??
        (pkgRaw as any)?.has_package_left ??
        null;
    const pkgType = pkgRaw?.packageType ?? (pkgRaw as any)?.package_type ?? null;
    const pkgNote = pkgRaw?.note ?? null;
    const pkgUpdatedAt =
        pkgRaw?.updatedAt ?? (pkgRaw as any)?.updated_at ?? null;

    const pkgPrice = pkgRaw?.price ?? null;
    const pkgStart = pkgRaw?.startDate ?? null;
    const pkgEnd = pkgRaw?.endDate ?? null;
    const pkgRemainingDays = pkgRaw?.remainingDays ?? null;
    const pkgActivityDays = pkgRaw?.activityDays ?? null;
    const pkgActivityHours = pkgRaw?.activityHours ?? null;

    const percentUsed = React.useMemo(() => {
        if (pkgMax == null || pkgDelivered == null) return 0;
        return pct(Number(pkgDelivered), Number(pkgMax));
    }, [pkgMax, pkgDelivered]);

    const isOnBreakValue =
        stats?.status?.isOnBreak ?? (stats as any)?.isOnBreak ?? null;

    const lastStatusChangeValue =
        stats?.status?.lastStatusChange ??
        (stats as any)?.lastStatusChange ??
        null;

    // ekstra alanlar (ham json yok, package yok)
    const extraEntries = React.useMemo(() => {
        if (!stats) return [] as [string, any][];
        const exclude = new Set([
            'courierId',
            'fullName',
            'deliveredPackagesCount',
            'deliveredPackageCount',
            'activePackageCount',
            'canceledPackageCount',
            'totalDistanceKm',
            'dailyDistanceKm',
            'averageDeliveryTimeMinutes',
            'lastDeliveredAt',
            'lastLocationUpdate',
            'status',
            'packageInfo',
            'package_info',
            'package',
            'isOnBreak',
            'lastStatusChange',
        ]);
        return Object.entries(stats).filter(([k]) => !exclude.has(k));
    }, [stats]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Kurye İstatistikleri</h1>
                    <p className="text-sm text-neutral-600">
                        Çağrı merkezi için kuryelerin performans ve durum bilgilerini görüntüleyin.
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
                        onClick={loadCouriers}
                        className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-orange-600"
                    >
                        Yenile
                    </button>
                </div>
            </div>

            {/* Ana kart */}
            <section className="rounded-2xl border border-neutral-200/70 bg-white shadow-sm p-4 space-y-4">
                {/* üst satır: search + select */}
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div className="flex-1">
                        <label className="mb-1 block text-xs font-semibold text-neutral-700">
                            Kurye Ara
                        </label>
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Ara: ad, soyad, telefon…"
                            className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-neutral-800 outline-none ring-2 ring-transparent transition placeholder:text-neutral-400 focus:bg-white focus:ring-orange-200"
                        />
                        <p className="mt-1 text-xs text-neutral-500">
                            Toplam {couriers.length} kurye listelendi.
                        </p>
                    </div>

                    <div className="w-full md:w-80">
                        <label className="mb-1 block text-xs font-semibold text-neutral-700">
                            Kurye Seç
                        </label>
                        <select
                            value={selectedId}
                            onChange={(e) => setSelectedId(e.target.value)}
                            className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-orange-200"
                        >
                            {!selectedId && <option value="">Kurye seçin…</option>}
                            {couriers.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.fullName} (#{c.id})
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {courierError && (
                    <div className="px-1 pt-1 text-sm text-rose-600">{courierError}</div>
                )}

                {/* stats area */}
                <div className="mt-2 rounded-2xl border border-neutral-100 bg-neutral-50/70 p-4">
                    {!selectedId && (
                        <div className="text-sm text-neutral-500">
                            Lütfen üstteki listeden bir kurye seçin.
                        </div>
                    )}

                    {selectedId && statsLoading && (
                        <div className="text-sm text-neutral-500">
                            Kurye istatistikleri yükleniyor…
                        </div>
                    )}

                    {selectedId && statsError && !statsLoading && (
                        <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 border border-rose-200">
                            {statsError}
                        </div>
                    )}

                    {selectedId && !statsLoading && !statsError && stats && (
                        <div className="space-y-4">
                            {/* başlık + temel bilgiler */}
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <div className="text-sm font-semibold text-neutral-600">
                                        Seçili Kurye
                                    </div>
                                    <div className="text-lg font-semibold text-neutral-900">
                                        {stats.fullName || selectedCourier?.fullName || `#${selectedId}`}
                                    </div>
                                    {selectedCourier && (
                                        <div className="mt-1 text-xs text-neutral-600">
                                            {selectedCourier.phone && <span>{selectedCourier.phone}</span>}
                                            {selectedCourier.phone && selectedCourier.email && <span> · </span>}
                                            {selectedCourier.email && <span>{selectedCourier.email}</span>}
                                        </div>
                                    )}
                                </div>
                                <div className="text-xs text-neutral-500 text-right">
                                    <div>
                                        Kurye ID:{' '}
                                        <span className="font-mono">
                                            {stats.courierId || selectedId}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* metric kart grid */}
                            <div className="grid gap-3 md:grid-cols-4 sm:grid-cols-2">
                                <StatCard
                                    label="Teslim Edilen Paket"
                                    value={deliveredCountNorm}
                                    accent="emerald"
                                />
                                <StatCard
                                    label="Toplam Mesafe (km)"
                                    value={
                                        stats.totalDistanceKm != null
                                            ? Number(stats.totalDistanceKm).toFixed(1)
                                            : '-'
                                    }
                                    accent="amber"
                                />
                                {'dailyDistanceKm' in stats && (
                                    <StatCard
                                        label="Günlük Mesafe (km)"
                                        value={
                                            stats.dailyDistanceKm != null
                                                ? Number(stats.dailyDistanceKm).toFixed(1)
                                                : '0.0'
                                        }
                                        accent="sky"
                                    />
                                )}
                                {'averageDeliveryTimeMinutes' in stats && (
                                    <StatCard
                                        label="Ortalama Teslim Süresi (dk)"
                                        value={
                                            stats.averageDeliveryTimeMinutes != null
                                                ? Number(stats.averageDeliveryTimeMinutes).toFixed(1)
                                                : '-'
                                        }
                                        accent="indigo"
                                    />
                                )}
                            </div>

                            {/* zaman ve durum bilgileri */}
                            <div className="grid gap-3 md:grid-cols-2">
                                <div className="rounded-xl border border-neutral-200 bg-white p-3">
                                    <div className="mb-2 text-sm font-semibold text-neutral-700">
                                        Zaman Bilgileri
                                    </div>
                                    <dl className="space-y-1 text-xs text-neutral-700">
                                        {'lastDeliveredAt' in stats && (
                                            <div className="flex justify-between gap-2">
                                                <dt className="text-neutral-500">Son Teslim</dt>
                                                <dd className="font-medium">
                                                    {fmtDate(stats.lastDeliveredAt as any)}
                                                </dd>
                                            </div>
                                        )}
                                        {'lastLocationUpdate' in stats && (
                                            <div className="flex justify-between gap-2">
                                                <dt className="text-neutral-500">Son Konum Güncelleme</dt>
                                                <dd className="font-medium">
                                                    {fmtDate(stats.lastLocationUpdate as any)}
                                                </dd>
                                            </div>
                                        )}
                                        {lastStatusChangeValue && (
                                            <div className="flex justify-between gap-2">
                                                <dt className="text-neutral-500">Son Durum Değişimi</dt>
                                                <dd className="font-medium">
                                                    {fmtDate(lastStatusChangeValue)}
                                                </dd>
                                            </div>
                                        )}
                                    </dl>
                                </div>

                                <div className="rounded-xl border border-neutral-200 bg-white p-3">
                                    <div className="mb-2 text-sm font-semibold text-neutral-700">
                                        Anlık Durum
                                    </div>
                                    <div className="space-y-2 text-xs text-neutral-700">
                                        {'isOnline' in (stats.status || {}) && (
                                            <div>
                                                <span className="mr-1 text-neutral-500">Çevrimiçi:</span>
                                                {stats.status!.isOnline ? (
                                                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700 ring-1 ring-emerald-100">
                                                        Evet
                                                    </span>
                                                ) : (
                                                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 font-semibold text-neutral-700 ring-1 ring-neutral-200">
                                                        Hayır
                                                    </span>
                                                )}
                                            </div>
                                        )}

                                        {typeof isOnBreakValue === 'boolean' && (
                                            <div>
                                                <span className="mr-1 text-neutral-500">Şu an molada mı?</span>
                                                {isOnBreakValue ? (
                                                    <span className="rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-700 ring-1 ring-amber-100">
                                                        Evet (Molada)
                                                    </span>
                                                ) : (
                                                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700 ring-1 ring-emerald-100">
                                                        Hayır (Aktif)
                                                    </span>
                                                )}
                                            </div>
                                        )}

                                        {stats.status &&
                                            Object.entries(stats.status)
                                                .filter(
                                                    ([k]) =>
                                                        k !== 'isOnline' &&
                                                        k !== 'isOnBreak' &&
                                                        k !== 'lastBreakStart' &&
                                                        k !== 'lastStatusChange',
                                                )
                                                .map(([k, v]) => (
                                                    <div key={k} className="flex justify-between gap-2">
                                                        <span className="text-neutral-500">{k}</span>
                                                        <span className="font-medium">
                                                            {typeof v === 'string' ||
                                                                typeof v === 'number' ||
                                                                typeof v === 'boolean'
                                                                ? String(v)
                                                                : JSON.stringify(v)}
                                                        </span>
                                                    </div>
                                                ))}
                                        {!stats.status && typeof isOnBreakValue === 'undefined' && (
                                            <div className="text-neutral-500">
                                                Durum bilgisi bulunamadı.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Paket Bilgisi */}
                            <div className="rounded-2xl border border-neutral-200/70 bg-white shadow-sm">
                                <div className="border-b px-4 py-3">
                                    <h2 className="text-sm font-semibold text-neutral-800">
                                        Paket Bilgisi
                                    </h2>
                                </div>

                                {pkgRaw ? (
                                    <div className="p-4 space-y-4">
                                        {/* üst kartlar */}
                                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                            <StatBox title="Paket Adı" value={pkgType || '-'} />
                                            <StatBox title="Paket Süresi (gün)" value={pkgMax ?? '-'} />
                                            <StatBox
                                                title="Paket Ücreti"
                                                value={pkgPrice != null ? fmtTRY(pkgPrice) : '-'}
                                            />
                                            <StatBox
                                                title="Teslim Edilen Paket"
                                                value={pkgDelivered ?? '-'}
                                            />
                                            <StatBox title="Kalan Gün" value={pkgRemainingDays ?? '-'} />
                                            <StatBox title="Aktif Çalışılan Gün" value={pkgActivityDays ?? '-'} />
                                            <StatBox
                                                title="Aktif Çalışılan Saat"
                                                value={pkgActivityHours ?? '-'}
                                            />
                                            <StatBox
                                                title="Paket Hakkı"
                                                value={
                                                    pkgHasLeft === false
                                                        ? 'Bitmiş'
                                                        : pkgHasLeft === true
                                                            ? 'Var'
                                                            : '-'
                                                }
                                            />
                                        </div>

                                        {/* progress bar */}
                                        {pkgMax != null && pkgDelivered != null && (
                                            <div>
                                                <div className="mb-1 flex items-center justify-between text-sm">
                                                    <span className="text-neutral-600">Kullanım</span>
                                                    <span className="ml-1 font-medium text-neutral-800">
                                                        {percentUsed}%
                                                    </span>
                                                </div>
                                                <div className="h-3 w-full overflow-hidden rounded-full bg-neutral-100">
                                                    <div
                                                        className="h-3 rounded-full bg-emerald-500 transition-[width]"
                                                        style={{ width: `${percentUsed}%` }}
                                                    />
                                                </div>
                                                <div className="mt-1 text-xs text-neutral-500">
                                                    {pkgDelivered ?? 0} / {pkgMax ?? 0} teslimat kullanıldı
                                                    {pkgHasLeft === false && (
                                                        <span className="ml-2 rounded-md bg-rose-50 px-2 py-0.5 font-semibold text-rose-600 ring-1 ring-rose-100">
                                                            Paket hakkı bitmiş
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* detay alanlar */}
                                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                            <InfoBox
                                                title="Paket Başlama Tarihi"
                                                value={fmtDate(pkgStart)}
                                            />
                                            <InfoBox
                                                title="Paket Bitiş Tarihi"
                                                value={fmtDate(pkgEnd)}
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="px-4 py-4 text-sm text-neutral-500">
                                        Bu kurye için paket bilgisi bulunamadı.
                                    </div>
                                )}
                            </div>

                            {/* ekstra alanlar */}
                            {extraEntries.length > 0 && (
                                <div className="rounded-xl border border-neutral-200 bg-white p-3">
                                    <div className="mb-2 flex items-center justify-between">
                                        <div className="text-xs font-semibold text-neutral-700">
                                            Diğer Alanlar
                                        </div>
                                        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600">
                                            {extraEntries.length} alan
                                        </span>
                                    </div>
                                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                        {extraEntries.map(([k, v]) => (
                                            <div
                                                key={k}
                                                className="flex flex-col gap-1 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2"
                                            >
                                                <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                                                    {k}
                                                </div>
                                                <div className="text-xs text-neutral-800 break-words">
                                                    {typeof v === 'string' ||
                                                        typeof v === 'number' ||
                                                        typeof v === 'boolean'
                                                        ? String(v)
                                                        : JSON.stringify(v)}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {selectedId && !statsLoading && !statsError && !stats && (
                        <div className="text-sm text-neutral-500">
                            Seçilen kurye için istatistik verisi bulunamadı.
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}

/* ========= küçük stat kartı ========= */

function StatCard({
    label,
    value,
    accent,
}: {
    label: string;
    value: React.ReactNode;
    accent: 'emerald' | 'sky' | 'rose' | 'amber' | 'indigo';
}) {
    const colorMap: Record<typeof accent, string> = {
        emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
        sky: 'bg-sky-50 text-sky-700 ring-sky-100',
        rose: 'bg-rose-50 text-rose-700 ring-rose-100',
        amber: 'bg-amber-50 text-amber-700 ring-amber-100',
        indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-100',
    };
    return (
        <div className="flex flex-col gap-1 rounded-xl border border-neutral-200 bg-white p-3">
            <div className="text-xs font-medium text-neutral-600">{label}</div>
            <div
                className={
                    'inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ring-1 ' +
                    colorMap[accent]
                }
            >
                {value}
            </div>
        </div>
    );
}

/* ====== paket kısmı için küçük box bileşenleri ====== */

function StatBox({ title, value }: { title: string; value: React.ReactNode }) {
    return (
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="text-sm text-neutral-500">{title}</div>
            <div className="mt-1 text-2xl font-semibold text-neutral-900">
                {value ?? '-'}
            </div>
        </div>
    );
}

function InfoBox({
    title,
    value,
}: {
    title: string;
    value?: React.ReactNode;
}) {
    return (
        <div>
            <div className="mb-1 text-sm font-medium text-neutral-700">{title}</div>
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-900">
                {value ?? '-'}
            </div>
        </div>
    );
}
