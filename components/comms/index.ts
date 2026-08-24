/**
 * MISSION COMMS — the in-mission channel to the Mission Control operator.
 *
 * One public component. Mission Control (Agent 5) mounts exactly this:
 *
 *   <MissionComms missionCode="32BF" stage="CAPTURE_WINDOW" />
 *   <MissionComms missionCode="32BF" stage="CAPTURE_WINDOW" readOnly />
 *
 * It loads its own transcript from /api/comms/[code], sends its own messages,
 * and owns the voice link dialog. Nothing else needs to be wired up.
 */
export { MissionComms } from './MissionComms';
export { SUGGESTED_QUERIES, suggestionsFor } from './suggestions';
