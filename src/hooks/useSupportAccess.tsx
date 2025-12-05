// src/hooks/supportAccess.ts
"use client";

import * as React from "react";
import { getAuthToken } from "@/src/utils/auth";

/** backend’de tanımlı access id’leri */
export type SupportAccessId = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** GET /api/admin/support/me response tipi */
type SupportUserDetailResponse = {
  success?: boolean;
  message?: string;
  data?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    access: number[];
    is_active?: boolean;
    created_at?: string;
    updated_at?: string;
  } | null;
};

function bearerHeaders(token?: string | null): HeadersInit {
  const h: HeadersInit = { Accept: "application/json" };
  if (token) (h as any).Authorization = `Bearer ${token}`;
  return h;
}

/**
 * Çağrı merkezi kullanıcısının access listesini
 * GET /api/admin/support/me üzerinden çeker.
 */
export function useSupportAccess() {
  const [access, setAccess] = React.useState<SupportAccessId[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      const token = getAuthToken();
      if (!token) {
        if (!cancelled) {
          setAccess([]);
          setError("Oturum bulunamadı.");
        }
        return;
      }

      try {
        // yeni endpoint: /api/admin/support/me
        // front’ta rewrite ile /yuksi/admin/support/me
        const res = await fetch("/yuksi/admin/support/me", {
          headers: bearerHeaders(token),
          cache: "no-store",
        });

        const rawText = await res.text();
        let json: any = null;
        try {
          json = rawText ? JSON.parse(rawText) : null;
        } catch {
          json = rawText;
        }

        if (!res.ok) {
          const msg =
            (json && (json.message || json.error || json.detail || json.title)) ||
            `HTTP ${res.status}`;
          if (!cancelled) {
            setAccess([]);
            setError(msg);
          }
          return;
        }

        const body: SupportUserDetailResponse = json;
        const rawAccess =
          body?.data?.access ||
          (Array.isArray((json as any).access) ? (json as any).access : []);

        const parsed: SupportAccessId[] = Array.isArray(rawAccess)
          ? (rawAccess
              .map((v: any) => Number(v))
              .filter(
                (n) => !Number.isNaN(n) && n >= 1 && n <= 7
              ) as SupportAccessId[])
          : [];

        if (!cancelled) {
          setAccess(parsed);
          setError(null);
        }
      } catch (e: any) {
        if (!cancelled) {
          setAccess([]);
          setError(e?.message || "Support yetkileri yüklenemedi.");
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  return { access, error };
}
