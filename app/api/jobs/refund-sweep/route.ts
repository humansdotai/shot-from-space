/**
 * POST /api/jobs/refund-sweep → { closed, failed, inspected }
 *
 * THE TRIGGER FOR THE SIXTY-DAY REFUND GUARANTEE.
 *
 * /legal/terms says a mission with no usable frame after sixty days "is
 * closed and refunded in full. You do not need to ask." `closeUnfulfilledMissions()`
 * is what makes that true; this route is how a timer reaches it.
 *
 * WIRE IT UP — the guarantee is not kept until something calls this daily.
 *   1. Set CRON_SECRET to a long random string in the deployment environment.
 *   2. On Vercel, add to vercel.json:
 *        { "crons": [{ "path": "/api/jobs/refund-sweep", "schedule": "0 3 * * *" }] }
 *      Vercel Cron sends GET, so GET is accepted too and carries the platform's
 *      own `Authorization: Bearer $CRON_SECRET` header.
 *   3. Anywhere else: any scheduler that can POST with the same header.
 *
 * Running it more often than daily is harmless — a mission it has closed is
 * CANCELLED and no longer matches.
 *
 * WITHOUT CRON_SECRET the route refuses every request. An unauthenticated
 * endpoint that cancels and refunds missions is not something to leave open by
 * default, and failing closed makes the missing configuration loud.
 */
import { closeUnfulfilledMissions } from '@/lib/missions';
import { fail, handleError, ok } from '@/lib/missions/http';

export const dynamic = 'force-dynamic';

function authorised(req: Request): boolean {
  const secret = process.env.CRON_SECRET ?? '';
  if (!secret) return false;
  const header = req.headers.get('authorization') ?? '';
  return header === `Bearer ${secret}`;
}

async function run(req: Request) {
  if (!authorised(req)) {
    return fail(
      401,
      'NOT_AUTHORISED',
      'This job runs on a schedule. Set CRON_SECRET and send it as a bearer token.',
    );
  }

  try {
    const result = await closeUnfulfilledMissions();
    if (result.failed.length > 0) {
      // A refund that did not go through is money still owed to a customer.
      // It must be loud in the logs, not buried in a 200 body.
      console.error('[jobs/refund-sweep] refunds outstanding:', result.failed.join(', '));
    }
    return ok(result);
  } catch (err) {
    return handleError('jobs/refund-sweep', err);
  }
}

export async function POST(req: Request) {
  return run(req);
}

/** Vercel Cron issues GET. Same guard, same work. */
export async function GET(req: Request) {
  return run(req);
}
