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
  const [sidebarOpen, setSidebarOpen] = React.useState(true); // Başlangıçta açık

  // Ekran boyutu değiştiğinde sidebar durumunu ayarla
  React.useEffect(() => {
    const checkScreenSize = () => {
      if (window.innerWidth >= 768) {
        // Masaüstünde sidebar açık kalabilir (kullanıcı kapatmadıysa)
        // State'i sıfırlamıyoruz, sadece kontrol ediyoruz
      } else {
        // Mobilde sidebar kapalı olsun
        setSidebarOpen(false);
      }
    };

    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);
    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

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
    <div className="min-h-dvh bg-neutral-100 flex relative">
      {/* Overlay - sadece mobilde sidebar açıkken */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - mobilde fixed overlay, masaüstünde static */}
      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-50 md:z-auto
          transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          md:transform-none md:transition-none
          ${sidebarOpen ? "" : "md:hidden"}
        `}
      >
        <Sidebar nav={nav} onClose={() => setSidebarOpen(false)} />
      </aside>

      {/* Main content area */}
      <div className="flex-1 orange-ui w-full min-w-0">
        <Header
          title="Yüksi Panel"
          headerClass="bg-orange-500 border-orange-400 text-white"
          titleClass="font-extrabold"
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
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
