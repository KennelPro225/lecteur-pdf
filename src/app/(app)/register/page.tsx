"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  return (
    <main className="max-w-sm mx-auto px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight">Créer un compte</h1>
      <p className="text-stone-500 mt-1 mb-8">Votre bibliothèque vous suit partout.</p>
      <form
        className="flex flex-col gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const res = await fetch("/api/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
          });
          if (res.ok) router.push("/login");
          else setError((await res.json()).error);
        }}
      >
        <input type="email" required className="border rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-stone-300" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input type="password" required className="border rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-stone-300" minLength={6} placeholder="Mot de passe (6+ caractères)" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button className="bg-stone-900 text-white rounded-lg p-2.5 font-medium hover:bg-stone-700">Créer mon compte</button>
      </form>
      <p className="mt-4 text-sm text-stone-500">Déjà inscrit ? <Link className="underline underline-offset-4" href="/login">Connexion</Link></p>
    </main>
  );
}
