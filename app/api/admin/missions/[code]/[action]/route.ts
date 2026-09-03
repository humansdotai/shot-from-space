/**
 * POST /api/admin/missions/[code]/approve   → approve the final version, place the Gelato print
 * POST /api/admin/missions/[code]/advance   → walk one stage (never into PRINT — that is `approve`)
 * POST /api/admin/missions/[code]/refund    → refund on Stripe and cancel the mission
 * POST /api/admin/missions/[code]/print     { fileUrl | null } → set / clear the replacement print file
 * POST /api/admin/missions/[code]/reprint   → send the current print file to Gelato as a new order
 *
 * All three require the admin cookie (lib/admin.ts).
 */
import { isAdminRequest } from '@/lib/admin';
import { normalizeMissionCode } from '@/lib/codes';
import { z } from 'zod';
import { advanceMission, cancelMission, getMissionRowByCode, reprintMission, setPrintFile } from '@/lib/missions';
import { fail, handleError, ok, readJson } from '@/lib/missions/http';

const PrintBody = z.object({ fileUrl: z.string().trim().max(2000).nullable() });

export const dynamic = 'force-dynamic';

export async function POST(req: Request, ctx: { params: Promise<{ code: string; action: string }> }) {
  if (!(await isAdminRequest())) return fail(401, 'NOT_ADMIN', 'Admin access required.');

  const { code, action } = await ctx.params;
  const normalized = normalizeMissionCode(code);
  if (!normalized) return fail(400, 'INVALID_CODE', 'A mission code is two digits followed by two letters.');

  try {
    const row = await getMissionRowByCode(normalized);
    if (!row) return fail(404, 'MISSION_NOT_FOUND', `No mission file exists for ${normalized}.`);

    switch (action) {
      case 'approve': {
        if (!row.paidAt) return fail(409, 'UNPAID', 'This mission is not paid; nothing can be printed.');
        if (row.state !== 'PROCESSING') {
          return fail(409, 'NOT_READY', `Approval applies at PROCESSING; this mission is at ${row.state}.`);
        }
        const mission = await advanceMission(normalized, 'PRINT', { approvePrint: true });
        return ok({ mission });
      }
      case 'advance': {
        const mission = await advanceMission(normalized);
        return ok({ mission });
      }
      case 'print': {
        const parsed = await readJson(req, PrintBody);
        if (parsed.response) return parsed.response;
        const mission = await setPrintFile(normalized, parsed.data.fileUrl);
        return ok({ mission });
      }
      case 'reprint': {
        const mission = await reprintMission(normalized);
        return ok({ mission });
      }
      case 'refund': {
        // Cancellation IS the refund: the CANCELLED transition refunds the
        // Stripe payment when there is one and writes the outcome into the
        // timeline (lib/missions/state.ts → cancelEffect).
        const mission = await cancelMission(normalized);
        return ok({ mission });
      }
      default:
        return fail(404, 'UNKNOWN_ACTION', `No admin action "${action}".`);
    }
  } catch (err) {
    return handleError('admin/missions/[code]/[action]', err);
  }
}

export function GET() {
  return fail(405, 'METHOD_NOT_ALLOWED', 'Use POST.');
}
