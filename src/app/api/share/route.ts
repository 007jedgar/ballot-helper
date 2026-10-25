import { rateLimit, sameSite } from "@/lib/abuse";
import { errorResponse } from "@/lib/http";
import { ShareSnapshotSchema } from "@/lib/share-schema";
import { createShare, sharingEnabled } from "@/lib/shares";

const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(req: Request) {
  const blocked = sameSite(req) ?? (await rateLimit(req, "share"));
  if (blocked) return blocked;
  if (!sharingEnabled()) return Response.json({ error: "Sharing isn't set up on this server (no Blob store connected)." }, { status: 501 });
  const text = await req.text();
  if (text.length > MAX_BYTES) return Response.json({ error: "This ballot is too large to share." }, { status: 413 });
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const snapshot = ShareSnapshotSchema.safeParse(json);
  if (!snapshot.success) return Response.json({ error: "Invalid ballot data." }, { status: 400 });
  try {
    const id = await createShare(snapshot.data);
    return Response.json({ id, path: `/s/${id}` });
  } catch (err) {
    return errorResponse(err);
  }
}
