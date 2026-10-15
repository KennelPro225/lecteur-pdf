"use client";
import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconGlobe, IconLock } from "@/components/icons";

export default function VisibilityToggle({ id, visibility }: { id: string; visibility: string }) {
  const router = useRouter();
  const [optimistic, setOptimistic] = useOptimistic(visibility);
  const [, startTransition] = useTransition();
  const isPublic = optimistic === "public";

  return (
    <button
      title={isPublic ? "Visible par tous — cliquer pour rendre privé" : "Privé — cliquer pour partager"}
      aria-label={isPublic ? "Rendre privé" : "Rendre public"}
      className={`inline-flex items-center gap-1 text-[11px] rounded-full px-2 py-0.5 font-medium transition-colors ${isPublic ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200" : "bg-stone-100 text-stone-500 hover:bg-stone-200"}`}
      onClick={() =>
        startTransition(async () => {
          const next = isPublic ? "private" : "public";
          setOptimistic(next);
          await fetch(`/api/books/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ visibility: next }),
          });
          router.refresh();
        })
      }
    >
      {isPublic ? <IconGlobe width={12} height={12} /> : <IconLock width={12} height={12} />}
      {isPublic ? "Public" : "Privé"}
    </button>
  );
}
