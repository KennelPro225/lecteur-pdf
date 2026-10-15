"use client";
import dynamic from "next/dynamic";
import type { ReaderProps } from "./Reader";

function ReaderSkeleton() {
  return (
    <div className="fixed inset-0 grid place-items-center bg-white">
      <div className="w-8 h-8 rounded-full border-2 border-stone-400 border-t-transparent animate-spin" />
    </div>
  );
}

// The reader is 100% client-side (canvas, localStorage, pdf.js): skip SSR so it
// can read local settings synchronously and keep pdf.js out of the server bundle.
const Reader = dynamic(() => import("./Reader"), { ssr: false, loading: ReaderSkeleton });

export default function ReaderClient(props: ReaderProps) {
  return <Reader {...props} />;
}

