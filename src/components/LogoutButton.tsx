"use client";
import { useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";

export default function LogoutButton({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  const initial = (email[0] ?? "?").toUpperCase();
  return (
    <div ref={ref} className="relative ml-1">
      <button
        aria-label="Compte"
        onClick={() => setOpen((o) => !o)}
        className="grid place-items-center w-8 h-8 rounded-full bg-stone-800 text-paper text-sm font-medium hover:bg-stone-700 transition-colors"
      >
        {initial}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 rounded-xl border border-stone-200 bg-white shadow-xl p-1.5 text-sm">
          <p className="px-3 py-2 text-stone-500 truncate">{email}</p>
          <button
            className="w-full text-left px-3 py-2 rounded-lg hover:bg-stone-100"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            Se déconnecter
          </button>
        </div>
      )}
    </div>
  );
}
