import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import "@/globals.css";

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-nunito",
});

export const metadata: Metadata = {
  title: "Yuksi Çağrı Merkezi",
  description: "Yuksi Çağrı Merkezi",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body
        className={`${nunito.variable} ${nunito.className} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}