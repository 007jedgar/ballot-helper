"use client";

import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { BallotExtract, CandidateResearch, ContestExtract, MeasureResearch } from "./schema";

export type Contest = ContestExtract & { id: string };
export type Ballot = Omit<BallotExtract, "contests"> & { contests: Contest[] };

export type Job<T> = { status: "idle" | "loading" | "done" | "error"; data?: T; error?: string };

export const candidateKey = (contestId: string, index: number) => `${contestId}::${index}`;

type State = {
  ballot: Ballot | null;
  fileName: string | null;
  candidates: Record<string, Job<CandidateResearch>>;
  measures: Record<string, Job<MeasureResearch>>;
  choices: Record<string, string[]>;
  step: number;
  paused: boolean;
  setBallot: (ballot: BallotExtract, fileName: string) => void;
  removeContest: (id: string) => void;
  setCandidateJob: (key: string, job: Job<CandidateResearch>) => void;
  setMeasureJob: (id: string, job: Job<MeasureResearch>) => void;
  toggleChoice: (contestId: string, value: string, voteFor: number) => void;
  setStep: (step: number) => void;
  setPaused: (paused: boolean) => void;
  reset: () => void;
};

const empty = { ballot: null, fileName: null, candidates: {}, measures: {}, choices: {}, step: 0, paused: false };

export const useBallot = create<State>()(
  persist(
    (set) => ({
      ...empty,
      setBallot: (ballot, fileName) =>
        set({
          ...empty,
          fileName,
          ballot: { ...ballot, contests: ballot.contests.map((c, i) => ({ ...c, id: `c${i}` })) },
        }),
      removeContest: (id) =>
        set((s) => (s.ballot ? { ballot: { ...s.ballot, contests: s.ballot.contests.filter((c) => c.id !== id) } } : {})),
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
      reset: () => set(empty),
    }),
    {
      name: "ballot-helper",
      version: 1,
      // A request in flight when the tab closed is gone; let it be retried.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<State>;
        const unstick = <T,>(jobs: Record<string, Job<T>> = {}) =>
          Object.fromEntries(Object.entries(jobs).map(([k, j]) => [k, j.status === "loading" ? { status: "idle" } : j]));
        return { ...current, ...p, candidates: unstick(p.candidates), measures: unstick(p.measures) } as State;
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
