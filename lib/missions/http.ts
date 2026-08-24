/**
 * HTTP helpers shared by the backend's route handlers
 * (app/api/{missions,orders,checkout,geocode,webhooks,dev}).
 *
 * Every failure shape in this product is `{ error, detail? }` — see
 * CONTRACT.md §6. Stack traces never reach the client, and a missing
 * integration key never produces a 500.
 */
import { NextResponse } from 'next/server';
import { ZodError, type ZodType } from 'zod';
import type { ApiError } from '@/lib/types';
import {
  MissionNotFoundError,
  MissionTransitionError,
  MissionValidationError,
} from './errors';

export function ok<T>(body: T, init?: ResponseInit) {
  return NextResponse.json(body, init);
}

export function fail(status: number, error: string, detail?: string) {
  const body: ApiError = detail ? { error, detail } : { error };
  return NextResponse.json(body, { status });
}

/** Parses a JSON body against a schema, returning a typed result or a 400. */
export async function readJson<T>(
  req: Request,
  schema: ZodType<T>,
): Promise<{ data: T; response?: never } | { data?: never; response: NextResponse }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { response: fail(400, 'INVALID_BODY', 'Request body must be JSON.') };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { response: fail(400, 'INVALID_BODY', formatZodError(parsed.error)) };
  }
  return { data: parsed.data };
}

export function formatZodError(err: ZodError): string {
  return err.issues
    .map((i) => `${i.path.join('.') || 'body'}: ${i.message}`)
    .join('; ');
}

/**
 * Maps a thrown mission error onto the right status code. Anything unexpected
 * becomes a 500 with a generic message — the real error is logged server-side.
 */
export function handleError(scope: string, err: unknown): NextResponse {
  if (err instanceof MissionNotFoundError) {
    return fail(404, 'MISSION_NOT_FOUND', err.message);
  }
  if (err instanceof MissionTransitionError) {
    return fail(409, 'ILLEGAL_TRANSITION', err.message);
  }
  if (err instanceof MissionValidationError) {
    return fail(400, 'INVALID_INPUT', err.message);
  }
  if (err instanceof ZodError) {
    return fail(400, 'INVALID_INPUT', formatZodError(err));
  }
  console.error(`[api:${scope}]`, err);
  return fail(500, 'UNAVAILABLE', 'Mission control could not complete that request.');
}
