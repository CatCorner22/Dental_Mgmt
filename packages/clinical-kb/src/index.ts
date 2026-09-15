export { advise } from "./advisor";
export type {
  Advice,
  AdviseOptions,
  AdvisorGauges,
  AdvisorReport,
  ByteMood,
  DoseGauge,
  GaugeNote,
  ReaderPillars
} from "./advisor";

export { KNOWLEDGE, detectPassive, entryMatchesAuthorScope } from "./knowledge";
export type { AdvisorAuthorScope, AdvisorContext, KnowledgeEntry } from "./knowledge";

export { KB_VERSION } from "./version";

export { getByteStarConfig, BYTESTAR_UNAVAILABLE } from "./cage/config";
export type { ByteStarConfig } from "./cage/config";

export { detectEscape, MODEL_ESCAPE_ORIGIN } from "./cage/escape";
export type { EscapeHit, EscapeKind } from "./cage/escape";

export {
  LADDER_WINDOW_MS,
  ladderStageForEscape,
  parseEscapeStage,
  isModelEscapeDetail,
  ladderWindowExpired
} from "./cage/ladder";
export type { LadderStage, ModelEscapeRow } from "./cage/ladder";

export {
  BYTESTAR_ONE_WAY_NOTICE,
  BYTESTAR_FORBIDDEN_USER_ACTIONS,
  isForbiddenUserAction
} from "./cage/one-way";
export type { ForbiddenUserAction } from "./cage/one-way";

export {
  resolveModes,
  resolveProfile,
  detectForeignJurisdiction,
  jurisdictionNoticeFor,
  hasStrongClaim,
  isRegulatorySource,
  isTennesseeSource,
  strictPromptAddendum
} from "./cage/router";
export type { ByteStarMode, ByteStarProfileId, ModeProfile } from "./cage/router";
