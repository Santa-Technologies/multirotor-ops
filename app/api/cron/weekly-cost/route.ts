import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { users } from "@/db/schema";
import { runCostRunsForAllCostPlus } from "@/lib/costing/run-cost-run";

export const maxDuration = 300;

/**
 * Vercel Cron: weekly cost refresh for every active cost-plus product.
 * Authorised with Authorization: Bearer CRON_SECRET.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json({ error: "CRON_SECRET is not configured." }, { status: 500 });
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const db = getDb();
  const [admin] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "admin"))
    .limit(1);

  if (!admin) {
    return Response.json(
      { error: "No admin user to attribute the cost run to." },
      { status: 500 },
    );
  }

  const results = await runCostRunsForAllCostPlus(admin.id);
  return Response.json({
    ok: true,
    runs: results.length,
    results: results.map((r) => ({
      costRunId: r.costRunId,
      coveragePct: r.coveragePct,
      flagCount: r.flagCount,
      snapshotCount: r.snapshotCount,
      providerErrors: r.providerErrors,
    })),
  });
}
