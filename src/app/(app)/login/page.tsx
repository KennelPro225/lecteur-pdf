"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  return (
    <main className="max-w-sm mx-auto px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight">Bon retour 👋</h1>
      <p className="text-stone-500 mt-1 mb-8">Connectez-vous pour reprendre votre lecture.</p>
      <form
        className="flex flex-col gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const res = await signIn("credentials", { email, password, redirect: false });
          if (res?.error) setError("Identifiants invalides");
          else router.push("/");
        }}
      >
        <input type="email" required className="border rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-stone-300" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input type="password" required className="border rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-stone-300" placeholder="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button className="bg-stone-900 text-white rounded-lg p-2.5 font-medium hover:bg-stone-700">Se connecter</button>
      </form>
      <p className="mt-4 text-sm text-stone-500">Pas de compte ? <Link className="underline underline-offset-4" href="/register">Inscription</Link></p>
    </main>
  );
}
