"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSupportAccess } from "@/src/hooks/useSupportAccess";
import { fmtDateTR, pickMsg, readJson, statusBadge, translateVehicleType } from "../../_components/shared";

type ReviewStatus = "pending" | "approved" | "rejected";

function guessEmailPhone(d: any): { email: string; phone: string; name: string } {
  const email = String(d?.email ?? "").trim();
  const phone = String(d?.phone ?? d?.phoneNumber ?? "").trim();
  const name =
    String(d?.name ?? "").trim() ||
    `${String(d?.firstName ?? "").trim()} ${String(d?.lastName ?? "").trim()}`.trim();
  return { email, phone, name };
}

export default function ApplicationDetailPage() {
  const params = useParams<{ application_type: string; application_id: string }>();
  const applicationType = String(params.application_type || "");
  const applicationId = String(params.application_id || "");

  const { access } = useSupportAccess();
  const hasAccess = access === null ? null : access.includes(8);

  // İlk açılışta sayfa hiç görünmesin, sadece yükleniyor ekranı gelsin
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<any>(null);

  // review form
  const [status, setStatus] = React.useState<ReviewStatus>("pending");
  const [reviewNotes, setReviewNotes] = React.useState("");
  const [callDuration, setCallDuration] = React.useState("0:00");
  const [saving, setSaving] = React.useState(false);
  const [saveMsg, setSaveMsg] = React.useState<string | null>(null);

  // blacklist (sadece ekleme)
  const [blErr, setBlErr] = React.useState<string | null>(null);
  const [blReason, setBlReason] = React.useState("");
  const [blAdding, setBlAdding] = React.useState(false);
  const [blConfirmOpen, setBlConfirmOpen] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!applicationType || !applicationId) return;
    setLoading(true);
    setError(null);

    // Helper: gelen cevaptan gerçek başvuru objesini çıkar ve state'e yaz
    const applyDetail = (raw: any) => {
      let d: any =
        (raw && typeof raw === "object" && !Array.isArray(raw) && "data" in raw && raw.data) ||
        (raw && typeof raw === "object" && "result" in raw && (raw as any).result) ||
        raw;
      if (d && typeof d === "object" && !Array.isArray(d) && "data" in d && !(d as any).id) {
        d = (d as any).data;
      }
      setDetail(d);

      const st = String(d?.status ?? d?.review?.status ?? "pending").toLowerCase() as ReviewStatus;
      if (st === "approved" || st === "rejected" || st === "pending") setStatus(st);
      setReviewNotes(
        String(
          d?.review?.reviewNotes ??
            d?.review?.review_notes ??
            d?.reviewNotes ??
            d?.review_notes ??
            ""
        )
      );
      setCallDuration(
        String(
          d?.review?.callDurationFormatted ??
            d?.review?.call_duration_formatted ??
            d?.callDurationFormatted ??
            d?.call_duration_formatted ??
            "0:00"
        )
      );
    };

    try {
      // 1) Birincil detay endpoint'i
      const res = await fetch(
        `/api/support/applications/${encodeURIComponent(applicationType)}/${encodeURIComponent(
          applicationId
        )}`,
        { cache: "no-store" }
      );
      const data: any = await readJson(res);
      if (!res.ok || (data as any)?.success === false) {
        throw new Error(pickMsg(data, `HTTP ${res.status}`));
      }
      applyDetail(data);
    } catch (e: any) {
      // 2) Dealer + Corporate için fallback: liste endpoint'inden çek
      if (applicationType === "dealer_form" || applicationType === "corporate_form") {
        try {
          const listKind =
            applicationType === "dealer_form" ? "dealer-forms" : "corporate-forms";
          const url = new URL(
            `/api/support/applications/${listKind}`,
            window.location.origin
          );
          url.searchParams.set("limit", "200");
          url.searchParams.set("offset", "0");

          const resList = await fetch(url.toString(), { cache: "no-store" });
          const dataList: any = await readJson(resList);
          if (!resList.ok || dataList?.success === false) {
            throw new Error(pickMsg(dataList, `HTTP ${resList.status}`));
          }

          const arr: any[] = Array.isArray(dataList?.data)
            ? dataList.data
            : Array.isArray(dataList)
            ? dataList
            : [];

          const found = arr.find((x) => String(x.id) === String(applicationId));
          if (!found) {
            throw new Error("Başvuru kaydı bulunamadı.");
          }

          applyDetail(found);
        } catch (e2: any) {
          setError(e2?.message || "Başvuru detayı getirilemedi.");
          setDetail(null);
        }
      } else {
        // Carrier için fallback kullanmıyoruz, direkt hata göster
        setError(e?.message || "Başvuru detayı getirilemedi.");
        setDetail(null);
      }
    } finally {
      setLoading(false);
    }
  }, [applicationId, applicationType]);

  React.useEffect(() => {
    if (hasAccess === null) return;
    if (!hasAccess) return;
    load();
  }, [hasAccess, load]);

  async function saveReview() {
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch("/api/support/applications/review", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          application_type: applicationType,
          application_id: applicationId,
          status,
          review_notes: reviewNotes,
          call_duration: callDuration,
        }),
      });
      const data: any = await readJson(res);
      if (!res.ok || data?.success === false) throw new Error(pickMsg(data, `HTTP ${res.status}`));
      setSaveMsg("Görüşme kaydedildi.");
      await load();
    } catch (e: any) {
      setSaveMsg(e?.message || "Görüşme kaydedilemedi.");
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(null), 2500);
    }
  }

  async function addToBlacklist() {
    setBlAdding(true);
    setBlErr(null);
    try {
      const { email, phone, name } = guessEmailPhone(detail);
      const res = await fetch("/api/support/applications/blacklist", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          application_type: applicationType,
          application_id: applicationId,
          email,
          phone,
          name,
          reason: blReason,
        }),
      });
      const data: any = await readJson(res);
      if (!res.ok || data?.success === false) throw new Error(pickMsg(data, `HTTP ${res.status}`));
      setBlReason("");
    } catch (e: any) {
      setBlErr(e?.message || "Kara listeye eklenemedi.");
    } finally {
      setBlAdding(false);
    }
  }

  if (hasAccess === false) {
    return (
      <div className="rounded-2xl bg-white p-6 shadow">
        <h1 className="text-xl font-semibold mb-2">Başvuru Detayı</h1>
        <p className="text-sm text-rose-600">
          Bu sayfayı görüntülemek için <strong>Başvuru Yönetimi </strong> yetkisine sahip olmanız gerekiyor.
        </p>
      </div>
    );
  }

  const appStatus = String(detail?.status ?? "pending");
  const createdAt = detail?.createdAt ?? detail?.created_at ?? null;
  const reviewedAt = detail?.review?.reviewedAt ?? detail?.review?.reviewed_at ?? null;

  const contact = detail ? guessEmailPhone(detail) : { email: "", phone: "", name: "" };

  // Hata mesajını çağrı merkezi için daha anlaşılır hale getir
  const friendlyError =
    error && error.toLowerCase().includes("invalid input for query argument")
      ? "Başvuru detayı alınırken teknik bir hata oluştu. Lütfen tekrar deneyin veya teknik ekibe iletin."
      : error;

  // Veri tamamen gelene kadar sade bir yükleniyor ekranı göster
  if (loading && !detail && !friendlyError ) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-neutral-50 rounded-3xl">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
          <p className="text-sm text-neutral-600">Başvuru bilgileri getiriliyor…</p>
        </div>
      </div>
    );
  }

  // Belgeler: özellikle carrier için, ayrıca generic URL alanları
  const documents: { label: string; url: string }[] = [];
  if (detail) {
    if (detail.vehicleDocumentsUrl || detail.vehicle_documents_url) {
      documents.push({
        label: "Araç Belgeleri",
        url: String(detail.vehicleDocumentsUrl ?? detail.vehicle_documents_url),
      });
    }
    if (detail.carrierDocumentsUrl || detail.carrier_documents_url) {
      documents.push({
        label: "Taşıyıcı Belgeleri",
        url: String(detail.carrierDocumentsUrl ?? detail.carrier_documents_url),
      });
    }

    // Diğer olası belge URL'lerini yakala (örn. extraDocumentUrl)
    Object.entries(detail as Record<string, unknown>).forEach(([key, value]) => {
      if (typeof value !== "string") return;
      const url = value.trim();
      if (!/^https?:\/\//i.test(url)) return;
      // Zaten eklediklerimizi tekrar etme
      if (documents.some((d) => d.url === url)) return;

      // Alan adını daha okunur hale getir
      const prettyKey = key
        .replace(/Url$/i, "")
        .replace(/_url$/i, "")
        .replace(/[_\-]/g, " ")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .trim();

      const label = prettyKey
        ? `${prettyKey[0].toUpperCase()}${prettyKey.slice(1)}`
        : "Belge";

      documents.push({ label, url });
    });
  }

  return (
    <div className="space-y-6 bg-neutral-50/80 rounded-3xl p-1">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Başvuru Detayı</h1>
          <p className="text-sm text-neutral-600">
            <span className="font-semibold">Başvuru Tipi:</span>{" "}
            {applicationType === "dealer_form"
              ? "Bayi Başvurusu"
              : applicationType === "corporate_form"
              ? "Kurumsal Başvuru"
              : "Taşıyıcı Başvurusu"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/supports/applications/${
              applicationType === "dealer_form"
                ? "dealer-forms"
                : applicationType === "corporate_form"
                ? "corporate-forms"
                : "carrier-applications"
            }`}
            className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
          >
            Listeye Dön
          </Link>
          <button
            onClick={load}
            className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
            disabled={loading}
          >
            {loading ? "Yükleniyor…" : "Yenile"}
          </button>
        </div>
      </div>

      {friendlyError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {friendlyError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section className="lg:col-span-7 rounded-2xl border border-neutral-200/70 bg-white shadow-md">
          <div className="border-b border-neutral-200/70 p-4 flex items-center justify-between">
            <div className="font-semibold">Başvuru Bilgileri</div>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadge(appStatus)}`}>
              {appStatus === "approved"
                ? "Onaylandı"
                : appStatus === "rejected"
                ? "Reddedildi"
                : "Beklemede"}
            </span>
          </div>
          <div className="p-4 space-y-3 text-sm">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-3">
                <div className="text-xs text-neutral-500">İsim</div>
                <div className="font-semibold text-neutral-900">{contact.name || "-"}</div>
              </div>
              <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-3">
                <div className="text-xs text-neutral-500">Şehir</div>
                <div className="font-semibold text-neutral-900">{detail?.city ?? "-"}</div>
              </div>
              <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-3">
                <div className="text-xs text-neutral-500">E-posta</div>
                <div className="font-semibold text-neutral-900">{contact.email || "-"}</div>
              </div>
              <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-3">
                <div className="text-xs text-neutral-500">Telefon</div>
                <div className="font-semibold text-neutral-900">{contact.phone || "-"}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-3">
                <div className="text-xs text-neutral-500">Oluşturulma Tarihi</div>
                <div className="font-semibold text-neutral-900">{fmtDateTR(createdAt)}</div>
              </div>
              <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-3">
                <div className="text-xs text-neutral-500">Son Güncellenme / İnceleme</div>
                <div className="font-semibold text-neutral-900">{fmtDateTR(reviewedAt)}</div>
              </div>
            </div>

            {detail?.subject && (
              <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-3">
                <div className="text-xs text-neutral-500">Konu</div>
                <div className="font-semibold text-neutral-900">{String(detail.subject)}</div>
              </div>
            )}

            {detail?.message && (
              <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-3">
                <div className="text-xs text-neutral-500">Mesaj</div>
                <div className="text-neutral-900 whitespace-pre-wrap">{String(detail.message)}</div>
              </div>
            )}

            {applicationType === "carrier_application" && (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-3">
                  <div className="text-xs text-neutral-500">Araç Tipi</div>
                  <div className="font-semibold text-neutral-900">{translateVehicleType(detail?.vehicleType)}</div>
                </div>
                <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-3">
                  <div className="text-xs text-neutral-500">Araç Yılı</div>
                  <div className="font-semibold text-neutral-900">{String(detail?.vehicleRegistrationYear ?? "-")}</div>
                </div>
              </div>
            )}

            {documents.length > 0 && (
              <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-3">
                <div className="text-xs text-neutral-500 mb-2">Ek Belgeler</div>
                <div className="flex flex-wrap gap-2">
                  {documents.map((doc) => (
                    <a
                      key={doc.url}
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-100 hover:bg-indigo-100"
                    >
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-indigo-500" />
                      <span>{doc.label}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="lg:col-span-5 space-y-6">
          <div className="rounded-2xl border border-neutral-200/70 bg-white shadow-md">
            <div className="border-b border-neutral-200/70 p-4">
              <div className="font-semibold">Telefon Görüşmesi</div>
              <div className="text-xs text-neutral-500 mt-1">
                Görüşme sonucunu ve süresini kaydedince başvurunun durumu da güncellenir.
              </div>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-600 mb-1">Başvuru Durumu</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ReviewStatus)}
                  className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm"
                >
                  <option value="pending">Beklemede</option>
                  <option value="approved">Onaylandı</option>
                  <option value="rejected">Reddedildi</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-600 mb-1">
                  Telefon Görüşme Süresi
                </label>
                <input
                  value={callDuration}
                  onChange={(e) => setCallDuration(e.target.value)}
                  placeholder="7:30"
                  className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm"
                />
                <div className="mt-1 text-[11px] text-neutral-500">Format: <b>dakika:saniye</b> (örn: 7:30)</div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-600 mb-1">
                  Görüşme Notları
                </label>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  rows={5}
                  className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm"
                  placeholder="Görüşme notları…"
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="text-xs text-neutral-500">
                  Son görüşme: <span className="font-semibold">{fmtDateTR(reviewedAt)}</span>
                </div>
                <button
                  onClick={saveReview}
                  disabled={saving}
                  className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
                >
                  {saving ? "Kaydediliyor…" : "Kaydet"}
                </button>
              </div>

              {saveMsg && (
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-800">
                  {saveMsg}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200/70 bg-white shadow-sm">
            <div className="border-b border-neutral-200/70 p-4">
              <div className="font-semibold">Kara Listeye Ekle</div>
              <div className="text-xs text-neutral-500 mt-1">
                Bu başvuruyu sistem içinde kara listeye eklemek için bir neden yazın.
              </div>
            </div>
            <div className="p-4 space-y-3">
              {blErr && <div className="text-sm text-rose-600">{blErr}</div>}

              <div>
                <label className="block text-xs font-semibold text-neutral-600 mb-1">Kara liste nedeni</label>
                <textarea
                  value={blReason}
                  onChange={(e) => setBlReason(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm"
                  placeholder="Örn: Sahte belge…"
                />
              </div>

              <button
                onClick={() => setBlConfirmOpen(true)}
                disabled={blAdding || !blReason.trim() || !contact.email || !contact.phone || !contact.name}
                className="w-full rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
              >
                {blAdding ? "Ekleniyor…" : "Kara Listeye Ekle"}
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Kara Liste Onay Popup */}
      {blConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl mx-4">
            <h3 className="text-lg font-semibold text-neutral-900 mb-2">Kara Listeye Ekle</h3>
            <p className="text-sm text-neutral-600 mb-4">
              <strong>{contact.name}</strong> isimli kişiyi kara listeye eklemek istediğinize emin misiniz?
            </p>
            <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-3 mb-4">
              <div className="text-xs text-neutral-500 mb-1">Neden</div>
              <div className="text-sm text-neutral-800">{blReason}</div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setBlConfirmOpen(false)}
                className="flex-1 rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
              >
                Vazgeç
              </button>
              <button
                onClick={() => {
                  setBlConfirmOpen(false);
                  addToBlacklist();
                }}
                className="flex-1 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
              >
                Onayla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

