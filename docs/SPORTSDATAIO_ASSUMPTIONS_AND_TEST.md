# SportsDataIO Phase 1 – Assumptions and Test Steps

## Assumptions (confirm as needed)

1. **`contest.externalId` is the provider game ID**  
   When a contest is created from a game (admin “Create contest from game”), the contest stores `externalId` = the provider’s game id (e.g. SportsDataIO CBB `GameID`). The live-stats ingestion uses this to call `GET BoxScore/{gameid}`. If your contest was created another way, set `externalProvider = "sportsdataio"` and `externalId = <SportsDataIO GameID>` for the pull to work.

2. **`player.externalId` matches provider player IDs**  
   Lanes are linked to `Player` via `Lane.playerId`. Each `Player` has `externalProvider` and `externalId`. The ingestion matches incoming stat rows by `player.externalId === stat.playerId` (and same provider). So players must have been imported from the same provider with the same ids. The CBB import uses SportsDataIO’s `PlayerID` (as string) for `Player.externalId`. Lanes must be built from those imported players (lane builder “Build lanes” from players) so `Lane.playerId` is set.

3. **BoxScore live update behavior**  
   SportsDataIO’s `GET /v3/cbb/stats/JSON/BoxScore/{gameid}` returns live stats while the game is in progress and final stats after the game. One manual “Pull live stats” updates all lanes for that contest from the current Box Score response. There is no polling or automation in Phase 1.

4. **League for schedule**  
   The CBB import creates one League with `externalProvider = "sportsdataio"` and `externalId = "cbb"`. The schedule API uses `league.externalId` to call the provider’s `getSchedule("cbb", range)`. So “Create contest from game” only shows CBB games if that league exists (created by the import).

---

## Commands to run

```bash
# 1. Env: set API key (required for import and live pull)
# In .env.local:
SPORTSDATAIO_API_KEY=your_key_here

# 2. Dev server
npm run dev

# 3. (Optional) If you need a fresh DB or migrations
npx prisma migrate dev
```

No extra build or seed commands are required for Phase 1. The CBB import and live-stats pull are triggered from the UI or via HTTP.

---

## Seed / import steps

1. **Import CBB rosters (once per environment)**  
   - Go to **Admin** (`/admin`).  
   - In **Data providers (NCAA basketball)**, click **Import CBB (SportsDataIO)**.  
   - Or: `curl -X POST http://localhost:3000/api/internal/import-cbb` (with a logged-in admin session cookie, or run from browser devtools while logged in as admin).  
   - This creates/updates: one League (sportsdataio, cbb), all CBB teams, and all players per team.  
   - You only need to run this once (or again to refresh rosters).

2. **No seed script change**  
   Phase 1 does not add or change Prisma seed scripts. Optional: create a Series manually in admin if you don’t have one for “Create contest from game”.

---

## Manual admin steps to test one live March Madness–style race

1. **Env**  
   Set `SPORTSDATAIO_API_KEY` in `.env.local` and restart the dev server.

2. **Import CBB**  
   Admin → **Import CBB (SportsDataIO)**. Wait for success (e.g. “Imported CBB: NCAA Basketball. N teams, M players.”).

3. **Create a series**  
   If you don’t have one: Admin → create a new series (name, dates, etc.).

4. **Create contest from game**  
   - Go to **Create contest from game** (`/admin/contest-from-game`).  
   - Choose **sport**: Basketball.  
   - Choose **league**: the one named like “NCAA Basketball” (externalId = cbb).  
   - Choose **series**.  
   - Click **Load games** (or equivalent).  
   - Pick a real CBB game (e.g. March Madness) and create the contest.

5. **Build lanes**  
   - Go to **Contest lane builder** (`/admin/contest-lanes`).  
   - Select the contest you just created.  
   - Select the two teams (home/away) so players load.  
   - Select the players you want in the “race” (e.g. key players from both teams).  
   - Submit to create lanes. This sets `Lane.playerId` from the imported `Player` records (so `player.externalId` matches the provider).

6. **Publish and lock (optional)**  
   Publish the contest so it appears on the dashboard; lock when the game starts so betting closes and the contest is “live”.

7. **Pull live stats**  
   - In Admin, expand the contest card.  
   - Click **Pull live stats** (shown only for basketball + sportsdataio + contest with `externalId`).  
   - The app calls SportsDataIO Box Score for that game and updates each lane’s basketball stats and `liveFantasyPoints`.  
   - You should see “Updated N lane(s).”

8. **Confirm board update**  
   Open the contest page (`/contest/[id]`). The Live race board should show the same lanes ordered by `liveFantasyPoints`. Refresh after each “Pull live stats” to see updated numbers.

---

## Files changed (Phase 1 implementation)

| File | Change |
|------|--------|
| `docs/SPORTSDATAIO_PHASE1_PLAN.md` | Already present (plan). |
| `docs/SPORTSDATAIO_ASSUMPTIONS_AND_TEST.md` | **New** – assumptions and test steps. |
| `lib/sports/types.ts` | ProviderName `sportsdataio`, NormalizedPlayerGameStat. |
| `lib/sports/provider.ts` | getLivePlayerStatsForGame, sportsdataio branch. |
| `lib/sports/sportsdataio/config.ts` | **New** – API key and base URL. |
| `lib/sports/sportsdataio/client.ts` | **New** – GET with key. |
| `lib/sports/sportsdataio/mappers.ts` | **New** – CBB → normalized types. |
| `lib/sports/sportsdataio/cbb-provider.ts` | **New** – CBB SportsProvider. |
| `app/api/internal/import-cbb/route.ts` | **New** – POST import CBB. |
| `app/api/internal/basketball-live-stats/route.ts` | Already present – POST pull stats. |
| `components/admin/import-cbb-button.tsx` | **New** – Import CBB button. |
| `components/admin/pull-live-stats-button.tsx` | **New** – Pull live stats button. |
| `app/admin/page.tsx` | Data providers section + Pull live stats on contest card. |
| `.env.example` | SPORTSDATAIO_API_KEY. |

---

## Optional: trigger live pull via curl

Replace `COOKIE` with your admin session cookie (e.g. from browser devtools → Application → Cookies → copy `next-auth.session-token` or equivalent).

```bash
curl -X POST http://localhost:3000/api/internal/basketball-live-stats \
  -H "Content-Type: application/json" \
  -d '{"contestId":"YOUR_CONTEST_ID"}' \
  -H "Cookie: next-auth.session-token=COOKIE"
```

Response: `{"ok":true,"updated":10,"skipped":0,"updatedLaneIds":["...",...]}`.

---

## Troubleshooting

**Import fails**

- Check `SPORTSDATAIO_API_KEY` is set in `.env.local` and the dev server was restarted.
- Check the browser/network tab or server logs for the real error (e.g. 401 Unauthorized, 502 from provider).
- Ensure the API key is valid and has CBB access in your SportsDataIO account.

**No games load**

- Run **Import CBB** first so the League (sportsdataio / cbb) exists.
- On “Create contest from game”, pick **Basketball** and the **NCAA Basketball** league, then load games. If the list is empty, the date range may have no games, or the provider may be returning none; try a different date or check the schedule API response in the network tab.

**Contest missing externalId**

- Contests created manually (not via “Create contest from game”) do not get `externalId` or `externalProvider`. Use “Create contest from game” and pick a game from the loaded schedule so the contest is created with `externalProvider` and `externalId` set. In Admin, basketball contests show “External game: —” when missing.

**Pull live stats returns 0 updated**

- Confirm the contest has **External game** set (Admin shows “External game: sportsdataio / &lt;id&gt;”).
- Confirm **Lanes** are “N of N linked” (all lanes have a player with `externalId`). If “0 of N linked”, build lanes from the lane builder using the **imported** players (same contest’s teams) so each lane gets `playerId` and that player has `externalProvider`/`externalId`.
- The Box Score may have no player stats yet (game not started or not updated). Try again during or after the game.

**Players / lane mapping mismatch**

- Lanes must be created from players that were **imported** via Import CBB (so `Player.externalId` = SportsDataIO PlayerID). If lanes were added by hand with “Add lane” and a typed name, they have no `playerId` and will never receive live stats. Rebuild lanes via **Contest lane builder** and select the imported players for the two teams.

**Board does not visibly change after a pull**

- Refresh the contest page; the Live race board reads from server data.
- Confirm the pull returned “Updated N lane(s)” with N &gt; 0. If N was 0, fix mapping (see above) and pull again.
- Check that the contest page is showing the **live** view (contest locked or in progress), not only the pre-race view.
