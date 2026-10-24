import { PDFDocument } from "pdf-lib";
import type { BallotExtract } from "./schema";

// Vercel caps request bodies at ~4.5 MB, so large photos are downscaled in the browser.
const MAX_BYTES = 4 * 1024 * 1024;
const MAX_EDGE = 2400;

/**
 * Turns the user's file into one or more uploads. Multi-page PDFs are split
 * into single pages so each extraction call stays small and fast.
 */
export async function prepareUploads(file: File): Promise<File[]> {
  if (file.type === "application/pdf") return splitPdf(file);
  if (!file.type.startsWith("image/")) throw new Error("Upload a PDF or an image of your ballot.");
  return [await downscaleImage(file)];
}

async function splitPdf(file: File): Promise<File[]> {
  const src = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
  const count = src.getPageCount();
  if (count === 1) {
    if (file.size > MAX_BYTES) throw new Error("PDF is over 4 MB. Try a screenshot of the ballot instead.");
    return [file];
  }
  const pages: File[] = [];
  for (let i = 0; i < count; i++) {
    const doc = await PDFDocument.create();
    const [page] = await doc.copyPages(src, [i]);
    doc.addPage(page);
    const bytes = await doc.save();
    if (bytes.byteLength > MAX_BYTES) throw new Error(`Page ${i + 1} is over 4 MB. Try screenshots instead.`);
    pages.push(new File([bytes as BlobPart], `${file.name}-p${i + 1}.pdf`, { type: "application/pdf" }));
  }
  return pages;
}

async function downscaleImage(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  if (file.size <= MAX_BYTES && Math.max(bitmap.width, bitmap.height) <= MAX_EDGE) return file;
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
  if (!blob) throw new Error("Couldn't process that image.");
  return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });
}

export type PagedBallot = Omit<BallotExtract, "contests"> & {
  contests: (BallotExtract["contests"][number] & { page: number })[];
};

/**
 * Combines per-page extractions, joining a contest that continues onto the
 * next page. Each contest remembers the (0-based) page it starts on.
 */
export function mergeBallots(parts: BallotExtract[]): PagedBallot {
  const pick = <K extends keyof BallotExtract>(k: K) => parts.find((p) => p[k])?.[k] ?? null;
  const contests: PagedBallot["contests"] = [];
  for (const [page, part] of parts.entries()) {
    for (const c of part.contests) {
      const prev = contests.at(-1);
      if (prev && prev.kind === c.kind && prev.title === c.title && prev.district === c.district) {
        const names = new Set(prev.candidates.map((x) => x.name));
        prev.candidates.push(...c.candidates.filter((x) => !names.has(x.name)));
        prev.measureText = [prev.measureText, c.measureText].filter(Boolean).join(" ") || null;
        if (!prev.options.length) prev.options = c.options;
      } else contests.push({ ...c, candidates: [...c.candidates], page });
    }
  }
  return {
    electionName: pick("electionName"),
    electionDate: pick("electionDate"),
    state: pick("state"),
    county: pick("county"),
    jurisdiction: pick("jurisdiction"),
    contests,
  };
}
