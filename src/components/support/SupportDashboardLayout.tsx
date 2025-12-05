"use client";

import * as React from "react";
import DashboardShell from "@/src/components/dashboard/Shell";
import Header from "@/src/components/dashboard/Header";
import Sidebar from "@/src/components/dashboard/Sidebar";
import { navForRole } from "@/src/app/config/nav";
import type { NavGroup } from "@/src/types/roles";
import { useSupportAccess, type SupportAccessId } from "@/src/hooks/useSupportAccess";

export default function SupportDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { access, error } = useSupportAccess();

  const nav: NavGroup[] = React.useMemo(() => {
    const base = navForRole("support") || [];

    // access null ise (daha yüklenmedi) nav'ı boş gönderiyoruz
    if (access === null) return [];

    const filteredGroups = base
      .map<NavGroup | null>((g) => {
        const items = g.items.filter((it) => {
          // requiredAccess yoksa → herkes görsün
          if (!it.requiredAccess || it.requiredAccess.length === 0) return true;

          // requiredAccess içinde, kullanıcının sahip olduğu herhangi bir access var mı?
          return it.requiredAccess.some((a) =>
            (access as SupportAccessId[]).includes(a as SupportAccessId)
          );
        });

        if (items.length === 0) return null;
        return { ...g, items };
      })
      .filter((g): g is NavGroup => g !== null);

    return filteredGroups;
  }, [access]);

  // access henüz okunmadıysa basit loading ekranı
  if (access === null) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-neutral-100">
        <span className="text-sm text-neutral-500">
          Yetkileriniz yükleniyor…
        </span>
      </div>
    );
  }

  // İstersen: access boş + error varsa "yetkin yok" ekranı da koyabilirsin
  // if (access.length === 0) { ... }

  return (
    <div className="min-h-dvh bg-neutral-100 flex">
      <Sidebar nav={nav} />
      <div className="flex-1 orange-ui">
        <Header
          title="Yüksi Panel"
          headerClass="bg-orange-500 border-orange-400 text-white"
          titleClass="font-extrabold"
        />
        <main className="px-4 py-6">
          <div className="max-w-7xl mx-auto">
            <DashboardShell>{children}</DashboardShell>
            {error && (
              <p className="mt-3 text-xs text-rose-600">
                Uyarı: {error}
              </p>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
