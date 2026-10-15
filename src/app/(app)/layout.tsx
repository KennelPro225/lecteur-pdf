import Link from "next/link";
import { auth } from "@/auth";
import LogoutButton from "@/components/LogoutButton";
import NavLink from "@/components/NavLink";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const user = session?.user;
  return (
    <div className="min-h-dvh flex flex-col">
      <header className="sticky top-0 z-20 bg-paper/85 backdrop-blur-md border-b border-stone-200/70 pt-[env(safe-area-inset-top)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight shrink-0">
            <span className="grid place-items-center w-7 h-7 rounded-md bg-ink text-paper text-sm font-serif">F</span>
            <span className="text-lg">Folio</span>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            {user && <NavLink href="/">Bibliothèque</NavLink>}
            <NavLink href="/explore">Explorer</NavLink>
            {user ? (
              <LogoutButton email={user.email ?? ""} />
            ) : (
              <Link href="/login" className="ml-1 rounded-full bg-ink text-paper px-4 py-1.5 hover:bg-stone-700 transition-colors">
                Connexion
              </Link>
            )}
          </nav>
        </div>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}

