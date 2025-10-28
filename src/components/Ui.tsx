import Link from "next/link";
import { ReactNode } from "react";

export function Tile({ href, title, subtitle }: { href: string; title: string; subtitle?: string }) {
  return (
    <Link href={href} className="block rounded-2xl border p-6 shadow-sm hover:shadow-md transition">
      <div className="text-xl font-semibold">{title}</div>
      {subtitle && <div className="text-sm text-muted-foreground mt-1">{subtitle}</div>}
    </Link>
  );
}

export function Page({ children, title }: { children: ReactNode; title: string }) {
  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">{title}</h1>
      {children}
    </div>
  );
}