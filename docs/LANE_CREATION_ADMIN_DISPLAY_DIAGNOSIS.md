# Lane creation vs admin display – diagnosis

## Summary

- **Root cause:** Stale UI after lane creation. The API that creates lanes did not invalidate the Next.js cache for `/admin`, so when you returned to the admin page you saw a cached response from before the lanes existed.
- **Lane creation and data are correct:** Lanes are written to the DB with the correct `contestId`; the admin page query and rendering are correct.

---

## Checks performed

### 1. Lane creation writing to the database

- **Yes.** `lib/sports/contest-lane-bridge.ts` uses `prisma.lane.createMany({ data: [...] })` with `contestId`, `playerId`, `name`, `team`, `position`, `status: "ACTIVE"`. All required `Lane` fields are set; `LaneStatus.ACTIVE` exists in the schema.

### 2. Lane records and contestId

- **Correct.** The same `contestId` from the request body is passed to `createLanesFromPlayers(contestId, playerIds)` and used in every `createMany` row. No wrong-contest bug.

### 3. Missing required fields for admin

- **None.** Admin expects `contest.lanes` (array) with lane fields. The bridge sets `contestId`, `name`, `team`, `position`, `status`; admin uses `lane.id`, `lane.name`, `lane.team`, `lane.status`, etc. Optional `playerId` and `player` include are fine (admin includes `player` for display).

### 4. Admin contest query / rendering

- **Correct.** `app/admin/page.tsx` loads contests with:

  ```ts
  prisma.contest.findMany({
    include: {
      lanes: { orderBy: { name: "asc" }, include: { player: { select: { ... } } } },
      ...
    },
  });
  ```

  and renders `contest.lanes.length`, `contest.lanes.map(...)`. No bug here.

### 5. Stale UI / revalidation

- **This was the bug.** The POST handler in `app/api/admin/contest-lanes/route.ts` did not call `revalidatePath("/admin")` (or any path). After a successful create, the server had new lane rows, but the cached RSC payload for `/admin` was still the old one, so the admin page showed no lanes until the cache was invalidated (e.g. hard refresh or later request).

---

## Root cause

**Next.js was serving a cached `/admin` response.** Creating lanes updated the database but did not invalidate that cache, so “return to the admin contest page” showed the pre-creation state.

---

## Files changed

| File | Change |
|------|--------|
| `app/api/admin/contest-lanes/route.ts` | Import `revalidatePath` from `next/cache`; after `createLanesFromPlayers(...)`, call `revalidatePath("/admin")` and `revalidatePath("/")`. |
| `components/admin/contest-lane-builder.tsx` | Use `useRouter()` and call `router.refresh()` after successful lane creation so the current route’s RSC payload is refreshed. |

---

## Manual cleanup

None. No data or schema cleanup required. If you had previously created lanes and only saw stale admin UI, a normal navigation to `/admin` (or a full reload) after deploying the fix will show the existing lanes.

---

## Verify lanes in the DB

Use the contest id you used in the lane builder (e.g. from the contest dropdown or URL `?contestId=...`).

**Prisma Studio**

1. Open Prisma Studio (e.g. `npx prisma studio`).
2. Open the `Lane` model.
3. Filter by `contestId` = `<your-contest-id>` (or inspect rows and check `contestId`).

**SQL (e.g. SQLite/Postgres client or `npx prisma db execute`)**

```sql
SELECT id, "contestId", name, team, position, status, "playerId"
FROM "Lane"
WHERE "contestId" = '<your-contest-id>'
ORDER BY name;
```

Replace `<your-contest-id>` with the real contest id (cuid).

**One-off script (Node)**

```bash
npx ts-node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
const contestId = process.env.CONTEST_ID || 'YOUR_CONTEST_ID';
p.lane.findMany({ where: { contestId }, orderBy: { name: 'asc' } })
  .then(lanes => { console.log(contestId, 'lanes:', lanes.length); console.log(lanes); process.exit(0); })
  .catch(e => { console.error(e); process.exit(1); });
"
```

Set `CONTEST_ID` or replace `YOUR_CONTEST_ID` in the script.
