/**
 * Typed errors for the mission layer.
 * Routes map these onto status codes; nothing else should throw raw strings.
 */

export class MissionNotFoundError extends Error {
  readonly kind = 'MISSION_NOT_FOUND' as const;
  constructor(public readonly missionCode: string) {
    super(`Mission ${missionCode} not found`);
    this.name = 'MissionNotFoundError';
  }
}

export class MissionTransitionError extends Error {
  readonly kind = 'ILLEGAL_TRANSITION' as const;
  constructor(
    public readonly from: string,
    public readonly to: string,
    detail?: string,
  ) {
    super(detail ?? `Illegal mission transition: ${from} → ${to}`);
    this.name = 'MissionTransitionError';
  }
}

export class MissionValidationError extends Error {
  readonly kind = 'INVALID_INPUT' as const;
  constructor(detail: string) {
    super(detail);
    this.name = 'MissionValidationError';
  }
}

export type MissionError =
  | MissionNotFoundError
  | MissionTransitionError
  | MissionValidationError;

export function isMissionError(err: unknown): err is MissionError {
  return (
    err instanceof MissionNotFoundError ||
    err instanceof MissionTransitionError ||
    err instanceof MissionValidationError
  );
}
