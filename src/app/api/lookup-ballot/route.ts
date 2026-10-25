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
      return Response.json({ error: "Enter your full home address or ZIP code." }, { status: 400 });
    }
    // The Civic API needs a street address; a bare ZIP goes straight to web search.
    if (/^\d{5}(-\d{4})?$/.test(address)) return Response.json({ fallback: true }, { status: 404 });
    if (mockEnabled()) return Response.json({ ballot: await mockBallot() });
    // The address only goes to Google for this lookup; we don't log or store it.
    return Response.json({ ballot: await lookupBallot(address) });
  } catch (err) {
    // No Civic data: the client falls back to searching the web (/api/search-ballot).
    if (err instanceof LookupError) return Response.json({ error: err.message, fallback: err.status === 404 }, { status: err.status });
    return errorResponse(err);
  }
}
