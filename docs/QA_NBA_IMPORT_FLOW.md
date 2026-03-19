# QA Checklist: Full Local NBA Import & Contest Flow

Focused verification steps for the NBA pipeline from import through live stats. Use this on **localhost** (e.g. `npm run dev` → http://localhost:3000 or your port).

---

## Prerequisites

- [ ] **Env:** `SPORTSDATAIO_API_KEY` set in `.env.local` (same key used for CBB; plan must include NBA).
- [ ] **Admin user:** You have an account with `isAdmin: true`.
- [ ] **Optional:** A second test user (non-admin) for placing bets.
- [ ] **App running:** e.g. `npm run dev` and DB migrated.

---

## 1. Import NBA league, teams, and players

**Goal:** NBA league exists in DB; teams and players are upserted with `externalProvider = "sportsdataio"`, `externalId` matching SportsDataIO.

### Steps

1. Log in as admin → go to **Admin** (`/admin`).
2. Find the **"Data providers (Basketball)"** section.
3. Click **"Import NBA (SportsDataIO)"**.
4. Wait for the request to finish (no spinner forever).

### Verification

- [ ] **Success message** appears, e.g. `Imported NBA: NBA. 30 teams, NNN players.` (player count may vary).
- [ ] **No 502 / "Failed to fetch leagues" or "Failed to fetch teams"** (indicates API key or network).
- [ ] **No "NBA league not found from provider"** (indicates unified provider not returning NBA).

### Optional DB spot-check

- [ ] In DB: `League` has one row with `externalProvider = 'sportsdataio'`, `externalId = 'nba'`, `sport = 'BASKETBALL'`, `code = 'NBA'`.
- [ ] `Team` rows exist with same `externalProvider`, `externalId` like `BOS`, `LAL`, etc., and `leagueId` = that league’s id.
- [ ] `Player` rows exist with same `externalProvider`, `externalId` (numeric string), `teamId` = one of those teams.

---

## 2. Load NBA games in admin/contest-from-game

**Goal:** Schedule API returns NBA games; list shows home/away labels and start times.

### Steps

1. Go to **Create contest from game** (`/admin/contest-from-game`).
2. **Sport:** select **Basketball**.
3. **League:** select **NBA — NBA** (no “(no schedule)”).
4. **Series:** select any series.
5. Click **"Load games"**.

### Verification

- [ ] **No error** in red (e.g. "League not found", "Failed to load schedule").
- [ ] **Game list appears** with rows like `Away Team @ Home Team` and a date/time.
- [ ] **Times look correct** for US Eastern tip-off (e.g. 7:00 PM ET shows as a sensible UTC-based time in your locale).
- [ ] **Team names** match known NBA teams (e.g. "Boston Celtics", "Los Angeles Lakers" or market/name combo).

### If the list is empty

- [ ] Date range is **today − 7 days** to **today + 60 days**; ensure there are NBA games in that window.
- [ ] Check browser Network tab: `/api/admin/schedule?leagueId=<league-id>` returns 200 and `games` array (can be empty if no games).
- [ ] **Critical:** Schedule API only includes games where **both home and away teams exist in DB** (matched by `externalId` + `externalProvider`). If Import NBA failed or used different team keys, games will be dropped. Re-run Import NBA and try again.

---

## 3. Create an NBA contest from an imported game

**Goal:** One contest is created, linked to the selected game and teams; no duplicate contest for same game.

### Steps

1. With the NBA game list visible, pick a game (ideally one in the future so it stays open for betting).
2. Click **"Create contest"** for that game.
3. Wait for success.

### Verification

- [ ] **Success message** e.g. `Contest created: Away @ Home`.
- [ ] **Links appear:** "Build lanes for this contest" and "View contest".
- [ ] **No 409** "A contest already exists for this external game" (unless you intentionally created it twice).
- [ ] **No 400** "Missing required fields" or "Invalid startTime".

### Spot-check contest record

- [ ] **View contest** → contest page shows correct title, sport Basketball, and **start time** consistent with the game time you saw in the list (same Eastern tip-off).
- [ ] In DB (optional): `Contest` row has `externalProvider = 'sportsdataio'`, `externalId` = game id (numeric string), `homeTeamId` / `awayTeamId` = DB team UUIDs, `startTime` = UTC equivalent of Eastern tip-off.

---

## 4. Build lanes for that contest

**Goal:** Lanes are created from NBA players; contest shows multiple lanes (e.g. one per player or per selected player).

### Steps

1. From contest-from-game success message, click **"Build lanes for this contest"** (or go to **Contest lane builder** and select the contest).
2. Confirm **Contest** dropdown shows the new NBA contest and it’s selected.
3. **League** should auto-select to the league that contains the contest’s home/away teams (NBA).
4. **Teams** should show the two teams for that game (home + away) and be pre-selected.
5. **Players** list should show players from those two teams.
6. Select the players you want as lanes (or use "Select all" if available).
7. Submit to create lanes.

### Verification

- [ ] **League** is NBA (not CBB or empty).
- [ ] **Teams** are the two teams from the contest (names/abbrevs match).
- [ ] **Players** list is populated with real NBA names and positions.
- [ ] After submit: **Success** and no 500; contest page shows **lanes** with correct player names and teams.
- [ ] Each lane has a **Player** linked; player has `externalProvider = 'sportsdataio'`, `externalId` so live stats can match later.

### If league or teams don’t show

- [ ] Contest has `homeTeamId` and `awayTeamId` set (from contest-from-game). If either is null, lane builder can’t infer league/teams.
- [ ] Those team IDs exist in `Team` and belong to a `League` that is in the **leagues** payload (contest-lanes page loads leagues with teams and players). For NBA, that league must be the one created by Import NBA.

---

## 5. Place bets as test users

**Goal:** Contest is open for betting; test users can place WIN/PLACE/SHOW bets; amounts respect allocation and validation.

### Steps

1. Ensure contest is **Published** (Admin: contest status = PUBLISHED).
2. Ensure contest **start time is in the future** (so it’s still open: `new Date() < contest.startTime`).
3. As **test user 1:** open the contest page, select a lane, place a WIN (and optionally PLACE/SHOW) bet within allocation (e.g. required $100 total, min/max bet enforced).
4. As **test user 2** (if available): place different bets on same or other lanes.
5. Check allocation summary at top of board and in bet slip.

### Verification

- [ ] **No "Contest is locked"** or "Betting is closed" when start time is still in the future.
- [ ] **Bets submit** and appear in "My bets" / tape; allocation (wagered / required / left) updates.
- [ ] **Validation:** Cannot exceed remaining allocation; min/max bet enforced; no submission when contest is locked.
- [ ] **Odds/pools** update as expected when multiple users bet (no need to validate exact math; just that the board doesn’t error).

### Likely failure points

- Contest **status** not PUBLISHED (still DRAFT) → no betting.
- **startTime** in the past or wrong timezone → contest may already be auto-locked (see section 6).

---

## 6. Confirm start time is correct and contest does not auto-lock early

**Goal:** Contest `startTime` is the correct UTC instant for the NBA game tip-off (Eastern); locking happens at or after that time, not hours early.

### Steps

1. Pick a contest you created from an NBA game (or create one with a game that starts in 1–2 hours).
2. Note the **game time** shown when you loaded the schedule (e.g. "Mar 10, 2025, 7:00 PM" in your locale).
3. On the **contest page** (or Admin), note the **contest start time** displayed.
4. Compare to a known source (e.g. NBA.com) for that game’s Eastern tip-off.
5. (Optional) Wait until after that tip-off time and confirm the contest **locks** (or run cron/job that calls `autoLockContests` and confirm it locks then).

### Verification

- [ ] **Displayed start time** matches the game’s Eastern tip-off (converted to your local time or UTC) — e.g. 7:00 PM ET = 00:00 next day UTC (or 19:00 ET same day).
- [ ] **Contest remains open** until that time (you can place bets until then).
- [ ] **Contest does not lock early** (e.g. if tip is 7 PM ET, it should not lock at noon ET). If it locks early, the stored `startTime` was likely wrong (e.g. parsed as local server time instead of Eastern).

### Implementation note

- NBA (and CBB) use `parseSportsDataIODateTimeEastern`: SportsDataIO `DateTime` is interpreted as **America/New_York**, then converted to UTC for storage. Auto-lock uses `contest.startTime <= now` in UTC. So correct Eastern parsing is critical.

### If lock happens early

- [ ] Check server timezone (should not affect stored UTC).
- [ ] In DB, inspect `Contest.startTime` for that contest: it should be the UTC instant of tip-off. If it’s hours off, the mapper or API date format may be wrong.
- [ ] Check SportsDataIO response for that game’s `DateTime` format; ensure it’s parsed with `America/New_York` in the NBA mapper.

---

## 7. Confirm live stats pull and update points correctly

**Goal:** For an NBA contest with lanes, pulling live stats calls the NBA BoxScore endpoint and updates lane stats and live fantasy points.

### Steps

1. Use a contest that:
   - Has **lanes** with **players** that have `externalProvider = 'sportsdataio'` and `externalId` matching SportsDataIO player ids.
   - Has **externalProvider = 'sportsdataio'** and **externalId** = game id.
   - Ideally the game is **InProgress** or **Final** so the BoxScore returns data.
2. As admin, trigger **Pull live stats** (or POST `/api/internal/basketball-live-stats` with `{ "contestId": "<id>" }`).
3. Check contest page and/or Admin lane editor for updated stats and **live fantasy points**.

### Verification

- [ ] **200 OK** from the live-stats request (no 501 "Provider does not support live player stats", no 502 "Failed to fetch live stats").
- [ ] **Lane stats** (points, rebounds, assists, steals, blocks, turnovers, threes) update for players that appear in the BoxScore.
- [ ] **liveFantasyPoints** on lanes recalculates using basketball scoring (e.g. `computeBasketballFantasyPointsFromRaw`).
- [ ] **Live race board** (if shown) reflects updated ordering/points.
- [ ] **Game progress** (if implemented) updates from BoxScore status/period (e.g. "InProgress", "3", progress %).

### If live stats don’t update

- [ ] **Contest** has `externalProvider` and `externalId` set (from contest-from-game).
- [ ] **League:** Live-stats route now passes `leagueId` (from contest’s home team’s league) so the unified provider calls the **NBA** BoxScore endpoint, not CBB. If the contest’s home team has no league or wrong league, it might hit CBB and get no match.
- [ ] **Player matching:** Lanes’ players must have `externalId` matching the BoxScore’s `PlayerID` (string). If Import NBA used different ids or lane builder attached wrong players, stats won’t match.
- [ ] **Game state:** For "Scheduled" games, BoxScore may return empty or no PlayerGames; use an InProgress/Final game to test.

---

## Most likely failure points (summary)

Based on the current implementation, watch for these first when something breaks:

| Area | Risk | What to check |
|------|------|----------------|
| **Import NBA** | API key missing or no NBA access | 502 / "Failed to fetch leagues or teams". Verify `SPORTSDATAIO_API_KEY` and plan includes NBA. |
| **Import NBA** | Wrong API path or response shape | Empty teams or 0 players. Compare SportsDataIO NBA docs (e.g. `v3/nba/scores/JSON/teams`, `Players/{team}`, date format). |
| **Load games** | No games in list | Schedule API **filters out** games whose home/away team are not in DB. Run Import NBA first; ensure team keys from API match `Team.externalId` (e.g. `BOS`, `LAL`). |
| **Load games** | Wrong league in dropdown | Leagues come from DB. If Import NBA didn’t run or failed, NBA league won’t appear. |
| **Create contest** | 409 duplicate | Same `externalProvider` + `externalId` already used. Pick another game or delete the existing contest. |
| **Build lanes** | League/teams empty | Contest’s `homeTeamId`/`awayTeamId` must be set and those teams must belong to a league loaded on contest-lanes page (with teams + players). |
| **Build lanes** | Wrong sport/league | Lane builder filters leagues by contest sport; NBA contest → Basketball leagues only. Select the NBA league that has the two teams. |
| **Betting** | Contest locked or not open | Contest must be PUBLISHED and `startTime > now`. If startTime was parsed wrong (e.g. local time), it may lock early. |
| **Start time / lock** | Lock too early | `startTime` must be Eastern → UTC. Only place that’s set is in mappers (`parseSportsDataIODateTimeEastern`). If SportsDataIO sends a different format or timezone, parsing may be wrong. |
| **Live stats** | 502 or no updates | (1) Contest has `externalProvider` + `externalId`. (2) Home team’s league has `externalId = 'nba'` so provider uses NBA BoxScore. (3) Lane players have `externalId` matching BoxScore `PlayerID`. (4) Game is InProgress/Final so BoxScore has data. |

---

## Quick reference: key URLs and env

- **Admin:** `/admin`
- **Create contest from game:** `/admin/contest-from-game`
- **Contest lane builder:** `/admin/contest-lanes` (optional `?contestId=...`)
- **Contest page:** `/contest/[id]`
- **Env:** `SPORTSDATAIO_API_KEY` in `.env.local`
- **Schedule window:** past 7 days, next 60 days (see `SCHEDULE_DAYS_PAST` / `SCHEDULE_DAYS_AHEAD` in `app/api/admin/schedule/route.ts`)
