import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui";
import { readShare } from "@/lib/shares";
import { OpenShared } from "./open-shared";

type Props = { params: Promise<{ id: string }> };

const placeOf = (b: { jurisdiction: string | null; county: string | null; state: string | null }) =>
  [b.jurisdiction, b.county, b.state].filter(Boolean).join(", ");

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const share = await readShare((await params).id);
  if (!share) return { title: "Shared ballot · Ballot Helper" };
  const title = `${share.ballot.electionName ?? "Ballot"} research${share.ballot.county ? ` · ${share.ballot.county}` : ""}`;
  const n = share.ballot.contests.length;
  const description = `Nonpartisan research on ${n} ${n === 1 ? "race" : "races and measures"}${placeOf(share.ballot) ? ` for ${placeOf(share.ballot)}` : ""}. Open it to compare candidates and pick.`;
  return { title: `${title} · Ballot Helper`, description, openGraph: { title, description }, twitter: { title, description } };
}

export default async function SharedBallotPage({ params }: Props) {
  const { id } = await params;
  const share = await readShare(id);
  if (!share) notFound();

  const { ballot } = share;
  const races = ballot.contests.filter((c) => c.kind !== "measure").length;
  const measures = ballot.contests.length - races;
  const people = ballot.contests.flatMap((c) => (c.kind === "measure" ? [] : c.candidates)).length;
  const researched = Object.keys(share.candidates).length + Object.keys(share.measures).length;
  const flagged = Object.values(share.candidates).filter((c) => Array.isArray(c.redFlags) && c.redFlags.length > 0).length;
  const picks = share.choices ? Object.values(share.choices).filter((v) => v.length).length : 0;
  const created = new Date(share.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <div className="glow">
      <section className="mx-auto max-w-2xl px-4 pb-24 pt-20 sm:px-6">
        <p className="text-[13px] text-muted">Shared ballot research · {created}</p>
        <h1 className="mt-2 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
          {ballot.electionName ?? "Sample ballot"}
        </h1>
        <p className="mt-2 text-muted">{[ballot.electionDate, placeOf(ballot)].filter(Boolean).join(" · ")}</p>

        <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
          {[
            ["Races", races],
            ["Measures", measures],
            ["Candidates", people],
            ["Researched", `${researched}/${people + measures}`],
          ].map(([label, value]) => (
            <div key={label} className="bg-surface p-4">
              <dt className="text-[11px] font-medium uppercase tracking-[0.06em] text-faint">{label}</dt>
              <dd className="mt-1 text-xl font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-4 flex flex-wrap gap-2">
          {flagged > 0 && <Badge tone="bad">{flagged} candidate{flagged > 1 ? "s" : ""} with red flags</Badge>}
          {picks > 0 ? <Badge tone="accent">
              Includes the sharer&apos;s picks ({picks} {picks === 1 ? "item" : "items"})
            </Badge> : <Badge>No picks included</Badge>}
        </div>

        <div className="mt-10">
          <OpenShared id={id} />
        </div>
      </section>
    </div>
  );
}
