//src/app/dashboard/commercial/page.tsx
'use client';

import * as React from 'react';
import { getAuthToken } from '@/src/utils/auth';

/* ========= Helpers ========= */
async function readJson<T = any>(res: Response): Promise<T> {
    const t = await res.text();
    try {
        return t ? JSON.parse(t) : (null as any);
    } catch {
        return t as any;
    }
}
const pickMsg = (d: any, fb: string) => d?.error?.message || d?.message || d?.detail || d?.title || fb;

function collectErrors(x: any): string {
    const msgs: string[] = [];
    if (x?.message) msgs.push(String(x.message));
    if (x?.data?.message) msgs.push(String(x.data.message));
    const err = x?.errors || x?.error || x?.detail;

    if (Array.isArray(err)) {
        for (const it of err) {
            if (typeof it === 'string') msgs.push(it);
            else if (it && typeof it === 'object') {
                const loc = Array.isArray((it as any).loc) ? (it as any).loc.join('.') : (it as any).loc ?? '';
                const m = (it as any).msg || (it as any).message || (it as any).detail;
                if (loc && m) msgs.push(`${loc}: ${m}`);
                else if (m) msgs.push(String(m));
            }
        }
    } else if (err && typeof err === 'object') {
        for (const [k, v] of Object.entries(err)) {
            if (Array.isArray(v)) (v as any[]).forEach((m) => msgs.push(`${k}: ${m}`));
            else if (v) msgs.push(`${k}: ${v}`);
        }
    }
    return msgs.join('\n');
}

const toNum = (v: unknown) => {
    if (typeof v === 'number') return v;
    const n = Number(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
};

function buildQuery(params: Record<string, any>) {
    const usp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v === undefined || v === null) continue;
        const s = String(v).trim();
        if (!s) continue;
        usp.set(k, s);
    }
    const q = usp.toString();
    return q ? `?${q}` : '';
}

type ListingStatus =
    | 'pending'
    | 'approved'
    | 'rejected'
    | 'sold'
    | 'removed'
    | 'in_review'
    | string;

type ListingAdmin = {
    id: string;
    title?: string | null;
    description?: string | null;
    brand?: string | null;
    model?: string | null;
    year?: number | null;
    km?: number | null;
    engine_size?: number | null;
    price?: number | null;
    location?: string | null;
    fuel_type?: string | null;
    transmission?: string | null;
    body_type?: string | null;
    color?: string | null;
    condition?: string | null;
    heavy_damage_recorded?: boolean | null;
    source?: string | null;
    plate?: string | null;
    nationality?: string | null;
    phone?: string | null;
    status?: ListingStatus | null;

    admin_notes?: string | null;
    created_at?: string | null;

    user_name?: string | null;
    user_email?: string | null;
};

/* ========= Options ========= */
const FUEL_TYPES = ['gasoline', 'diesel', 'electric', 'hybrid', 'lpg'] as const;
const CONDITIONS = ['new', 'second_hand', 'damaged'] as const;
const TRANSMISSIONS = ['manual', 'automatic', 'semi_automatic'] as const;
const SOURCES = ['user', 'sahibinden', 'gallery', 'other'] as const;

// body.body_type validation: Input should be 'motorsiklet', 'minivan', 'panelvan', 'kamyonet' or 'kamyon'
const BODY_TYPES = ['motorsiklet', 'minivan', 'panelvan', 'kamyonet', 'kamyon'] as const;

type UpdateAdminBody = {
    title: string;
    description: string;
    brand: string;
    model: string;
    year: number;
    km: number;
    engine_size: number;
    fuel_type: string;
    transmission: string;
    body_type: string;
    color: string;
    condition: string;
    heavy_damage_recorded: boolean;
    source: string;
    plate: string;
    nationality: string;
    price: number;
    location: string;
    phone: string;
    image_file_ids?: string[]; // swagger örneğinde var; opsiyonel bıraktım
};

function Badge({
    children,
    tone = 'neutral',
}: {
    children: React.ReactNode;
    tone?: 'neutral' | 'ok' | 'warn' | 'bad';
}) {
    const cls =
        tone === 'ok'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : tone === 'warn'
                ? 'border-amber-200 bg-amber-50 text-amber-700'
                : tone === 'bad'
                    ? 'border-rose-200 bg-rose-50 text-rose-700'
                    : 'border-neutral-200 bg-neutral-50 text-neutral-700';
    return (
        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
            {children}
        </span>
    );
}

function StatLine({ k, v }: { k: string; v?: React.ReactNode }) {
    if (v === undefined || v === null || v === '') return null;
    return (
        <div className="flex items-start justify-between gap-4 text-sm">
            <span className="text-neutral-500">{k}</span>
            <span className="text-neutral-900 text-right whitespace-pre-line">{v}</span>
        </div>
    );
}

function statusTone(s?: string | null) {
    const x = String(s || '').toLowerCase();
    if (x === 'approved') return 'ok';
    if (x === 'pending' || x === 'in_review') return 'warn';
    if (x === 'rejected' || x === 'removed') return 'bad';
    if (x === 'sold') return 'neutral';
    return 'neutral';
}

/* ========= Page ========= */
type TabKey = 'pending' | 'all';

export default function TicarimAdminPage() {
    const token = React.useMemo(getAuthToken, []);
    const authHeaders = React.useMemo<HeadersInit>(
        () => ({
            Accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        }),
        [token],
    );

    /* ========= API ========= */
    async function apiGet(path: string) {
        const res = await fetch(path, { method: 'GET', cache: 'no-store', headers: authHeaders });
        const j = await readJson(res);
        if (!res.ok || (j && (j as any).success === false)) {
            throw new Error(collectErrors(j) || pickMsg(j, `HTTP ${res.status}`));
        }
        return j;
    }
    async function apiSend(path: string, method: 'PUT' | 'DELETE', body?: any) {
        const res = await fetch(path, {
            method,
            cache: 'no-store',
            headers: {
                ...authHeaders,
                ...(method === 'PUT' ? { 'Content-Type': 'application/json' } : {}),
            },
            body: method === 'PUT' ? JSON.stringify(body ?? {}) : undefined,
        });
        const j = await readJson(res);
        if (!res.ok || (j && (j as any).success === false)) {
            throw new Error(collectErrors(j) || pickMsg(j, `HTTP ${res.status}`));
        }
        return j;
    }

    /* ========= UI State ========= */
    const Card = React.useCallback(
        ({ children }: { children: React.ReactNode }) => (
            <section className="rounded-2xl border border-neutral-200/70 bg-white p-6 shadow-sm">{children}</section>
        ),
        [],
    );

    const [tab, setTab] = React.useState<TabKey>('pending');

    const [okMsg, setOkMsg] = React.useState<string | null>(null);
    const [errMsg, setErrMsg] = React.useState<string | null>(null);

    /* ========= Pending ========= */
    const [pending, setPending] = React.useState<ListingAdmin[]>([]);
    const [pendingLoading, setPendingLoading] = React.useState(false);
    const [pendingLimit, setPendingLimit] = React.useState(200);
    const [pendingOffset, setPendingOffset] = React.useState(0);

    /* ========= All ========= */
    const [allRows, setAllRows] = React.useState<ListingAdmin[]>([]);
    const [allLoading, setAllLoading] = React.useState(false);
    const [allLimit, setAllLimit] = React.useState(200);
    const [allOffset, setAllOffset] = React.useState(0);
    const [allStatus, setAllStatus] = React.useState<ListingStatus | ''>('');

    /* ========= Detail ========= */
    const [detailOpen, setDetailOpen] = React.useState(false);
    const [detail, setDetail] = React.useState<ListingAdmin | null>(null);

    /* ========= Edit ========= */
    const [editOpen, setEditOpen] = React.useState(false);
    const [editBusy, setEditBusy] = React.useState(false);
    const [editId, setEditId] = React.useState<string | null>(null);

    const emptyForm: UpdateAdminBody = React.useMemo(
        () => ({
            title: '',
            description: '',
            brand: '',
            model: '',
            year: 2020,
            km: 0,
            engine_size: 0,
            fuel_type: 'gasoline',
            transmission: 'manual',
            body_type: 'motorsiklet',
            color: '',
            condition: 'new',
            heavy_damage_recorded: false,
            source: 'user',
            plate: '',
            nationality: '',
            price: 0,
            location: '',
            phone: '',
            image_file_ids: [],
        }),
        [],
    );
    const [form, setForm] = React.useState<UpdateAdminBody>(emptyForm);

    /* ========= Action modal (approve/reject/remove) ========= */
    const [actOpen, setActOpen] = React.useState(false);
    const [actBusy, setActBusy] = React.useState(false);
    const [actType, setActType] = React.useState<'approve' | 'reject' | 'remove'>('approve');
    const [actListingId, setActListingId] = React.useState('');
    const [actNotes, setActNotes] = React.useState('');
    const [actAction, setActAction] = React.useState(''); // swagger: action:string (zorunlu olabilir)

    /* ========= Loaders ========= */
    const loadPending = React.useCallback(async () => {
        setPendingLoading(true);
        setErrMsg(null);
        try {
            const qs = buildQuery({ limit: pendingLimit, offset: pendingOffset });
            const j = await apiGet(`/yuksi/ticarim/admin/ilan/pending${qs}`);
            const arr: any[] = Array.isArray(j?.data) ? j.data : Array.isArray(j) ? j : [];
            setPending(arr as ListingAdmin[]);
        } catch (e: any) {
            setErrMsg(e?.message || 'Bekleyen ilanlar alınamadı.');
        } finally {
            setPendingLoading(false);
        }
    }, [pendingLimit, pendingOffset]);

    const loadAll = React.useCallback(async () => {
        setAllLoading(true);
        setErrMsg(null);
        try {
            const qs = buildQuery({ limit: allLimit, offset: allOffset, status: allStatus || undefined });
            const j = await apiGet(`/yuksi/ticarim/admin/ilan${qs}`);
            const arr: any[] = Array.isArray(j?.data) ? j.data : Array.isArray(j) ? j : [];
            setAllRows(arr as ListingAdmin[]);
        } catch (e: any) {
            setErrMsg(e?.message || 'Tüm ilanlar alınamadı.');
        } finally {
            setAllLoading(false);
        }
    }, [allLimit, allOffset, allStatus]);

    React.useEffect(() => {
        if (!token) setErrMsg('Admin endpoint’ler için token gerekli (Authorization: Bearer).');
        // initial
        loadPending();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    React.useEffect(() => {
        if (tab === 'pending') loadPending();
        if (tab === 'all') loadAll();
    }, [tab, loadPending, loadAll]);

    /* ========= Row helpers ========= */
    const openDetail = (x: ListingAdmin) => {
        setDetail(x);
        setDetailOpen(true);
    };

    const startEdit = (x: ListingAdmin) => {
        setOkMsg(null);
        setErrMsg(null);
        setEditId(String(x.id));
        setForm({
            ...emptyForm,
            title: String(x.title ?? ''),
            description: String(x.description ?? ''),
            brand: String(x.brand ?? ''),
            model: String(x.model ?? ''),
            year: Math.max(1950, toNum(x.year ?? 2020)),
            km: Math.max(0, toNum(x.km ?? 0)),
            engine_size: Math.max(0, toNum(x.engine_size ?? 0)),
            fuel_type: String(x.fuel_type ?? emptyForm.fuel_type),
            transmission: String(x.transmission ?? emptyForm.transmission),
            body_type: BODY_TYPES.includes((x.body_type as any) ?? 'motorsiklet')
                ? String(x.body_type)
                : 'motorsiklet',
            color: String(x.color ?? ''),
            condition: String(x.condition ?? emptyForm.condition),
            heavy_damage_recorded: Boolean(x.heavy_damage_recorded ?? false),
            source: String(x.source ?? emptyForm.source),
            plate: String(x.plate ?? ''),
            nationality: String(x.nationality ?? ''),
            price: Math.max(0, toNum(x.price ?? 0)),
            location: String(x.location ?? ''),
            phone: String(x.phone ?? ''),
            image_file_ids: [], // admin update için istersen ekleyeceğiz, şimdilik boş
        });
        setEditOpen(true);
    };

    async function submitEdit(e: React.FormEvent) {
        e.preventDefault();
        if (!editId) return;

        setOkMsg(null);
        setErrMsg(null);
        setEditBusy(true);
        try {
            const body: UpdateAdminBody = {
                ...form,
                year: Math.max(1950, toNum(form.year)),
                km: Math.max(0, toNum(form.km)),
                engine_size: Math.max(0, toNum(form.engine_size)),
                price: Math.max(0, toNum(form.price)),
                body_type: BODY_TYPES.includes(form.body_type as any) ? form.body_type : 'motorsiklet',
                image_file_ids: (form.image_file_ids || []).filter(Boolean),
            };

            const j = await apiSend(`/yuksi/ticarim/admin/ilan/${encodeURIComponent(editId)}`, 'PUT', body);
            setOkMsg(j?.message || 'İlan güncellendi (Admin).');
            setEditOpen(false);
            setEditId(null);

            if (tab === 'pending') await loadPending();
            if (tab === 'all') await loadAll();
        } catch (e: any) {
            setErrMsg(e?.message || 'Admin güncelleme başarısız.');
        } finally {
            setEditBusy(false);
        }
    }

    async function removeByAdmin(id: string) {
        setOkMsg(null);
        setErrMsg(null);
        try {
            const j = await apiSend(`/yuksi/ticarim/admin/ilan/${encodeURIComponent(id)}`, 'DELETE');
            setOkMsg(j?.message || 'İlan silindi (Admin).');

            if (tab === 'pending') await loadPending();
            if (tab === 'all') await loadAll();
        } catch (e: any) {
            setErrMsg(e?.message || 'Silme başarısız (Admin).');
        }
    }

    const openActionModal = (type: 'approve' | 'reject' | 'remove', id: string) => {
        setActType(type);
        setActListingId(String(id));
        setActNotes('');
        setActAction(type); // default: action alanını type ile doldur
        setActOpen(true);
    };

    async function submitAction(e: React.FormEvent) {
        e.preventDefault();
        const id = actListingId.trim();
        if (!id) return;

        setOkMsg(null);
        setErrMsg(null);
        setActBusy(true);
        try {
            const endpoint =
                actType === 'approve'
                    ? `/yuksi/ticarim/admin/ilan/${encodeURIComponent(id)}/approve`
                    : actType === 'reject'
                        ? `/yuksi/ticarim/admin/ilan/${encodeURIComponent(id)}/reject`
                        : `/yuksi/ticarim/admin/ilan/${encodeURIComponent(id)}/remove`;

            const body = {
                action: actAction || actType, // swagger: action:string
                notes: actNotes || '',
            };

            const j = await apiSend(endpoint, 'PUT', body);
            setOkMsg(j?.message || `İşlem başarılı: ${actType}`);
            setActOpen(false);

            if (tab === 'pending') await loadPending();
            if (tab === 'all') await loadAll();
        } catch (e: any) {
            setErrMsg(e?.message || `İşlem başarısız: ${actType}`);
        } finally {
            setActBusy(false);
        }
    }

    const ListingRow = ({ x }: { x: ListingAdmin }) => {
        const title = String(x.title ?? '(Başlıksız)');
        const subtitle = [x.brand ? String(x.brand) : '', x.model ? String(x.model) : '', x.year ? String(x.year) : '']
            .filter(Boolean)
            .join(' • ');

        const price = x.price != null ? `${toNum(x.price).toLocaleString('tr-TR')}₺` : '—';

        return (
            <div className="flex flex-col gap-3 rounded-2xl border border-neutral-200 p-4 hover:bg-neutral-50">
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => openDetail(x)}
                                className="truncate text-left text-sm font-semibold text-neutral-900 hover:underline"
                                title={title}
                            >
                                {title}
                            </button>
                            {x.status && <Badge tone={statusTone(x.status) as any}>{String(x.status)}</Badge>}
                        </div>
                        <div className="mt-1 text-xs text-neutral-500">{subtitle || '—'}</div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-neutral-600">
                            {x.location ? <span className="rounded-full bg-neutral-100 px-2 py-0.5">{String(x.location)}</span> : null}
                            {x.km != null ? (
                                <span className="rounded-full bg-neutral-100 px-2 py-0.5">
                                    {toNum(x.km).toLocaleString('tr-TR')} km
                                </span>
                            ) : null}
                            {x.body_type ? <span className="rounded-full bg-neutral-100 px-2 py-0.5">{String(x.body_type)}</span> : null}
                            {x.fuel_type ? <span className="rounded-full bg-neutral-100 px-2 py-0.5">{String(x.fuel_type)}</span> : null}
                            {x.transmission ? <span className="rounded-full bg-neutral-100 px-2 py-0.5">{String(x.transmission)}</span> : null}
                        </div>
                    </div>

                    <div className="shrink-0 text-right">
                        <div className="text-sm font-semibold text-neutral-900">{price}</div>
                        <div className="mt-1 text-xs text-neutral-500">{x.created_at ? String(x.created_at) : ''}</div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={() => openDetail(x)}
                        className="rounded-xl border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
                    >
                        Detay
                    </button>

                    <button
                        type="button"
                        onClick={() => startEdit(x)}
                        className="rounded-xl border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                    >
                        Düzenle (PUT)
                    </button>

                    <button
                        type="button"
                        onClick={() => openActionModal('approve', String(x.id))}
                        className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                    >
                        Onayla
                    </button>

                    <button
                        type="button"
                        onClick={() => openActionModal('reject', String(x.id))}
                        className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                    >
                        Reddet
                    </button>

                    <button
                        type="button"
                        onClick={() => openActionModal('remove', String(x.id))}
                        className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                    >
                        Yayından Kaldır
                    </button>

                    <button
                        type="button"
                        onClick={() => removeByAdmin(String(x.id))}
                        className="rounded-xl border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
                        title="DELETE /ticarim/admin/ilan/{listing_id}"
                    >
                        Sil (DELETE)
                    </button>
                </div>
            </div>
        );
    };

    const tabs: Array<{ k: TabKey; t: string; d: string }> = [
        { k: 'pending', t: 'Bekleyen', d: 'GET /ticarim/admin/ilan/pending' },
        { k: 'all', t: 'Tümü', d: 'GET /ticarim/admin/ilan (status filtreli)' },
    ];

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-neutral-900">Ticarim-Çağrı Merkezi</h1>
                    <p className="mt-1 text-sm text-neutral-600">
                        Kullanıcı ilanlarını görüntüle, düzenle, onayla, reddet, yayından kaldır.
                    </p>
                </div>

                <div className="flex flex-wrap gap-2">
                    {tabs.map((x) => (
                        <button
                            key={x.k}
                            type="button"
                            onClick={() => {
                                setOkMsg(null);
                                setErrMsg(null);
                                setTab(x.k);
                            }}
                            className={[
                                'rounded-2xl px-4 py-2 text-sm font-semibold border shadow-sm transition',
                                tab === x.k
                                    ? 'bg-indigo-500 text-white border-indigo-500'
                                    : 'bg-white text-neutral-800 border-neutral-300 hover:bg-neutral-50',
                            ].join(' ')}
                            title={x.d}
                        >
                            {x.t}
                        </button>
                    ))}
                </div>
            </div>

            {okMsg && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 whitespace-pre-line">
                    {okMsg}
                </div>
            )}
            {errMsg && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 whitespace-pre-line">
                    {errMsg}
                </div>
            )}

            {/* ===== Pending ===== */}
            {tab === 'pending' && (
                <Card>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="text-lg font-semibold">Bekleyen İlanlar</h2>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <label className="text-sm text-neutral-600">Limit</label>
                            <input
                                value={String(pendingLimit)}
                                onChange={(e) => setPendingLimit(Math.max(1, Math.min(200, toNum(e.target.value))))}
                                className="w-28 rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                            />
                            <label className="text-sm text-neutral-600">Offset</label>
                            <input
                                value={String(pendingOffset)}
                                onChange={(e) => setPendingOffset(Math.max(0, toNum(e.target.value)))}
                                className="w-28 rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                            />
                            <button
                                type="button"
                                onClick={loadPending}
                                className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-600 disabled:opacity-60"
                                disabled={pendingLoading}
                            >
                                {pendingLoading ? 'Yükleniyor…' : 'Yenile'}
                            </button>
                        </div>
                    </div>

                    <div className="mt-5 grid gap-3">
                        {pendingLoading && <div className="text-sm text-neutral-500">Yükleniyor…</div>}
                        {!pendingLoading && pending.length === 0 && <div className="text-sm text-neutral-500">Kayıt yok.</div>}
                        {pending.map((x) => (
                            <ListingRow key={String(x.id)} x={x} />
                        ))}
                    </div>
                </Card>
            )}

            {/* ===== All ===== */}
            {tab === 'all' && (
                <Card>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="text-lg font-semibold">Tüm İlanlar</h2>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <label className="text-sm text-neutral-600">Status</label>
                            <select
                                value={allStatus}
                                onChange={(e) => setAllStatus(e.target.value as any)}
                                className="w-48 rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                            >
                                <option value="">(hepsi)</option>
                                <option value="pending">Beklemede</option>
                                <option value="approved">Onaylandı</option>
                                <option value="rejected">Reddedildi</option>
                                <option value="sold">Satıldı</option>
                                <option value="removed">Kaldırıldı</option>
                            </select>

                            <label className="text-sm text-neutral-600">Limit</label>
                            <input
                                value={String(allLimit)}
                                onChange={(e) => setAllLimit(Math.max(1, Math.min(200, toNum(e.target.value))))}
                                className="w-28 rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                            />
                            <label className="text-sm text-neutral-600">Offset</label>
                            <input
                                value={String(allOffset)}
                                onChange={(e) => setAllOffset(Math.max(0, toNum(e.target.value)))}
                                className="w-28 rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                            />

                            <button
                                type="button"
                                onClick={loadAll}
                                className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-600 disabled:opacity-60"
                                disabled={allLoading}
                            >
                                {allLoading ? 'Yükleniyor…' : 'Yenile'}
                            </button>
                        </div>
                    </div>

                    <div className="mt-5 grid gap-3">
                        {allLoading && <div className="text-sm text-neutral-500">Yükleniyor…</div>}
                        {!allLoading && allRows.length === 0 && <div className="text-sm text-neutral-500">Kayıt yok.</div>}
                        {allRows.map((x) => (
                            <ListingRow key={String(x.id)} x={x} />
                        ))}
                    </div>
                </Card>
            )}

            {/* ===== Detail Modal ===== */}
            {detailOpen && detail && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
                    <div className="w-full max-w-3xl rounded-2xl border border-neutral-200 bg-white shadow-xl overflow-hidden max-h-[85vh]">
                        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
                            <div className="min-w-0">
                                <div className="text-sm font-semibold text-neutral-900 truncate">İlan Detayı (Çağrı Merkezi)</div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setDetailOpen(false)}
                                className="rounded-xl border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-neutral-50"
                            >
                                Kapat
                            </button>
                        </div>

                        <div className="p-5">
                            <div className="grid gap-4 lg:grid-cols-2">
                                <div className="space-y-2">
                                    <div className="text-lg font-semibold text-neutral-900">{detail.title || '—'}</div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        {detail.status && <Badge tone={statusTone(detail.status) as any}>{String(detail.status)}</Badge>}
                                        {detail.admin_notes ? <Badge tone="neutral">admin_notes</Badge> : null}
                                    </div>

                                    <div className="rounded-2xl border border-neutral-200 p-4 space-y-2">
                                        <StatLine k="ID" v={detail.id} />
                                        <StatLine k="Marka" v={detail.brand ?? undefined} />
                                        <StatLine k="Model" v={detail.model ?? undefined} />
                                        <StatLine k="Yıl" v={detail.year ?? undefined} />
                                        <StatLine k="KM" v={detail.km != null ? `${toNum(detail.km).toLocaleString('tr-TR')} km` : undefined} />
                                        <StatLine k="Motor" v={detail.engine_size != null ? `${toNum(detail.engine_size)} cc` : undefined} />
                                        <StatLine k="Yakıt" v={detail.fuel_type ?? undefined} />
                                        <StatLine k="Vites" v={detail.transmission ?? undefined} />
                                        <StatLine k="Kasa" v={detail.body_type ?? undefined} />
                                        <StatLine k="Renk" v={detail.color ?? undefined} />
                                        <StatLine k="Durum" v={detail.condition ?? undefined} />
                                        <StatLine
                                            k="Ağır Hasar"
                                            v={detail.heavy_damage_recorded != null ? String(Boolean(detail.heavy_damage_recorded)) : undefined}
                                        />
                                        <StatLine k="Fiyat" v={detail.price != null ? `${toNum(detail.price).toLocaleString('tr-TR')}₺` : undefined} />
                                        <StatLine k="Konum" v={detail.location ?? undefined} />
                                        <StatLine k="Telefon" v={detail.phone ?? undefined} />
                                        <StatLine k="Plaka" v={detail.plate ?? undefined} />
                                        <StatLine k="Uyruk" v={detail.nationality ?? undefined} />
                                        <StatLine k="Açıklama" v={detail.description ?? undefined} />
                                        <StatLine k="Admin Not" v={detail.admin_notes ?? undefined} />
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                                        <div className="text-sm font-semibold text-neutral-900">Kullanıcı Bilgisi</div>
                                        <div className="mt-2 space-y-2">
                                            <StatLine k="user_name" v={detail.user_name ?? undefined} />
                                            <StatLine k="user_email" v={detail.user_email ?? undefined} />
                                            <StatLine k="created_at" v={detail.created_at ?? undefined} />
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setDetailOpen(false);
                                                startEdit(detail);
                                            }}
                                            className="rounded-xl border border-indigo-300 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                                        >
                                            Düzenle (PUT)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => openActionModal('approve', String(detail.id))}
                                            className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                                        >
                                            Onayla
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => openActionModal('reject', String(detail.id))}
                                            className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                                        >
                                            Reddet
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => openActionModal('remove', String(detail.id))}
                                            className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                                        >
                                            Yayından Kaldır
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => removeByAdmin(String(detail.id))}
                                            className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
                                        >
                                            Sil (DELETE)
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== Edit Modal ===== */}
            {editOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
                    <div className="w-full max-w-3xl rounded-2xl border border-neutral-200 bg-white shadow-xl">
                        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
                            <div className="min-w-0">
                                <div className="text-sm font-semibold text-neutral-900 truncate">İlan Güncelle (Admin)</div>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setEditOpen(false);
                                    setEditId(null);
                                }}
                                className="rounded-xl border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-neutral-50"
                            >
                                Kapat
                            </button>
                        </div>

                        <div className="p-5 overflow-y-auto max-h-[calc(85vh-72px)]">
                            <form onSubmit={submitEdit} className="grid gap-4">
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div>
                                        <label className="mb-1 block text-sm font-semibold">Başlık</label>
                                        <input
                                            value={form.title}
                                            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                                            className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-sm font-semibold">Fiyat</label>
                                        <input
                                            value={String(form.price)}
                                            onChange={(e) => setForm((p) => ({ ...p, price: toNum(e.target.value) }))}
                                            className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                                        />
                                    </div>

                                    <div>
                                        <label className="mb-1 block text-sm font-semibold">Marka</label>
                                        <input
                                            value={form.brand}
                                            onChange={(e) => setForm((p) => ({ ...p, brand: e.target.value }))}
                                            className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-sm font-semibold">Model</label>
                                        <input
                                            value={form.model}
                                            onChange={(e) => setForm((p) => ({ ...p, model: e.target.value }))}
                                            className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                                        />
                                    </div>

                                    <div className="grid grid-cols-3 gap-2 md:col-span-2">
                                        <div>
                                            <label className="mb-1 block text-sm font-semibold">Yıl</label>
                                            <input
                                                value={String(form.year)}
                                                onChange={(e) => setForm((p) => ({ ...p, year: toNum(e.target.value) }))}
                                                className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="mb-1 block text-sm font-semibold">KM</label>
                                            <input
                                                value={String(form.km)}
                                                onChange={(e) => setForm((p) => ({ ...p, km: toNum(e.target.value) }))}
                                                className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="mb-1 block text-sm font-semibold">Motor (cc)</label>
                                            <input
                                                value={String(form.engine_size)}
                                                onChange={(e) => setForm((p) => ({ ...p, engine_size: toNum(e.target.value) }))}
                                                className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="mb-1 block text-sm font-semibold">Yakıt</label>
                                        <select
                                            value={form.fuel_type}
                                            onChange={(e) => setForm((p) => ({ ...p, fuel_type: e.target.value }))}
                                            className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                                        >
                                            {FUEL_TYPES.map((x) => (
                                                <option key={x} value={x}>
                                                    {x}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="mb-1 block text-sm font-semibold">Vites</label>
                                        <select
                                            value={form.transmission}
                                            onChange={(e) => setForm((p) => ({ ...p, transmission: e.target.value }))}
                                            className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                                        >
                                            {TRANSMISSIONS.map((x) => (
                                                <option key={x} value={x}>
                                                    {x}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* ✅ body_type selectbox */}
                                    <div>
                                        <label className="mb-1 block text-sm font-semibold">Kasa Tipi</label>
                                        <select
                                            value={form.body_type}
                                            onChange={(e) => setForm((p) => ({ ...p, body_type: e.target.value }))}
                                            className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                                        >
                                            {BODY_TYPES.map((x) => (
                                                <option key={x} value={x}>
                                                    {x}
                                                </option>
                                            ))}
                                        </select>
                                        <div className="mt-1 text-[11px] text-neutral-500">
                                            allowed: {BODY_TYPES.join(', ')}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="mb-1 block text-sm font-semibold">Renk</label>
                                        <input
                                            value={form.color}
                                            onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))}
                                            className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                                        />
                                    </div>

                                    <div>
                                        <label className="mb-1 block text-sm font-semibold">Araç Durumu</label>
                                        <select
                                            value={form.condition}
                                            onChange={(e) => setForm((p) => ({ ...p, condition: e.target.value }))}
                                            className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                                        >
                                            {CONDITIONS.map((x) => (
                                                <option key={x} value={x}>
                                                    {x}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
                                        <input
                                            id="heavy_damage_recorded_admin"
                                            type="checkbox"
                                            checked={!!form.heavy_damage_recorded}
                                            onChange={(e) => setForm((p) => ({ ...p, heavy_damage_recorded: e.target.checked }))}
                                            className="h-4 w-4"
                                        />
                                        <label htmlFor="heavy_damage_recorded_admin" className="text-sm font-semibold">
                                            Ağır hasar kaydı var
                                        </label>
                                    </div>

                                    <div>
                                        <label className="mb-1 block text-sm font-semibold">Konum</label>
                                        <input
                                            value={form.location}
                                            onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
                                            className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                                        />
                                    </div>

                                    <div>
                                        <label className="mb-1 block text-sm font-semibold">Telefon</label>
                                        <input
                                            value={form.phone}
                                            onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                                            className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                                        />
                                    </div>

                                    <div>
                                        <label className="mb-1 block text-sm font-semibold">Plaka</label>
                                        <input
                                            value={form.plate}
                                            onChange={(e) => setForm((p) => ({ ...p, plate: e.target.value }))}
                                            className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                                        />
                                    </div>

                                    <div>
                                        <label className="mb-1 block text-sm font-semibold">Uyruk</label>
                                        <input
                                            value={form.nationality}
                                            onChange={(e) => setForm((p) => ({ ...p, nationality: e.target.value }))}
                                            className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                                        />
                                    </div>

                                    <div>
                                        <label className="mb-1 block text-sm font-semibold">Kimden</label>
                                        <select
                                            value={form.source}
                                            onChange={(e) => setForm((p) => ({ ...p, source: e.target.value }))}
                                            className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                                        >
                                            {SOURCES.map((x) => (
                                                <option key={x} value={x}>
                                                    {x}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="mb-1 block text-sm font-semibold">Açıklama</label>
                                        <textarea
                                            rows={5}
                                            value={form.description}
                                            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                                            className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                                        />
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="mb-1 block text-sm font-semibold">image_file_ids (opsiyonel)</label>
                                        <textarea
                                            rows={4}
                                            value={(form.image_file_ids || []).join('\n')}
                                            onChange={(e) =>
                                                setForm((p) => ({
                                                    ...p,
                                                    image_file_ids: e.target.value
                                                        .split('\n')
                                                        .map((s) => s.trim())
                                                        .filter(Boolean),
                                                }))
                                            }
                                            placeholder="file_id1\nfile_id2\n…"
                                            className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="flex justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setEditOpen(false);
                                            setEditId(null);
                                        }}
                                        className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-neutral-50"
                                        disabled={editBusy}
                                    >
                                        İptal
                                    </button>
                                    <button
                                        type="submit"
                                        className="rounded-xl bg-indigo-500 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-600 disabled:opacity-60"
                                        disabled={editBusy}
                                    >
                                        {editBusy ? 'Güncelleniyor…' : 'Kaydet'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== Action Modal ===== */}
            {actOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
                    <div className="w-full max-w-xl rounded-2xl border border-neutral-200 bg-white shadow-xl">
                        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
                            <div className="min-w-0">
                                <div className="text-sm font-semibold text-neutral-900 truncate">
                                    İşlem: {actType.toUpperCase()}
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setActOpen(false)}
                                className="rounded-xl border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-neutral-50"
                            >
                                Kapat
                            </button>
                        </div>

                        <form onSubmit={submitAction} className="p-5 space-y-3">
                            <div>
                                <label className="mb-1 block text-sm font-semibold">listing_id</label>
                                <input
                                    value={actListingId}
                                    onChange={(e) => setActListingId(e.target.value)}
                                    className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-semibold">action</label>
                                <input
                                    value={actAction}
                                    onChange={(e) => setActAction(e.target.value)}
                                    placeholder="swagger: action string"
                                    className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                                />
                                <div className="mt-1 text-[11px] text-neutral-500">
                                    Varsayılan: <code className="rounded bg-neutral-100 px-1">{actType}</code>
                                </div>
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-semibold">notes</label>
                                <textarea
                                    rows={4}
                                    value={actNotes}
                                    onChange={(e) => setActNotes(e.target.value)}
                                    placeholder={actType === 'reject' ? 'Red sebebi zorunlu olabilir.' : 'İsteğe bağlı not.'}
                                    className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setActOpen(false)}
                                    className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-neutral-50"
                                    disabled={actBusy}
                                >
                                    İptal
                                </button>
                                <button
                                    type="submit"
                                    className="rounded-xl bg-indigo-500 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-600 disabled:opacity-60"
                                    disabled={actBusy}
                                >
                                    {actBusy ? 'Gönderiliyor…' : 'Gönder'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
