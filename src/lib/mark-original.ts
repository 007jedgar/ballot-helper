import { PDFDocument, rgb, type PDFPage } from "pdf-lib";
import type { Ballot, Contest } from "./store";

/**
 * Marks the voter's picks on their original (text-based) PDF ballot.
 *
 * pdf.js finds where each chosen name or option is printed; the page is
 * rendered to a canvas and scanned leftward from the name to find the
 * box/oval's edges, which pdf-lib then fills in. If no box is found next to
 * a name, a check mark is drawn there instead.
 */

type Line = { text: string; x: number; y: number; h: number; page: number };
type Box = { x: number; y: number; w: number; h: number };
export type MarkReport = { filled: number; checked: number; missing: string[] };

const SCALE = 3;

/** pdf.js with its worker bundled by Next (no file copying at install time). */
async function loadPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  if (!pdfjs.GlobalWorkerOptions.workerPort) {
    pdfjs.GlobalWorkerOptions.workerPort = new Worker(new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url), {
      type: "module",
    });
  }
  return pdfjs;
}
const words = (s: string) => s.toUpperCase().replace(/[^A-Z0-9 ]+/g, " ").split(/\s+/).filter(Boolean);
const key = (s: string) => words(s).join("");

function matches(line: string, target: string) {
  const lw = words(line);
  const tw = words(target);
  if (!tw.length || !lw.length) return false;
  if (tw.every((w, i) => lw[i] === w)) return true;
  // Long names can wrap: "CHRISTIAN DASHAUN" / "MENEFEE".
  const lk = key(line);
  return lk.length >= 6 && key(target).startsWith(lk);
}

function groupLines(items: { str: string; transform: number[]; width: number; height: number }[], page: number): Line[] {
  const parts = items
    .filter((i) => i.str.trim())
    .map((i) => ({ text: i.str, x: i.transform[4], y: i.transform[5], w: i.width, h: i.height || Math.abs(i.transform[3]) }))
    .sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: (Line & { end: number })[] = [];
  for (const p of parts) {
    const prev = lines.find((l) => Math.abs(l.y - p.y) < p.h * 0.4 && p.x >= l.end - 1 && p.x - l.end < p.h * 1.5);
    if (prev) {
      prev.text += (p.x - prev.end > p.h * 0.15 ? " " : "") + p.text;
      prev.end = p.x + p.w;
    } else lines.push({ text: p.text, x: p.x, y: p.y, h: p.h, page, end: p.x + p.w });
  }
  return lines;
}

/** The line for `target` under this contest's heading, or null. */
function locate(lines: Line[], contest: Contest, target: string, needsAnchor: boolean): Line | null {
  const pages = contest.page == null ? null : new Set([contest.page, contest.page + 1]);
  const pool = pages ? lines.filter((l) => pages.has(l.page)) : lines;
  const hits = pool.filter((l) => matches(l.text, target));
  if (!hits.length) return null;
  if (hits.length === 1 && !needsAnchor) return hits[0];

  // Several matches (e.g. FOR/AGAINST under each proposition): take the one
  // closest below a line that starts this contest's title, in the same column.
  const titleKey = key(contest.title);
  const anchors = pool.filter((l) => {
    const k = key(l.text);
    return k.length >= 6 && titleKey.startsWith(k);
  });
  let best: { line: Line; d: number } | null = null;
  for (const hit of hits) {
    for (const a of anchors) {
      const d = a.y - hit.y;
      if (a.page === hit.page && d > 0 && d < 700 && Math.abs(a.x - hit.x) < 60 && (!best || d < best.d)) best = { line: hit, d };
    }
  }
  return best?.line ?? (needsAnchor ? null : hits[0]);
}

function findBox(img: ImageData, cx: number, cy: number): Box | null {
  const dark = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= img.width || y >= img.height) return false;
    const i = (Math.round(y) * img.width + Math.round(x)) * 4;
    return img.data[i] * 0.3 + img.data[i + 1] * 0.59 + img.data[i + 2] * 0.11 < 110;
  };
  const limit = 45 * SCALE;
  let x = cx;
  while (x > cx - limit && !dark(x, cy)) x--;
  if (!dark(x, cy)) return null;
  const right = x;
  while (x > right - 4 * SCALE && dark(x, cy)) x--;
  while (x > right - limit && !dark(x, cy)) x--;
  if (!dark(x, cy)) return null;
  const left = x;
  const mx = (left + right) / 2;
  let top = cy;
  while (top > cy - 20 * SCALE && !dark(mx, top)) top--;
  let bottom = cy;
  while (bottom < cy + 20 * SCALE && !dark(mx, bottom)) bottom++;
  const w = (right - left) / SCALE;
  const h = (bottom - top) / SCALE;
  if (!dark(mx, top) || !dark(mx, bottom) || w < 6 || w > 45 || h < 5 || h > 25) return null;
  return { x: left, y: top, w: right - left, h: bottom - top };
}

function drawCheck(page: PDFPage, x: number, y: number, size: number) {
  const opts = { thickness: 2, color: rgb(0, 0, 0) };
  page.drawLine({ start: { x, y: y + size * 0.45 }, end: { x: x + size * 0.35, y }, ...opts });
  page.drawLine({ start: { x: x + size * 0.35, y }, end: { x: x + size, y: y + size }, ...opts });
}

/** Whether the file has a text layer we can use (false for scans and photos). */
export async function canMark(file: File): Promise<boolean> {
  if (file.type !== "application/pdf") return false;
  const pdfjs = await loadPdfjs();
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const text = await (await (await task.promise).getPage(1)).getTextContent();
  await task.destroy();
  return text.items.some((i) => "str" in i && i.str.trim().length > 0);
}

export async function markOriginal(
  file: File,
  ballot: Ballot,
  choices: Record<string, string[]>,
): Promise<{ bytes: Uint8Array; report: MarkReport }> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdfjs = await loadPdfjs();
  const task = pdfjs.getDocument({ data: bytes.slice() });
  const src = await task.promise;
  const out = await PDFDocument.load(bytes, { ignoreEncryption: true });

  const lines: Line[] = [];
  for (let p = 0; p < src.numPages; p++) {
    const page = await src.getPage(p + 1);
    const text = await page.getTextContent();
    lines.push(...groupLines(text.items.filter((i) => "str" in i) as never, p));
  }

  // Find each pick's printed line first, so only pages with picks get rendered.
  const report: MarkReport = { filled: 0, checked: 0, missing: [] };
  const targets: Line[] = [];
  for (const contest of ballot.contests) {
    for (const pick of choices[contest.id] ?? []) {
      const line = locate(lines, contest, pick, contest.kind !== "candidate");
      if (line) targets.push(line);
      else report.missing.push(`${contest.title}: ${pick}`);
    }
  }

  for (const pageIndex of new Set(targets.map((t) => t.page))) {
    const page = await src.getPage(pageIndex + 1);
    const viewport = page.getViewport({ scale: SCALE });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const target = out.getPage(pageIndex);

    for (const line of targets.filter((t) => t.page === pageIndex)) {
      // Scan just left of the name, a third of the way up its first line.
      const [cx, cy] = viewport.convertToViewportPoint(line.x - 1.5, line.y + line.h * 0.35);
      const box = findBox(img, Math.round(cx), Math.round(cy));
      if (box) {
        const [x0, y0] = viewport.convertToPdfPoint(box.x, box.y + box.h);
        const [x1, y1] = viewport.convertToPdfPoint(box.x + box.w, box.y);
        const inset = 0.8;
        target.drawRectangle({
          x: Math.min(x0, x1) + inset,
          y: Math.min(y0, y1) + inset,
          width: Math.abs(x1 - x0) - inset * 2,
          height: Math.abs(y1 - y0) - inset * 2,
          color: rgb(0, 0, 0),
        });
        report.filled++;
      } else {
        drawCheck(target, line.x - 16, line.y, 11);
        report.checked++;
      }
    }
  }
  await task.destroy();
  return { bytes: await out.save(), report };
}
