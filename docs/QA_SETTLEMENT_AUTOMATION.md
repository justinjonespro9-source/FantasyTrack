# QA Checklist: Settlement Automation (Auto-fill & One-Click Settle)

Focused verification for the settlement automation added to the Admin page: **Auto-fill from live results** and **Settle from live results (no review)**.

---

## Prerequisites

- [ ] Admin user logged in.
- [ ] At least one contest in **LOCKED** status with lanes and (ideally) live stats pulled so lanes have `liveFantasyPoints` and/or `fantasyPoints` set.
- [ ] Contest **not** already settled (no `SettlementSummary`, no PAYOUT transactions).

---

## 1. Normal no-tie contest

**Goal:** All lanes have distinct point values; auto-fill assigns ranks 1, 2, 3, … and one-click settle completes without error.

### Setup

- One LOCKED contest; each lane has different `liveFantasyPoints` (e.g. 24.5, 22.1, 19.0, 17.2, …).

### Steps

1. Go to **Admin** → **Settlement**.
2. Find the contest; click **"Auto-fill from live results"**.
3. Confirm the page reloads with rank and points inputs **pre-filled**: rank 1 = highest points, rank N = lowest, no duplicate ranks.
4. Optionally change nothing and click **"Settle Contest"** (manual submit with auto-filled values).
5. Confirm contest moves to Settled; contest page shows correct final standings and payouts.

### One-click path

6. For another LOCKED contest (or reopen the one you just settled and lock again), click **"Settle from live results (no review)"**.
7. Confirm one request settles the contest; no form fields needed.
8. Confirm contest is SETTLED and payouts/rankings match the previous live order.

### Verification

- [ ] Ranks are 1..N with no gaps and no duplicates.
- [ ] Fantasy points in the form match lane `liveFantasyPoints` (or `fantasyPoints` if present).
- [ ] After settlement, `Lane.finalRank` and `Lane.fantasyPoints` match what was submitted.
- [ ] WIN/PLACE/SHOW payouts and rake are correct for that ordering (no change from manual settlement behavior).

---

## 2. Tie contest

**Goal:** Lanes with the same points get the **same** rank; next rank skips (e.g. 1, 1, 3, 4). Payout logic uses dead-heat rules.

### Setup

- LOCKED contest where at least two lanes have the **same** `liveFantasyPoints` (e.g. two at 20.0, rest lower).

### Steps

1. Go to **Admin** → **Settlement** → **"Auto-fill from live results"** for that contest.
2. Check **rank** inputs: the two tied lanes should both have rank **1** (or same rank in their tier); the next lane should have rank **3** (not 2).
3. Check that **fantasy points** are identical for the tied lanes.
4. Click **"Settle Contest"** (or **"Settle from live results (no review)"**).
5. Open the contest page; confirm standings show the tie (e.g. two lanes shown as 1st).
6. Confirm **payouts**: WIN pool should be split between the two rank-1 lanes (dead heat); PLACE/SHOW should follow existing dead-heat logic in `lib/market.ts` (`buildRankGroups` / `computeLaneSharesByMarket`).

### Verification

- [ ] Same points → same `finalRank` in DB and on UI.
- [ ] Ordinal ranks skip after a tie (1, 1, 3, 4, …).
- [ ] No duplicate rank values except intentional ties.
- [ ] Payout amounts reflect shared slots (e.g. two-way tie for WIN = half WIN pool each).

---

## 3. Contest with zero / null-point lanes

**Goal:** Lanes with `liveFantasyPoints` and `fantasyPoints` both null (or 0) are still ranked and included; they tie at the bottom.

### Setup

- LOCKED contest; at least one lane has **no** live stats (both `liveFantasyPoints` and `fantasyPoints` are null), or explicitly 0.

### Steps

1. **Auto-fill from live results** for that contest.
2. Confirm **every** lane has a rank (no empty rank field).
3. Confirm null/zero lanes get the **lowest** ranks (e.g. if 6 lanes and 2 have 0 points, those two get rank 5 and 6, or both 5 if tied).
4. Confirm **points** input for those lanes: either empty (treated as null) or 0, per implementation (auto-fill currently uses 0 for ranking; displayed value may be 0 or blank).
5. **Settle Contest** (or one-click settle).
6. Confirm contest settles successfully; zero-point lanes appear at bottom of standings with correct rank.

### Verification

- [ ] No "All lanes must be ranked" or similar error.
- [ ] Ranks 1..N cover all lanes.
- [ ] Zero/null lanes are last (or tied for last).
- [ ] `Lane.fantasyPoints` for those lanes can be null or 0; payout logic does not assume non-null.

---

## 4. Already-settled contest

**Goal:** Automation does **not** run for an already-settled contest; clear error and no double settlement.

### Steps

1. Pick a contest that is already **SETTLED** (has `SettlementSummary`, PAYOUT transactions).
2. Go to **Admin** → **Settlement**.
3. Confirm that contest **does not** appear in the "locked awaiting settlement" list (only LOCKED, unsettled contests appear there).
4. If you have a direct link or way to trigger **Settle from live results** with that contest’s ID (e.g. custom form or API), trigger it.
5. Expect error: **"Contest is already settled"** or **"This contest already appears settled"**; no DB changes.

### Verification

- [ ] Settled contests are not shown in the settlement form list.
- [ ] Submitting settle (manual or one-click) for an already-settled contest returns an error and does not create duplicate payouts or summary.

---

## 5. Non-LOCKED contest

**Goal:** Automation does **not** run for DRAFT or PUBLISHED contests; clear error.

### Steps

1. Pick a contest in **DRAFT** or **PUBLISHED** (not locked).
2. Go to **Admin** → **Settlement**.
3. Confirm that contest **does not** appear in the list (only LOCKED contests appear).
4. If you can trigger **Settle from live results** with that contest’s ID (e.g. dev tool or modified form), trigger it.
5. Expect error: **"Contest must be LOCKED to settle"**; no settlement.

### Verification

- [ ] Only LOCKED contests show settlement forms and auto-fill / one-click buttons.
- [ ] Calling the one-click settle action with a non-LOCKED contest ID returns an error and does not settle.

---

## High-risk edge cases (summary)

| # | Scenario | Risk | What to verify |
|---|----------|------|----------------|
| 1 | **Reopened contest** | After reopen, lanes may still have old `fantasyPoints`; `liveFantasyPoints` might be null if live stats weren’t re-pulled. Auto-fill uses `liveFantasyPoints ?? fantasyPoints ?? 0`, so old final points could be used. | Reopen a settled contest, do **not** pull live again; click Auto-fill. Ranks/points should reflect **current** DB state (old fantasyPoints). If that’s not desired, re-pull live stats before auto-fill. |
| 2 | **Tie ordering** | Ties are broken by lane `id` for stable sort. Different from “name” or “position” order. | Two lanes with same points always get same rank; order between them is deterministic (by id). No randomness. |
| 3 | **All lanes zero** | Every lane gets points = 0; all tie for rank 1. Settlement requires “at least one lane ranked 1st”; that’s satisfied. Payout splits WIN/PLACE/SHOW across all lanes (dead heat). | Auto-fill and one-click settle succeed; payouts are split N ways for each market. |
| 4 | **One-click without review** | Admin might click “Settle from live results” by mistake or before verifying live data. | No undo except Reopen + resettle. Consider confirming in UI that this contest is the intended one. |
| 5 | **Live stats updated after lock** | If someone pulls live stats **after** lock, lane `liveFantasyPoints` can change. Auto-fill / one-click use current values at click time. | Settle immediately after final pull, or lock after last pull, to avoid confusion. |

---

## Risks of `liveFantasyPoints ?? fantasyPoints ?? 0`

### Intended behavior

- **Before settlement:** Lanes usually have `liveFantasyPoints` from live stats (or manual admin entry); `fantasyPoints` is null. So we use live points for ranking.
- **After reopen:** `fantasyPoints` can still be set from the previous settlement; `liveFantasyPoints` might be null until the next pull. The fallback then uses the **previous** final points so we don’t rank everyone 0.

### Risks

1. **Stale live data**  
   If live stats are never pulled (or pull failed), `liveFantasyPoints` is null and we use `fantasyPoints` (if set) or 0. For a **first-time** settlement with no pull, every lane is 0 → all tie. **Mitigation:** Ensure live stats are pulled and correct before using auto-fill or one-click settle.

2. **Reopen then settle without re-pull**  
   After “Reopen”, lanes keep old `fantasyPoints`; `liveFantasyPoints` may be null. So we rank by **old** final points, not fresh live data. **Mitigation:** After reopen, either re-pull live stats before auto-fill/one-click, or use manual entry.

3. **Mixed sources**  
   Some lanes might have only `liveFantasyPoints`, others only `fantasyPoints` (e.g. after partial update). We still get a single number per lane; ranking is consistent. **Risk:** Slightly inconsistent semantics (live vs previous final). Prefer “final pull” before lock so all lanes have `liveFantasyPoints`.

4. **Explicit 0 vs null**  
   `?? 0` treats both null and undefined as 0. If a lane has `liveFantasyPoints = 0` (scored zero), that’s correct. If a lane has never had stats, 0 is a safe default for “last place.” No extra risk beyond the “all zero” tie case above.

### Recommendation

- Use **Auto-fill from live results** as the default: review pre-filled values, then click “Settle Contest.”
- Use **Settle from live results (no review)** only when you’ve just pulled final stats and confirmed the contest is the right one.
- After **Reopen**, re-pull live stats (or manually set lane points) before using automation again.
