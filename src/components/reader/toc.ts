import type { PDFDoc } from "@/lib/pdf";

export type TocItem = { title: string; depth: number; page: number | null };

type OutlineNode = { title: string; dest: string | unknown[] | null; items: OutlineNode[] };

async function resolveDest(doc: PDFDoc, dest: OutlineNode["dest"]): Promise<number | null> {
  try {
    const explicit = typeof dest === "string" ? await doc.getDestination(dest) : dest;
    if (!Array.isArray(explicit) || explicit.length === 0) return null;
    const ref = explicit[0];
    if (typeof ref === "number") return ref + 1;
    if (ref && typeof ref === "object") return (await doc.getPageIndex(ref as never)) + 1;
  } catch {}
  return null;
}

/** Flattens the PDF outline and resolves each entry to a page number. */
export async function loadToc(doc: PDFDoc): Promise<TocItem[]> {
  const outline = (await doc.getOutline()) as OutlineNode[] | null;
  if (!outline?.length) return [];
  const flat: { title: string; depth: number; dest: OutlineNode["dest"] }[] = [];
  const walk = (nodes: OutlineNode[], depth: number) => {
    for (const n of nodes) {
      flat.push({ title: n.title, depth, dest: n.dest });
      if (n.items?.length && depth < 2) walk(n.items, depth + 1);
    }
  };
  walk(outline, 0);
  const pages = await Promise.all(flat.map((f) => resolveDest(doc, f.dest)));
  return flat.map((f, i) => ({ title: f.title.trim() || "Sans titre", depth: f.depth, page: pages[i] }));
}

/** Returns the chapter containing `page` and the first page of the following chapter. */
export function chapterAt(toc: TocItem[], page: number) {
  let current: TocItem | null = null;
  let nextPage: number | null = null;
  for (const item of toc) {
    if (item.page == null) continue;
    if (item.page <= page) {
      if (!current || item.page >= (current.page ?? 0)) current = item;
    } else if (nextPage == null || item.page < nextPage) {
      nextPage = item.page;
    }
  }
  return { current, nextPage };
}

