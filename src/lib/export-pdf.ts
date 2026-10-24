import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { Ballot } from "./store";

const PAGE = { w: 612, h: 792 };
const M = 54;
const INK = rgb(0.08, 0.08, 0.1);
const MUTED = rgb(0.42, 0.44, 0.48);
const ACCENT = rgb(0.37, 0.42, 0.82);

// Standard fonts only encode WinAnsi; drop anything outside it.
const safe = (s: string) => s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[^\x20-\x7E\xA0-\xFF]/g, "");

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of safe(text).split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) > width && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

export async function exportBallotPdf(ballot: Ballot, choices: Record<string, string[]>): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page: PDFPage = doc.addPage([PAGE.w, PAGE.h]);
  let y = PAGE.h - M;

  const ensure = (needed: number) => {
    if (y - needed < M) {
      page = doc.addPage([PAGE.w, PAGE.h]);
      y = PAGE.h - M;
    }
  };
  const text = (s: string, x: number, size: number, font: PDFFont, color = INK, width = PAGE.w - M - x) => {
    for (const line of wrap(s, font, size, width)) {
      ensure(size + 4);
      page.drawText(line, { x, y: y - size, size, font, color });
      y -= size + 4;
    }
  };
  const box = (checked: boolean, x: number, top: number) => {
    page.drawRectangle({ x, y: top - 11, width: 11, height: 11, borderColor: checked ? ACCENT : MUTED, borderWidth: 1, color: checked ? ACCENT : undefined });
    if (checked) {
      page.drawLine({ start: { x: x + 2.5, y: top - 5.5 }, end: { x: x + 4.8, y: top - 8.5 }, thickness: 1.5, color: rgb(1, 1, 1) });
      page.drawLine({ start: { x: x + 4.8, y: top - 8.5 }, end: { x: x + 8.8, y: top - 2.5 }, thickness: 1.5, color: rgb(1, 1, 1) });
    }
  };

  text("My Sample Ballot", M, 20, bold);
  const sub = [ballot.electionName, ballot.electionDate, ballot.jurisdiction ?? ballot.county, ballot.state].filter(Boolean).join("  ·  ");
  if (sub) text(sub, M, 10, regular, MUTED);
  y -= 4;
  text("Personal reference only. Not an official ballot.", M, 8, regular, MUTED);
  y -= 14;

  for (const contest of ballot.contests) {
    const picked = choices[contest.id] ?? [];
    const rows = contest.kind === "candidate" ? contest.candidates.map((c) => ({ value: c.name, label: c.party ? `${c.name}  (${c.party})` : c.name })) : (contest.options.length ? contest.options : ["Yes", "No"]).map((o) => ({ value: o, label: o }));
    ensure(40 + rows.length * 18);
    page.drawLine({ start: { x: M, y }, end: { x: PAGE.w - M, y }, thickness: 0.5, color: rgb(0.85, 0.86, 0.88) });
    y -= 10;
    text(contest.title, M, 11, bold);
    const detail = [
      contest.district,
      contest.kind === "retention" ? `Retain ${contest.candidates[0]?.name ?? ""}?` : null,
      contest.kind === "candidate" && contest.voteFor > 1 ? `Vote for up to ${contest.voteFor}` : null,
    ].filter(Boolean).join("  ·  ");
    if (detail) text(detail, M, 9, regular, MUTED);
    y -= 4;
    for (const row of rows) {
      ensure(18);
      const checked = picked.includes(row.value);
      box(checked, M + 4, y);
      const top = y;
      text(row.label, M + 24, 10, checked ? bold : regular, checked ? INK : MUTED);
      y = Math.min(y, top - 14);
      y -= 2;
    }
    if (!picked.length) text("No selection", M + 24, 8, regular, MUTED);
    y -= 10;
  }
  return doc.save();
}
