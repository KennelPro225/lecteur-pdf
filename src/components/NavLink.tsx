"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href;
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1.5 transition-colors ${active ? "bg-stone-200/70 text-ink font-medium" : "text-stone-600 hover:text-ink hover:bg-stone-100"}`}
    >
      {children}
    </Link>
  );
}

