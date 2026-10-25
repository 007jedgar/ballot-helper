"use client";

import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { BallotExtract, CandidateResearch, ContestExtract, MeasureResearch } from "./schema";
import { DEFAULT_PREFS, straightTicketPicks, type Party, type Prefs } from "./prefs";
import type { ShareSnapshot } from "./share-schema";

// `category` is optional: ballots saved before it existed don't have it (see categoryOf).
export type Contest = Omit<ContestExtract, "category"> & Partial<Pick<ContestExtract, "category">> & { id: string; page?: number };
export type Ballot = Omit<BallotExtract, "contests"> & { contests: Contest[] };

export type Job<T> = {
  status: "idle" | "loading" | "done" | "error";
  data?: T;
  error?: string;
  /** Approximate USD the research cost to produce (its original cost when served from cache). */
  cost?: number | null;
};

export const candidateKey = (contestId: string, index: number) => `${contestId}::${index}`;

type State = {
  ballot: Ballot | null;
  fileName: string | null;
  /** Set when the ballot came from a web search for this area rather than an official source. */
  foundBy: string | null;
  candidates: Record<string, Job<CandidateResearch>>;
  measures: Record<string, Job<MeasureResearch>>;
  choices: Record<string, string[]>;
  step: number;
  paused: boolean;
  showFlags: boolean;
  /** Research preferences; kept across ballots as the next ballot's defaults. */
  prefs: Prefs;
  /** Research waits until the voter confirms preferences for this ballot. */
  prefsConfirmed: boolean;
  /** Contests the voter asked to research despite their preferences. */
  forced: Record<string, true>;
  /** Approximate USD spent reading the ballot file. */
  parseCost: number;
  /** The voter exported this ballot (shows the support card), and whether they closed that card. */
  exported: boolean;
  supportDismissed: boolean;
  setBallot: (
    ballot: Omit<BallotExtract, "contests"> & { contests: Omit<Contest, "id">[] },
    fileName: string,
    parseCost?: number,
    foundBy?: string | null,
  ) => void;
  importShare: (share: ShareSnapshot) => void;
  removeContest: (id: string) => void;
  /** Ballot corrections before research starts (candidate indexes key research jobs, so not after). */
  removeCandidate: (contestId: string, index: number) => void;
  setCandidateParty: (contestId: string, index: number, party: string | null) => void;
  setCandidateJob: (key: string, job: Job<CandidateResearch>) => void;
  setMeasureJob: (id: string, job: Job<MeasureResearch>) => void;
  toggleChoice: (contestId: string, value: string, voteFor: number) => void;
  setStep: (step: number) => void;
  setPaused: (paused: boolean) => void;
  setShowFlags: (show: boolean) => void;
  confirmPrefs: (prefs: Prefs, preselect: Record<string, string[]>) => void;
  forceContest: (id: string) => void;
  /** Selects `party`'s candidates in every partisan race; returns how many races were filled. */
  applyStraightTicket: (party: Party) => number;
  markExported: () => void;
  dismissSupport: () => void;
  reset: () => void;
};

const empty = {
  ballot: null,
  fileName: null,
  foundBy: null,
  candidates: {},
  measures: {},
  choices: {},
  step: 0,
  paused: false,
  showFlags: true,
  prefsConfirmed: false,
  forced: {},
  parseCost: 0,
  exported: false,
  supportDismissed: false,
};

export const useBallot = create<State>()(
  persist(
    (set, get) => ({
      ...empty,
      prefs: DEFAULT_PREFS,
      setBallot: (ballot, fileName, parseCost = 0, foundBy = null) =>
        set((s) => ({
          ...empty,
          showFlags: s.showFlags,
          fileName,
          parseCost,
          foundBy,
          ballot: { ...ballot, contests: ballot.contests.map((c, i) => ({ ...c, id: `c${i}` })) },
        })),
      importShare: (share) =>
        set((s) => {
          const done = <T,>(records: Record<string, unknown>): Record<string, Job<T>> =>
            Object.fromEntries(Object.entries(records).map(([k, data]) => [k, { status: "done", data: data as T }]));
          return {
            ...empty,
            showFlags: s.showFlags,
            fileName: share.ballot.electionName ?? "Shared ballot",
            ballot: share.ballot,
            candidates: done<CandidateResearch>(share.candidates),
            measures: done<MeasureResearch>(share.measures),
            choices: share.choices ?? {},
            prefsConfirmed: true,
          };
        }),
      removeContest: (id) =>
        set((s) => (s.ballot ? { ballot: { ...s.ballot, contests: s.ballot.contests.filter((c) => c.id !== id) } } : {})),
      removeCandidate: (contestId, index) =>
        set((s) => {
          if (!s.ballot) return {};
          const contests = s.ballot.contests
            .map((c) => (c.id === contestId ? { ...c, candidates: c.candidates.filter((_, i) => i !== index) } : c))
            // A race with nobody left in it isn't on the ballot.
            .filter((c) => c.kind === "measure" || c.candidates.length);
          return { ballot: { ...s.ballot, contests } };
        }),
      setCandidateParty: (contestId, index, party) =>
        set((s) =>
          s.ballot
            ? {
                ballot: {
                  ...s.ballot,
                  contests: s.ballot.contests.map((c) =>
                    c.id === contestId ? { ...c, candidates: c.candidates.map((x, i) => (i === index ? { ...x, party } : x)) } : c,
                  ),
                },
              }
            : {},
        ),
      setCandidateJob: (key, job) => set((s) => ({ candidates: { ...s.candidates, [key]: job } })),
      setMeasureJob: (id, job) => set((s) => ({ measures: { ...s.measures, [id]: job } })),
      toggleChoice: (contestId, value, voteFor) =>
        set((s) => {
          const current = s.choices[contestId] ?? [];
          let next: string[];
          if (current.includes(value)) next = current.filter((v) => v !== value);
          else if (voteFor <= 1) next = [value];
          else if (current.length < voteFor) next = [...current, value];
          else next = [...current.slice(1), value];
          return { choices: { ...s.choices, [contestId]: next } };
        }),
      setStep: (step) => set({ step }),
      setPaused: (paused) => set({ paused }),
      setShowFlags: (showFlags) => set({ showFlags }),
      confirmPrefs: (prefs, preselect) =>
        set((s) => ({ prefs, prefsConfirmed: true, choices: { ...preselect, ...s.choices } })),
      forceContest: (id) => set((s) => ({ forced: { ...s.forced, [id]: true } })),
      applyStraightTicket: (party) => {
        const ballot = get().ballot;
        if (!ballot) return 0;
        const picks = straightTicketPicks(ballot.contests, party);
        set((s) => ({ choices: { ...s.choices, ...picks } }));
        return Object.keys(picks).length;
      },
      markExported: () => set({ exported: true }),
      dismissSupport: () => set({ supportDismissed: true }),
      // Keep the red-flag preference across ballots.
      reset: () => set((s) => ({ ...empty, showFlags: s.showFlags })),
    }),
    {
      name: "ballot-helper",
      version: 1,
      // A request in flight when the tab closed is gone; let it be retried.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<State>;
        const unstick = <T,>(jobs: Record<string, Job<T>> = {}) =>
          Object.fromEntries(Object.entries(jobs).map(([k, j]) => [k, j.status === "loading" ? { status: "idle" } : j]));
        return {
          ...current,
          ...p,
          candidates: unstick(p.candidates),
          measures: unstick(p.measures),
          prefs: { ...DEFAULT_PREFS, ...p.prefs },
          // Ballots saved before preferences existed were already researching.
          prefsConfirmed: p.prefsConfirmed ?? Boolean(p.ballot),
        } as State;
      },
    },
  ),
);

/** True once the persisted state has been loaded from localStorage. */
export function useHydrated() {
  return useSyncExternalStore(
    (cb) => useBallot.persist.onFinishHydration(cb),
    () => useBallot.persist.hasHydrated(),
    () => false,
  );
}
