// Copies the pdf.js worker into /public so it is served locally (no CDN round-trip)
// and always matches the installed pdfjs-dist version.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const pkgDir = path.dirname(require.resolve("pdfjs-dist/package.json"));
const src = path.join(pkgDir, "build", "pdf.worker.min.mjs");
const destDir = path.join(process.cwd(), "public");
mkdirSync(destDir, { recursive: true });
copyFileSync(src, path.join(destDir, "pdf.worker.min.mjs"));
console.log("✓ pdf.worker.min.mjs copied to public/");

