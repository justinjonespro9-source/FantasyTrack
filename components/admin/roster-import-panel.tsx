"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  WEEK1_RB_SAMPLE_IMPORT,
  buildAiRosterPrompt,
  canImport,
  expectedRolesFromPreset,
  getRolePresetsForPosition,
  parseFantasyTrackImport,
  validateFantasyTrackImport,
  type DuplicateMode,
  type EditableImportRow,
  type ImportValidationSummary,
  type RosterImportApiResult,
  type ValidatedImportRow,
} from "@/lib/roster-import";
import { normalizeStatus } from "@/lib/roster-import/normalize";

export type RosterImportContestOption = {
  id: string;
  title: string;
  sport: string;
  status: string;
  startTime: string;
  contestType: string | null;
  season: number | null;
  week: number | null;
  scoringFormat: string | null;
  slate: string | null;
  marketMode: string | null;
  laneCount: number;
};

type ImportBatchSummary = {
  id: string;
  createdAt: string;
  sourceLabel: string;
  parsedCount: number;
  importedCount: number;
  skippedCount: number;
  updatedCount: number;
  warningCount: number;
};

type Props = {
  contests: RosterImportContestOption[];
  initialContestId?: string;
  initialBatches?: ImportBatchSummary[];
};

function newClientId() {
  return `row-${Math.random().toString(36).slice(2, 10)}`;
}

function toEditable(rows: ValidatedImportRow[]): EditableImportRow[] {
  return rows.map((r) => ({
    ...r,
    clientId: newClientId(),
    included: r.included !== false,
  }));
}

function stateColor(state: "ready" | "warning" | "error") {
  if (state === "error") return "text-red-300 bg-red-950/40 border-red-800";
  if (state === "warning") return "text-amber-200 bg-amber-950/30 border-amber-800";
  return "text-emerald-200 bg-emerald-950/30 border-emerald-800";
}

export default function RosterImportPanel({
  contests,
  initialContestId,
  initialBatches = [],
}: Props) {
  const [contestId, setContestId] = useState(
    initialContestId && contests.some((c) => c.id === initialContestId)
      ? initialContestId
      : contests[0]?.id ?? ""
  );
  const selected = contests.find((c) => c.id === contestId) ?? null;

  const [contestType, setContestType] = useState(selected?.contestType ?? "POSITION_WEEKLY");
  const [season, setSeason] = useState(String(selected?.season ?? 2026));
  const [week, setWeek] = useState(String(selected?.week ?? 1));
  const [scoring, setScoring] = useState(selected?.scoringFormat ?? "HALF_PPR");
  const [slate, setSlate] = useState(selected?.slate ?? "SUNDAY_AFTERNOON");
  const [position, setPosition] = useState("RB");
  const [rolePreset, setRolePreset] = useState("RB:RB1_RB2");
  const [includeProjections, setIncludeProjections] = useState(true);
  const [includeStatus, setIncludeStatus] = useState(true);
  const [includeNotes, setIncludeNotes] = useState(true);
  const [promptCopied, setPromptCopied] = useState(false);
  const [shellSaved, setShellSaved] = useState(false);

  const [rawText, setRawText] = useState("");
  const [editableRows, setEditableRows] = useState<EditableImportRow[]>([]);
  const [validatedRows, setValidatedRows] = useState<ValidatedImportRow[]>([]);
  const [summary, setSummary] = useState<ImportValidationSummary | null>(null);
  const [metadata, setMetadata] = useState<Record<string, string | number | undefined>>({});
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [duplicateMode, setDuplicateMode] = useState<DuplicateMode>("SKIP");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<RosterImportApiResult | null>(null);
  const [batches, setBatches] = useState(initialBatches);

  const rolePresets = useMemo(
    () => getRolePresetsForPosition(position, contestType),
    [position, contestType]
  );

  function onContestChange(id: string) {
    setContestId(id);
    const c = contests.find((x) => x.id === id);
    if (!c) return;
    setContestType(c.contestType ?? "POSITION_WEEKLY");
    setSeason(String(c.season ?? 2026));
    setWeek(String(c.week ?? 1));
    setScoring(c.scoringFormat ?? "HALF_PPR");
    setSlate(c.slate ?? "SUNDAY_AFTERNOON");
    setImportResult(null);
    void refreshBatches(id);
  }

  async function refreshBatches(id: string) {
    try {
      const res = await fetch(`/api/admin/roster-import?contestId=${encodeURIComponent(id)}`);
      if (!res.ok) return;
      const data = (await res.json()) as { batches: ImportBatchSummary[] };
      setBatches(
        (data.batches ?? []).map((b) => ({
          ...b,
          createdAt: typeof b.createdAt === "string" ? b.createdAt : String(b.createdAt),
        }))
      );
    } catch {
      /* ignore */
    }
  }

  async function saveContestShell() {
    if (!contestId) return;
    setShellSaved(false);
    const res = await fetch("/api/admin/roster-import", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contestId,
        contestType,
        season: Number(season) || null,
        week: Number(week) || null,
        scoringFormat: scoring,
        slate,
        marketMode: "PURE_POOL",
      }),
    });
    if (res.ok) setShellSaved(true);
  }

  async function copyPrompt() {
    const prompt = buildAiRosterPrompt({
      season: Number(season) || 2026,
      week: Number(week) || 1,
      contestType,
      position,
      slate,
      scoring,
      rolePreset,
      includeProjections,
      includeStatus,
      includeNotes,
    });
    await navigator.clipboard.writeText(prompt);
    setPromptCopied(true);
    window.setTimeout(() => setPromptCopied(false), 2000);
  }

  function revalidateRows(nextRows: EditableImportRow[], nextMeta = metadata) {
    const parsedLike = {
      metadata: nextMeta,
      rows: nextRows.map(({ clientId: _c, ...rest }) => rest),
      errors: [] as never[],
      warnings: [] as never[],
    };
    const result = validateFantasyTrackImport(
      parsedLike,
      selected
        ? {
            contestType,
            sport: selected.sport,
            season: Number(season) || null,
            week: Number(week) || null,
            scoringFormat: scoring,
            slate,
          }
        : null,
      { expectedRoles: expectedRolesFromPreset(rolePreset) }
    );
    setValidatedRows(result.rows);
    setSummary(result.summary);
    setParseErrors(result.errors.map((e) => e.message));
    return result;
  }

  function parseImport() {
    setImportResult(null);
    const parsed = parseFantasyTrackImport(rawText);
    const result = validateFantasyTrackImport(
      parsed,
      selected
        ? {
            contestType,
            sport: selected.sport,
            season: Number(season) || null,
            week: Number(week) || null,
            scoringFormat: scoring,
            slate,
          }
        : null,
      { expectedRoles: expectedRolesFromPreset(rolePreset) }
    );
    setMetadata(parsed.metadata);
    setEditableRows(toEditable(result.rows));
    setValidatedRows(result.rows);
    setSummary(result.summary);
    setParseErrors([
      ...parsed.errors.map((e) => e.message),
      ...result.errors.filter((e) => e.code === "UNPARSEABLE_ROW").map((e) => e.message),
    ]);
  }

  function clearPaste() {
    setRawText("");
    setEditableRows([]);
    setValidatedRows([]);
    setSummary(null);
    setMetadata({});
    setParseErrors([]);
    setImportResult(null);
  }

  function updateRow(clientId: string, patch: Partial<EditableImportRow>) {
    setEditableRows((prev) => {
      const next = prev.map((r) => {
        if (r.clientId !== clientId) return r;
        const merged = { ...r, ...patch };
        if ("status" in patch) {
          const s = normalizeStatus(merged.status);
          merged.statusNormalized = s.normalized;
        }
        return merged;
      });
      revalidateRows(next);
      return next;
    });
  }

  // Selected-for-removal (separate from Include checkbox)
  const [marked, setMarked] = useState<Record<string, boolean>>({});

  function removeMarked() {
    setEditableRows((prev) => {
      const next = prev.filter((r) => !marked[r.clientId]);
      setMarked({});
      revalidateRows(next);
      return next;
    });
  }

  function addPlayer() {
    const row: EditableImportRow = {
      clientId: newClientId(),
      sourceRowNumber: editableRows.length + 1,
      rank: (editableRows.length || 0) + 1,
      playerName: "",
      team: "",
      opponent: "",
      position: position.toUpperCase(),
      depthRole: null,
      projectedPoints: null,
      status: "ACTIVE",
      statusNormalized: "ACTIVE",
      notes: null,
      included: true,
    };
    const next = [...editableRows, row];
    setEditableRows(next);
    revalidateRows(next);
  }

  function sortByRank() {
    setEditableRows((prev) => {
      const next = [...prev].sort((a, b) => (a.rank ?? 9999) - (b.rank ?? 9999));
      revalidateRows(next);
      return next;
    });
  }

  function sortByProjection() {
    setEditableRows((prev) => {
      const next = [...prev].sort(
        (a, b) => (b.projectedPoints ?? -1) - (a.projectedPoints ?? -1)
      );
      revalidateRows(next);
      return next;
    });
  }

  async function runImport() {
    if (!contestId || !rawText.trim()) return;
    const validation = revalidateRows(editableRows);
    if (!canImport(validation.errors)) {
      setImportResult({
        success: false,
        importedCount: 0,
        skippedCount: 0,
        updatedCount: 0,
        warningCount: validation.warnings.length,
        errors: validation.errors.map((e) => ({
          row: e.row,
          field: e.field,
          message: e.message,
        })),
      });
      return;
    }

    const readyCount = editableRows.filter((r) => r.included !== false).length;
    const ok = window.confirm(
      `Import ${readyCount} players into ${selected?.title ?? "this contest"}?`
    );
    if (!ok) return;

    setImporting(true);
    setImportResult(null);
    try {
      const res = await fetch("/api/admin/roster-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contestId,
          rawText,
          rows: editableRows,
          duplicateMode,
          expectedRoles: expectedRolesFromPreset(rolePreset),
        }),
      });
      const data = (await res.json()) as RosterImportApiResult;
      setImportResult(data);
      if (data.success) {
        await refreshBatches(contestId);
      }
    } catch {
      setImportResult({
        success: false,
        importedCount: 0,
        skippedCount: 0,
        updatedCount: 0,
        warningCount: 0,
        errors: [{ message: "Network error during import" }],
      });
    } finally {
      setImporting(false);
    }
  }

  const validationByRow = useMemo(() => {
    const map = new Map<number, ValidatedImportRow>();
    for (const r of validatedRows) map.set(r.sourceRowNumber, r);
    return map;
  }, [validatedRows]);

  return (
    <div className="space-y-6">
      {/* A. Contest setup */}
      <section className="rounded-xl border border-neutral-800 bg-neutral-900/80 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-neutral-50">Contest setup</h2>
            <p className="mt-1 text-sm text-neutral-400">
              Select a contest shell, then import an AI-generated field. Rankings organize the field —
              the pool prices it.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            <Link href="/admin" className="text-ft-gold hover:underline">
              Contest settings
            </Link>
            {contestId ? (
              <>
                <Link
                  href={`/admin/contest-field?contestId=${contestId}`}
                  className="text-ft-gold hover:underline"
                >
                  Field review
                </Link>
                <Link
                  href={`/contest/${contestId}`}
                  className="text-ft-gold hover:underline"
                >
                  Public preview
                </Link>
              </>
            ) : null}
          </div>
        </div>

        {contests.length === 0 ? (
          <p className="mt-4 text-sm text-neutral-400">
            No contests found. Create a DRAFT contest on the admin page first.
          </p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="block text-sm text-neutral-300">
              Contest
              <select
                className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100"
                value={contestId}
                onChange={(e) => onContestChange(e.target.value)}
              >
                {contests.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title} · {c.status} · {c.laneCount} lanes
                  </option>
                ))}
              </select>
            </label>
            <div className="rounded-lg border border-neutral-800 bg-black/30 p-3 text-sm text-neutral-300">
              <p>
                Sport: <span className="text-neutral-100">{selected?.sport ?? "—"}</span>
              </p>
              <p>
                Lock / start:{" "}
                <span className="text-neutral-100">
                  {selected ? new Date(selected.startTime).toLocaleString() : "—"}
                </span>
              </p>
              <p className="mt-1 text-xs text-neutral-500">Market mode: PURE_POOL (v1)</p>
            </div>

            <label className="block text-sm text-neutral-300">
              Contest type
              <select
                className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2"
                value={contestType}
                onChange={(e) => {
                  setContestType(e.target.value);
                  const presets = getRolePresetsForPosition(position, e.target.value);
                  if (presets[0]) setRolePreset(presets[0].value);
                }}
              >
                <option value="POSITION_WEEKLY">POSITION_WEEKLY</option>
                <option value="SINGLE_GAME">SINGLE_GAME</option>
                <option value="CUSTOM_SLATE">CUSTOM_SLATE</option>
              </select>
            </label>
            <label className="block text-sm text-neutral-300">
              Scoring
              <select
                className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2"
                value={scoring}
                onChange={(e) => setScoring(e.target.value)}
              >
                <option value="PPR">PPR (Full, historical)</option>
                <option value="HALF_PPR">HALF_PPR (V2 + yardage bonuses)</option>
                <option value="STANDARD">STANDARD</option>
              </select>
            </label>
            <label className="block text-sm text-neutral-300">
              Season
              <input
                className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2"
                value={season}
                onChange={(e) => setSeason(e.target.value)}
              />
            </label>
            <label className="block text-sm text-neutral-300">
              Week
              <input
                className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2"
                value={week}
                onChange={(e) => setWeek(e.target.value)}
              />
            </label>
            <label className="block text-sm text-neutral-300 md:col-span-2">
              Slate
              <select
                className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2"
                value={slate}
                onChange={(e) => setSlate(e.target.value)}
              >
                <option value="SUNDAY_EARLY">SUNDAY_EARLY</option>
                <option value="SUNDAY_LATE">SUNDAY_LATE</option>
                <option value="SUNDAY_AFTERNOON">SUNDAY_AFTERNOON</option>
                <option value="PRIME_TIME">PRIME_TIME</option>
                <option value="SINGLE_GAME">SINGLE_GAME</option>
                <option value="CUSTOM">CUSTOM</option>
              </select>
            </label>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void saveContestShell()}
            disabled={!contestId}
            className="rounded-full bg-ft-cta px-4 py-2 text-sm font-semibold text-neutral-950 disabled:opacity-40"
          >
            Save contest metadata
          </button>
          {shellSaved ? (
            <span className="text-sm text-emerald-300">Contest settings saved</span>
          ) : null}
        </div>
      </section>

      {/* B. AI Player Field */}
      <section className="rounded-xl border border-neutral-800 bg-neutral-900/80 p-5">
        <h2 className="text-lg font-semibold text-neutral-50">AI Player Field</h2>
        <p className="mt-1 text-sm text-neutral-400">
          Generate a reusable prompt for ChatGPT or another model. Copy, paste the returned block below.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="block text-sm text-neutral-300">
            Position
            <select
              className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2"
              value={position}
              onChange={(e) => {
                setPosition(e.target.value);
                const presets = getRolePresetsForPosition(e.target.value, contestType);
                if (presets[0]) setRolePreset(presets[0].value);
              }}
            >
              <option value="RB">RB</option>
              <option value="QB">QB</option>
              <option value="WR">WR</option>
              <option value="TE">TE</option>
            </select>
          </label>
          <label className="block text-sm text-neutral-300">
            Role preset
            <select
              className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2"
              value={rolePreset}
              onChange={(e) => setRolePreset(e.target.value)}
            >
              {rolePresets.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-3 flex flex-wrap gap-4 text-sm text-neutral-300">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={includeProjections}
              onChange={(e) => setIncludeProjections(e.target.checked)}
            />
            Include projections
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={includeStatus}
              onChange={(e) => setIncludeStatus(e.target.checked)}
            />
            Include injury status
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={includeNotes}
              onChange={(e) => setIncludeNotes(e.target.checked)}
            />
            Include notes
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void copyPrompt()}
            className="rounded-full bg-ft-cta px-4 py-2 text-sm font-semibold text-neutral-950"
          >
            Copy AI Roster Prompt
          </button>
          {promptCopied ? (
            <span className="text-sm font-medium text-emerald-300">Prompt copied</span>
          ) : null}
          <button
            type="button"
            className="text-sm text-neutral-400 underline hover:text-ft-gold"
            onClick={() => setRawText(WEEK1_RB_SAMPLE_IMPORT)}
          >
            Load sample Week 1 RB import
          </button>
        </div>
      </section>

      {/* C. Paste */}
      <section className="rounded-xl border border-neutral-800 bg-neutral-900/80 p-5">
        <h2 className="text-lg font-semibold text-neutral-50">Paste FantasyTrack Import</h2>
        <textarea
          className="mt-3 min-h-[220px] w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 font-mono text-xs text-neutral-100"
          placeholder="Paste a [FANTASYTRACK_IMPORT] block here…"
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
        />
        <div className="mt-3 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={parseImport}
            className="rounded-full bg-ft-cta px-4 py-2 text-sm font-semibold text-neutral-950"
          >
            Parse Import
          </button>
          <button
            type="button"
            onClick={clearPaste}
            className="rounded-full border border-neutral-600 px-4 py-2 text-sm text-neutral-200"
          >
            Clear
          </button>
        </div>
      </section>

      {/* D. Review */}
      {summary ? (
        <section className="rounded-xl border border-neutral-800 bg-neutral-900/80 p-5">
          <h2 className="text-lg font-semibold text-neutral-50">Review and import</h2>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              label="Players parsed"
              value={String(summary.parsedCount)}
            />
            <SummaryCard label="Teams" value={String(summary.teamCount)} />
            <SummaryCard
              label="Roles"
              value={Object.entries(summary.roleCounts)
                .map(([k, v]) => `${v} ${k}`)
                .join(" · ") || "—"}
            />
            <SummaryCard
              label="Statuses"
              value={Object.entries(summary.statusCounts)
                .map(([k, v]) => `${v} ${k.toLowerCase()}`)
                .join(" · ") || "—"}
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            <span className={`rounded-full border px-3 py-1 ${stateColor("ready")}`}>
              Ready {summary.readyCount}
            </span>
            <span className={`rounded-full border px-3 py-1 ${stateColor("warning")}`}>
              Warnings {summary.warningCount}
            </span>
            <span className={`rounded-full border px-3 py-1 ${stateColor("error")}`}>
              Errors {summary.errorCount}
            </span>
          </div>
          <p className="mt-2 text-sm text-neutral-300">{summary.message}</p>

          {Object.keys(metadata).length > 0 ? (
            <div className="mt-4 rounded-lg border border-neutral-800 bg-black/20 p-3 text-xs text-neutral-400">
              <p className="font-semibold text-neutral-200">Import metadata</p>
              <pre className="mt-1 whitespace-pre-wrap">
                {Object.entries(metadata)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join("\n")}
              </pre>
            </div>
          ) : null}

          {parseErrors.length > 0 ? (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-red-300">
              {parseErrors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={addPlayer}
              className="rounded-full border border-neutral-600 px-3 py-1.5 text-sm text-neutral-200"
            >
              Add Player
            </button>
            <button
              type="button"
              onClick={removeMarked}
              className="rounded-full border border-neutral-600 px-3 py-1.5 text-sm text-neutral-200"
            >
              Remove Selected
            </button>
            <button
              type="button"
              onClick={() => revalidateRows(editableRows)}
              className="rounded-full border border-neutral-600 px-3 py-1.5 text-sm text-neutral-200"
            >
              Revalidate
            </button>
            <button
              type="button"
              onClick={sortByRank}
              className="rounded-full border border-neutral-600 px-3 py-1.5 text-sm text-neutral-200"
            >
              Sort by Rank
            </button>
            <button
              type="button"
              onClick={sortByProjection}
              className="rounded-full border border-neutral-600 px-3 py-1.5 text-sm text-neutral-200"
            >
              Sort by Projection
            </button>
          </div>

          <div className="mt-4 overflow-x-auto rounded-lg border border-neutral-800">
            <table className="min-w-full text-left text-xs text-neutral-200">
              <thead className="bg-black/40 text-[11px] uppercase tracking-wide text-neutral-400">
                <tr>
                  <th className="px-2 py-2">Sel</th>
                  <th className="px-2 py-2">In</th>
                  <th className="px-2 py-2">Rank</th>
                  <th className="px-2 py-2">Player</th>
                  <th className="px-2 py-2">Team</th>
                  <th className="px-2 py-2">Opp</th>
                  <th className="px-2 py-2">Pos</th>
                  <th className="px-2 py-2">Role</th>
                  <th className="px-2 py-2">Proj</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Notes</th>
                  <th className="px-2 py-2">State</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {editableRows.map((row) => {
                  const v = validationByRow.get(row.sourceRowNumber);
                  const state = v?.state ?? "ready";
                  return (
                    <tr key={row.clientId} className="border-t border-neutral-800/80">
                      <td className="px-2 py-1">
                        <input
                          type="checkbox"
                          checked={!!marked[row.clientId]}
                          onChange={(e) =>
                            setMarked((m) => ({ ...m, [row.clientId]: e.target.checked }))
                          }
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="checkbox"
                          checked={row.included}
                          onChange={(e) =>
                            updateRow(row.clientId, { included: e.target.checked })
                          }
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          className="w-12 rounded border border-neutral-700 bg-neutral-950 px-1 py-0.5"
                          value={row.rank ?? ""}
                          onChange={(e) =>
                            updateRow(row.clientId, {
                              rank: e.target.value === "" ? null : Number(e.target.value),
                            })
                          }
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          className="min-w-[140px] rounded border border-neutral-700 bg-neutral-950 px-1 py-0.5"
                          value={row.playerName}
                          onChange={(e) =>
                            updateRow(row.clientId, { playerName: e.target.value })
                          }
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          className="w-14 rounded border border-neutral-700 bg-neutral-950 px-1 py-0.5"
                          value={row.team}
                          onChange={(e) => updateRow(row.clientId, { team: e.target.value })}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          className="w-14 rounded border border-neutral-700 bg-neutral-950 px-1 py-0.5"
                          value={row.opponent}
                          onChange={(e) =>
                            updateRow(row.clientId, { opponent: e.target.value })
                          }
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          className="w-12 rounded border border-neutral-700 bg-neutral-950 px-1 py-0.5"
                          value={row.position}
                          onChange={(e) =>
                            updateRow(row.clientId, { position: e.target.value })
                          }
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          className="w-14 rounded border border-neutral-700 bg-neutral-950 px-1 py-0.5"
                          value={row.depthRole ?? ""}
                          onChange={(e) =>
                            updateRow(row.clientId, {
                              depthRole: e.target.value || null,
                            })
                          }
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          className="w-14 rounded border border-neutral-700 bg-neutral-950 px-1 py-0.5"
                          value={row.projectedPoints ?? ""}
                          onChange={(e) =>
                            updateRow(row.clientId, {
                              projectedPoints:
                                e.target.value === "" ? null : Number(e.target.value),
                            })
                          }
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          className="w-24 rounded border border-neutral-700 bg-neutral-950 px-1 py-0.5"
                          value={row.status ?? ""}
                          onChange={(e) =>
                            updateRow(row.clientId, { status: e.target.value || null })
                          }
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          className="min-w-[120px] rounded border border-neutral-700 bg-neutral-950 px-1 py-0.5"
                          value={row.notes ?? ""}
                          onChange={(e) =>
                            updateRow(row.clientId, { notes: e.target.value || null })
                          }
                        />
                      </td>
                      <td className="px-2 py-1">
                        <span
                          className={`inline-block rounded border px-1.5 py-0.5 ${stateColor(state)}`}
                          title={v?.issues.map((i) => i.message).join("\n")}
                        >
                          {state}
                        </span>
                      </td>
                      <td className="px-2 py-1">
                        <button
                          type="button"
                          className="text-red-300 hover:underline"
                          onClick={() => {
                            setEditableRows((prev) => {
                              const next = prev.filter((r) => r.clientId !== row.clientId);
                              revalidateRows(next);
                              return next;
                            });
                          }}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="sticky bottom-4 mt-6 rounded-xl border border-ft-gold/30 bg-neutral-950/95 p-4 shadow-lg backdrop-blur">
            <p className="text-sm font-medium text-neutral-200">Duplicate handling</p>
            <div className="mt-2 flex flex-wrap gap-4 text-sm text-neutral-300">
              {(
                [
                  ["SKIP", "Skip existing players"],
                  ["UPDATE", "Update existing contest entrants"],
                  ["CANCEL", "Cancel import"],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="duplicateMode"
                    checked={duplicateMode === value}
                    onChange={() => setDuplicateMode(value)}
                  />
                  {label}
                </label>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={importing || !contestId || editableRows.length === 0}
                onClick={() => void runImport()}
                className="rounded-full bg-ft-cta px-5 py-2.5 text-sm font-bold text-neutral-950 disabled:opacity-40"
              >
                {importing ? "Importing…" : "Import Players"}
              </button>
              <button
                type="button"
                onClick={() => revalidateRows(editableRows)}
                className="rounded-full border border-neutral-600 px-4 py-2 text-sm text-neutral-200"
              >
                Validate Field
              </button>
            </div>

            {importResult ? (
              <div
                className={`mt-3 text-sm ${
                  importResult.success ? "text-emerald-300" : "text-red-300"
                }`}
              >
                {importResult.success ? (
                  <div className="space-y-2">
                    <p>
                      {importResult.importedCount} players imported successfully
                      {importResult.updatedCount
                        ? ` · ${importResult.updatedCount} updated`
                        : ""}
                      {importResult.skippedCount
                        ? ` · ${importResult.skippedCount} skipped`
                        : ""}
                      . The contest field is ready for review.
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <Link
                        href={`/admin/contest-field?contestId=${contestId}`}
                        className="rounded-full bg-ft-cta px-3 py-1.5 font-semibold text-neutral-950"
                      >
                        Review field
                      </Link>
                      <Link
                        href={`/contest/${contestId}`}
                        className="rounded-full border border-neutral-600 px-3 py-1.5 text-neutral-200"
                      >
                        Public preview
                      </Link>
                    </div>
                  </div>
                ) : (
                  <ul className="list-disc pl-5">
                    {importResult.errors.map((e) => (
                      <li key={`${e.row}-${e.message}`}>
                        {e.row ? `Row ${e.row}: ` : ""}
                        {e.message}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {batches.length > 0 ? (
        <section className="rounded-xl border border-neutral-800 bg-neutral-900/80 p-5">
          <h2 className="text-lg font-semibold text-neutral-50">Import history</h2>
          <ul className="mt-3 space-y-2 text-sm text-neutral-300">
            {batches.map((b) => (
              <li
                key={b.id}
                className="rounded-lg border border-neutral-800 bg-black/20 px-3 py-2"
              >
                <span className="text-neutral-100">
                  {new Date(b.createdAt).toLocaleString()}
                </span>
                {" · "}
                {b.importedCount} imported · {b.skippedCount} skipped · {b.updatedCount}{" "}
                updated · {b.warningCount} warnings
                <span className="ml-2 text-xs text-neutral-500">{b.sourceLabel}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-black/30 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-neutral-100">{value}</p>
    </div>
  );
}
