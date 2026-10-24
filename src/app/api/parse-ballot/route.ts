import { extractFromFile } from "@/lib/ai";
import { costed, errorResponse } from "@/lib/http";
import { mockBallot, mockEnabled } from "@/lib/mock";
import { BALLOT_EXTRACTION } from "@/lib/prompts";
import { BallotSchema } from "@/lib/schema";

export const maxDuration = 300;

const ALLOWED = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/gif"];

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return Response.json({ error: "No file uploaded." }, { status: 400 });
    if (!ALLOWED.includes(file.type)) {
      return Response.json({ error: "Upload a PDF, JPG, PNG, or WebP." }, { status: 400 });
    }
    if (mockEnabled()) return Response.json({ ballot: await mockBallot(), cost: 0.004 });
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    const result = await extractFromFile(BallotSchema, { mediaType: file.type, base64 }, BALLOT_EXTRACTION);
    return Response.json(costed("extract", result, "ballot"));
  } catch (err) {
    return errorResponse(err);
  }
}
