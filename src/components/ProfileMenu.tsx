// src/components/ProfileMenu.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/src/lib/supabase/client";

type UserLite = {
  id: string;
  email?: string;
  name?: string;
  avatar_url?: string;
};

function initialsFrom(s?: string) {
  if (!s) return "?";
  const parts = s.trim().split(/\s+/);
  const first = parts[0]?.[0] || "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] || "" : "";
  return (first + last).toUpperCase() || s[0]?.toUpperCase() || "?";
}

export function ProfileMenu() {
  const router = useRouter();
  const supabase = getSupabaseBrowser();

  const [user, setUser] = useState<UserLite | null>(null);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Load user + subscribe to auth changes
  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data } = await supabase.auth.getUser();
      const u = data?.user;
      if (mounted && u) {
        setUser({
          id: u.id,
          email: u.email || undefined,
          name:
            (u.user_metadata?.name as string | undefined) ||
            (u.user_metadata?.full_name as string | undefined),
          avatar_url: (u.user_metadata?.avatar_url as string | undefined) || undefined,
        });
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      const u = session?.user;
      setUser(
        u
          ? {
              id: u.id,
              email: u.email || undefined,
              name:
                (u.user_metadata?.name as string | undefined) ||
                (u.user_metadata?.full_name as string | undefined),
              avatar_url: (u.user_metadata?.avatar_url as string | undefined) || undefined,
            }
          : null
      );
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe();
    };
  }, [supabase]);

  // Close on outside click / ESC
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!open) return;
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  async function logout() {
    await supabase.auth.signOut();
    setOpen(false);
    router.push("/login");
  }

  if (!user) {
    return (
      <a
        href="/login"
        className="rounded-xl border px-3 py-2 text-sm hover:bg-teal-700"
      >
        Sign in
      </a>
    );
  }

  const label = user.name || user.email || "Account";
  const initials = initialsFrom(user.name || user.email);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-teal-700"
      >
        {user.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.avatar_url}
            alt={label}
            className="h-6 w-6 rounded-full object-cover"
          />
        ) : (
          <span className="grid h-6 w-6 place-items-center rounded-full bg-gray-200 text-xs font-semibold">
            {initials}
          </span>
        )}
        <span className="max-w-[140px] truncate">{label}</span>
        <svg
          className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.71a.75.75 0 1 1 1.06 1.06l-4.24 4.24a.75.75 0 0 1-1.06 0L5.21 8.29a.75.75 0 0 1 .02-1.08z" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-48 overflow-hidden rounded-xl border bg-teal-500/70 shadow-md"
        >
          <a
            role="menuitem"
            href="/collections/mine"
            className="block px-4 py-2 text-sm hover:bg-teal-700"
            onClick={() => setOpen(false)}
          >
            My Collections
          </a>
          <button
            role="menuitem"
            onClick={logout}
            className="block w-full px-4 py-2 text-left text-sm hover:bg-teal-700"
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
