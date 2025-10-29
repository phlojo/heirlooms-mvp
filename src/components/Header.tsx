// src/components/Header.tsx
import Link from "next/link";
import { ProfileMenu } from "@/src/components/ProfileMenu";

export default function Header() {
  return (
    <header className="sticky top-0 z-30 w-full border-b bg-teal-500/70 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-base font-semibold">
          Heirlooms.ai APP
        </Link>
        <nav className="flex items-center gap-3">
          <Link
            href="/collections"
            className="hidden sm:inline-block rounded-xl border px-3 py-2 text-sm hover:bg-teal-700"
          >
            Collections
          </Link>
          <ProfileMenu />
        </nav>
      </div>
    </header>
  );
}
