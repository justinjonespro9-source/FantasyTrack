export const PARSER_VERSION = "1.0.0";

export const IMPORT_OPEN_TAG = "[FANTASYTRACK_IMPORT]";
export const IMPORT_CLOSE_TAG = "[/FANTASYTRACK_IMPORT]";

export const KNOWN_CONTEST_TYPES = [
  "POSITION_WEEKLY",
  "SINGLE_GAME",
  "CUSTOM_SLATE",
] as const;

export const KNOWN_SPORTS = ["NFL"] as const;

export const KNOWN_SCORING = ["PPR", "HALF_PPR", "STANDARD"] as const;

export const KNOWN_SLATES = [
  "SUNDAY_EARLY",
  "SUNDAY_LATE",
  "SUNDAY_AFTERNOON",
  "PRIME_TIME",
  "SINGLE_GAME",
  "CUSTOM",
] as const;

export const IMPORT_STATUSES = [
  "ACTIVE",
  "QUESTIONABLE",
  "DOUBTFUL",
  "OUT",
  "IR",
  "PUP",
  "SUSPENDED",
  "INACTIVE",
  "UNKNOWN",
] as const;

export type ImportStatus = (typeof IMPORT_STATUSES)[number];

export type FantasyTrackImportMetadata = {
  contestType?: string;
  sport?: string;
  season?: number;
  week?: number;
  position?: string;
  scoring?: string;
  slate?: string;
  [key: string]: string | number | undefined;
};

export type FantasyTrackImportRow = {
  sourceRowNumber: number;
  rank: number | null;
  playerName: string;
  team: string;
  opponent: string;
  position: string;
  depthRole: string | null;
  projectedPoints: number | null;
  status: string | null;
  statusNormalized: ImportStatus | null;
  notes: string | null;
  included?: boolean;
};

export type FantasyTrackImportIssue = {
  severity: "error" | "warning";
  row?: number;
  field?: string;
  message: string;
  code?: string;
};

export type FantasyTrackImportResult = {
  metadata: FantasyTrackImportMetadata;
  rows: FantasyTrackImportRow[];
  errors: FantasyTrackImportIssue[];
  warnings: FantasyTrackImportIssue[];
};

export type ContestImportContext = {
  contestType?: string | null;
  sport?: string | null;
  season?: number | null;
  week?: number | null;
  scoringFormat?: string | null;
  slate?: string | null;
  positionHint?: string | null;
};

export type ValidatedImportRow = FantasyTrackImportRow & {
  issues: FantasyTrackImportIssue[];
  state: "ready" | "warning" | "error";
};

export type ImportValidationSummary = {
  parsedCount: number;
  readyCount: number;
  warningCount: number;
  errorCount: number;
  teamCount: number;
  roleCounts: Record<string, number>;
  statusCounts: Record<string, number>;
  message: string;
};

export type DuplicateMode = "SKIP" | "UPDATE" | "CANCEL";

export type EditableImportRow = FantasyTrackImportRow & {
  clientId: string;
  included: boolean;
};

export type RosterImportApiResult = {
  success: boolean;
  importedCount: number;
  skippedCount: number;
  updatedCount: number;
  warningCount: number;
  batchId?: string;
  errors: Array<{
    row?: number;
    field?: string;
    message: string;
  }>;
};
