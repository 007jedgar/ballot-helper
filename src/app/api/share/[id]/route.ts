import { readShare } from "@/lib/shares";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const share = await readShare((await params).id);
  if (!share) return Response.json({ error: "Shared ballot not found." }, { status: 404 });
  return Response.json(share);
}
