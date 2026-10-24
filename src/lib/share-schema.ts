import { z } from "zod";
import { ContestSchema } from "./schema";

/** A shared ballot: the contests plus finished research, and optionally the sharer's picks. */
export const ShareSnapshotSchema = z.object({
  ballot: z.object({
    electionName: z.string().max(300).nullable(),
    electionDate: z.string().max(40).nullable(),
    state: z.string().max(100).nullable(),
    county: z.string().max(100).nullable(),
    jurisdiction: z.string().max(300).nullable(),
    contests: z.array(ContestSchema.extend({ id: z.string().max(20), page: z.number().optional(), category: ContestSchema.shape.category.optional() })).max(500),
  }),
  // Research is validated loosely: entries cached before newer fields existed must still load.
  candidates: z.record(z.string().max(40), z.looseObject({ name: z.string() })),
  measures: z.record(z.string().max(40), z.looseObject({ title: z.string() })),
  choices: z.record(z.string().max(40), z.array(z.string().max(300)).max(50)).optional(),
});

export type ShareSnapshot = z.infer<typeof ShareSnapshotSchema>;
export type StoredShare = ShareSnapshot & { v: 1; createdAt: string };
