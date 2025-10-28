// src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import Header from "@/src/components/Header";

export const metadata: Metadata = {
  title: "Heirlooms",
  description: "Turn photos, notes, and voice into story-rich digital pages.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-white text-gray-900">
        <Header />
        <main className="mx-auto max-w-6xl p-4">{children}</main>
      </body>
    </html>
  );
}
