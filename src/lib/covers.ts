import { mkdir, readFile, stat, writeFile } from "fs/promises";
import path from "path";

export const MAX_COVER_BYTES = 400 * 1024;
const coversDir = () => path.join(process.cwd(), "uploads", "covers");
export const coverPath = (id: string) => path.join(coversDir(), `${path.basename(id)}.webp`);

export async function saveCover(id: string, data: Uint8Array) {
  await mkdir(coversDir(), { recursive: true });
  await writeFile(coverPath(id), data);
}

export async function readCover(id: string) {
  const file = coverPath(id);
  const info = await stat(file);
  return { info, data: new Uint8Array(await readFile(file)) };
}

