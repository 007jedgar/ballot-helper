import { rateLimit, sameSite } from "@/lib/abuse";
import { LookupError, lookupBallot } from "@/lib/civic";
import { errorResponse } from "@/lib/http";
import { mockBallot, mockEnabled } from "@/lib/mock";

export async function POST(req: Request) {
  const blocked = sameSite(req) ?? (await rateLimit(req, "lookup"));
  if (blocked) return blocked;
  try {
    const body = await req.json().catch(() => null);
    const address = typeof body?.address === "string" ? body.address.trim().replace(/\s+/g, " ") : "";
    if (address.length < 5 || address.length > 200) {
      return Response.json({ error: "Enter your full home address." }, { status: 400 });
    }
    if (mockEnabled()) return Response.json({ ballot: await mockBallot() });
    // The address only goes to Google for this lookup; we don't log or store it.
    return Response.json({ ballot: await lookupBallot(address) });
  } catch (err) {
    if (err instanceof LookupError) return Response.json({ error: err.message }, { status: err.status });
    return errorResponse(err);
  }
}
