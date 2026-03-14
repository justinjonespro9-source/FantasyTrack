# SportsDataIO Phase 1 – Implementation Plan

## 1. Codebase audit summary

### Where contests are defined
- **Prisma:** `Contest` model in `prisma/schema.prisma` (seriesId, title, sport, startTime, status, homeTeamId, awayTeamId, externalProvider, externalId).
- **Admin:** Create from game: `app/admin/contest-from-game/page.tsx`, `app/api/admin/contest-from-game/route.ts`. Schedule from provider: `app/api/admin/schedule/route.ts` (GET, uses `getSportsProvider(league.externalProvider).getSchedule()`).
- **Seed:** `prisma/seed.ts`, `prisma/seed-demo-series.ts`.

### Where lanes/players are defined
- **Prisma:** `Lane` (contestId, name, team, position, playerId → Player), `Player` (teamId, fullName, position, jerseyNumber, externalProvider, externalId).
- **Admin:** Lane builder: `app/admin/contest-lanes/page.tsx`, `components/admin/contest-lane-builder.tsx`, `app/api/admin/contest-lanes/route.ts`. Bridge: `lib/sports/contest-lane-bridge.ts`.
- **Import:** `lib/sports/import-mock.ts` upserts League/Team/Player from provider (getLeagues, getTeams, getPlayers).

### Where fantasy points are calculated
- **Config:** `lib/scoring-config.ts` – `BasketballRawStats`, `computeBasketballFantasyPointsFromRaw()`, and equivalent for other sports.
- **Admin live scoring:** `app/admin/page.tsx` – server actions update lane basketball* fields and call scoring helper to set `liveFantasyPoints`.
- **Settlement:** Final `fantasyPoints` / `finalRank` set at settlement (unchanged by this integration).

### Where live standings/leaderboards are calculated
- **Live race board:** `components/live-race-board.tsx` – receives `lanes` with `fantasyPoints` (used as live when present; see contest page).
- **Contest page:** `app/contest/[id]/page.tsx` – loads contest with lanes; live view uses `liveFantasyPoints` (fallback to `fantasyPoints`) for ordering; `lib/contest-board.ts` and `getContestOddsData` in `lib/market.ts` for odds/bets.
- **Ordering:** Lanes sorted by live points (and status) in the UI; no separate “standings” table – it’s derived from Lane rows.

### Where live data ingestion should plug in
- **Existing pattern:** Hockey uses admin-only manual entry and server actions that write to Lane basketball*/hockey* and `liveFantasyPoints`. No existing external feed in repo for basketball.
- **Insertion point:** Internal API route (e.g. `POST /api/internal/basketball-live-stats`) that:
  1. Accepts contestId (and optionally external gameId).
  2. Loads contest by id; reads `contest.externalProvider`, `contest.externalId` (game).
  3. Calls provider’s live-stats method (e.g. `getLivePlayerStatsForGame(externalGameId)`).
  4. For each normalized player stat, finds Player by externalId (and provider), then Lane by contestId + playerId; updates lane’s basketball* fields and recomputes `liveFantasyPoints` via `computeBasketballFantasyPointsFromRaw`.
  5. Revalidates contest/admin routes.
- **Provider layer:** New optional method on `SportsProvider`: `getLivePlayerStatsForGame?(gameId): Promise<NormalizedPlayerGameStat[]>`; mock returns `[]`; SportsDataIO CBB adapter implements it using Box Score endpoint.

---

## 2. Provider-agnostic structure

### Normalized player model (already exist)
- **ExternalPlayer** in `lib/sports/types.ts`: id, provider, teamId, fullName, position, jerseyNumber, active. No SportsDataIO-specific fields.

### Normalized game model (already exist)
- **ExternalGame**: id, provider, leagueId, homeTeamId, awayTeamId, startTime.

### Normalized live player stat update (new)
- **NormalizedPlayerGameStat**: provider-agnostic per-game stat row used to update a lane.
  - `playerId: ExternalId` (provider’s player id)
  - `gameId: ExternalId`
  - `teamId: ExternalId`
  - `rawStats: BasketballRawStats` (points, rebounds, assists, steals, blocks, turnovers, threePointersMade) so the app and scoring config never see provider-specific names.

All provider-specific mapping (e.g. SportsDataIO `Points` → `rawStats.points`, `BlockedShots` → `rawStats.blocks`) lives in the SportsDataIO adapter only.

---

## 3. SportsDataIO adapter (thin layer)

- **Config:** API key from `process.env.SPORTSDATAIO_API_KEY` only; no other env for Phase 1.
- **Client:** Single module that builds request URL with base `https://api.sportsdata.io`, path (e.g. `/v3/cbb/scores/JSON/teams`), and query `key=API_KEY`. Uses `key` query param per SportsDataIO OpenAPI.
- **Mappers:** CBB-specific functions that map API response shapes to `ExternalLeague`, `ExternalTeam`, `ExternalPlayer`, `ExternalGame`, and `NormalizedPlayerGameStat` (from Box Score `PlayerGame` array). All SportsDataIO field names (Points, Rebounds, BlockedShots, etc.) are confined to the adapter.
- **CBB provider:** Implements `SportsProvider` (+ optional `getLivePlayerStatsForGame`) for NCAA basketball; uses `lib/sports/sportsdataio/client` and mappers. League id/code/name can be a single “CBB” league for Phase 1; teams/players/schedule from CBB endpoints.

---

## 4. SportsDataIO endpoints to use first

| Purpose | Endpoint | Notes |
|--------|----------|--------|
| Teams | `GET /v3/cbb/scores/{format}/teams` | All teams; map to ExternalTeam (id = TeamID or Key/abbreviation per docs). |
| Players by team | `GET /v3/cbb/scores/{format}/Players/{team}` or `PlayersBasic/{team}` | Team = abbreviation. Map to ExternalPlayer. |
| Schedule / games | `GET /v3/cbb/scores/{format}/GamesByDate/{date}` | For date range, call per day. Map to ExternalGame (id = GameID, home/away = HomeTeamID/AwayTeamID or keys). |
| Live (and final) player stats for a game | `GET /v3/cbb/stats/{format}/BoxScore/{gameid}` | Returns BoxScore with PlayerGames array. Map each PlayerGame to NormalizedPlayerGameStat (Points→points, Rebounds→rebounds, Assists→assists, Steals→steals, BlockedShots→blocks, Turnovers→turnovers, ThreePointersMade→threePointersMade). |
| Alternative: all games on a date | `GET /v3/cbb/stats/{format}/PlayerGameStatsByDate/{date}` | If we prefer one call per date instead of per game; then filter by gameId. |

**Recommendation:** Use **BoxScore/{gameid}** for live ingestion so we can poll per contest/game; use **GamesByDate** for schedule; use **teams** and **Players/{team}** (or PlayersBasic) for rosters.

---

## 5. First-pass college basketball scoring (configurable in code)

- **Current:** `lib/scoring-config.ts` already defines `BasketballRawStats` and `computeBasketballFantasyPointsFromRaw()` (points, 3PM, rebounds, assists, steals, blocks, turnovers, double-double, triple-double). Used by admin and can be used by ingestion.
- **Phase 1:** Use this same function for college basketball; no separate “college” formula yet. Configurable in code = we can later add e.g. `COLLEGE_BASKETBALL_WEIGHTS` or a small config object in `scoring-config.ts` and branch in the calculator if we want NCAA vs NBA differences.

---

## 6. Files to create or change

| Action | File |
|--------|------|
| Create | `docs/SPORTSDATAIO_PHASE1_PLAN.md` (this file) |
| Extend | `lib/sports/types.ts` – add `ProviderName "sportsdataio"`, add `NormalizedPlayerGameStat` (playerId, gameId, teamId, rawStats: BasketballRawStats). |
| Create | `lib/sports/sportsdataio/config.ts` – read `SPORTSDATAIO_API_KEY` from env. |
| Create | `lib/sports/sportsdataio/client.ts` – GET helper with base URL + key. |
| Create | `lib/sports/sportsdataio/mappers.ts` – CBB API → External* and NormalizedPlayerGameStat. |
| Create | `lib/sports/sportsdataio/cbb-provider.ts` – implement SportsProvider + getLivePlayerStatsForGame for CBB. |
| Extend | `lib/sports/provider.ts` – register `sportsdataio`, return CBB provider when selected. |
| Extend | `.env.example` – add `SPORTSDATAIO_API_KEY=`. |
| Create | `app/api/internal/basketball-live-stats/route.ts` – POST; validate internal/admin; fetch normalized stats for contest’s game; update lanes by player externalId; recalc liveFantasyPoints; revalidate. |
| No change | Wallet, payout, auth, settlement, contest creation flow (only additive live-stats ingestion). |

---

## 7. Assumptions and risks

- **Assumptions**
  - Contest has `externalProvider` and `externalId` set to the same game id the provider uses (e.g. SportsDataIO GameID). Lanes are linked to players via `Lane.playerId` and `Player.externalId` / `Player.externalProvider` so we can match incoming stats to lanes.
  - League/team/player data has been imported (e.g. from SportsDataIO) so that `externalId`/`externalProvider` align; otherwise live-stats ingestion will not find players/lanes.
  - API key is only in env; no hardcoding.
- **Risks**
  - CBB team id in API might be integer (TeamID) vs string (Key); mappers must use a consistent external id (e.g. Key) for teams and games so schedule and roster imports match.
  - Rate limits and polling frequency for Box Score not yet defined; Phase 1 is “get one game working”; we can add backoff/caching later.
  - If a contest has no `externalId` or wrong provider, internal route should no-op or return clear error.

---

## 8. Phase 1 implementation checklist

- [x] Plan and types (ProviderName, NormalizedPlayerGameStat).
- [ ] SportsDataIO config + client + mappers + CBB provider.
- [ ] Wire provider in getSportsProvider; .env.example.
- [ ] Internal basketball live-stats route.
- [ ] Manual test: create league/team/players from CBB, create contest from game, build lanes, call internal API with game id, confirm lanes update and live board reflects it.

**Note (league setup):** For schedule/roster import to work with SportsDataIO CBB, create a League in the DB with `externalProvider = "sportsdataio"` and `externalId = "cbb"`. Then the schedule route will call `getSportsProvider("sportsdataio").getSchedule("cbb", range)` and the CBB provider will return games. Teams/players can be imported by iterating getLeagues() → getTeams("cbb") → getPlayers(teamKey) and upserting with provider "sportsdataio" (same pattern as mock import).
