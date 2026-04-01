import { getCurrentSession } from "../lib/session";
import { formatDateTime } from "../lib/format";
import { hasEnteredContest } from "../lib/entry";
import {
  createContestPost,
  getContestPosts,
  setPostHidden,
  setPostPinned,
  editContestPost,
  deleteContestPost,
} from "../lib/contest-board";
import { PostAdminControls } from "@/components/post-admin-controls";


type ContestMessageBoardProps = {
  contestId: string;
  revalidatePath: string;
  /** Omit outer card when nested (e.g. mobile accordion). */
  plain?: boolean;
};

export async function ContestMessageBoard({
  contestId,
  revalidatePath,
  plain,
}: ContestMessageBoardProps) {
  const session = await getCurrentSession();
  const userId = session?.user?.id ?? null;
  const isAdmin = Boolean(
    (session?.user as { isAdmin?: boolean } | undefined)?.isAdmin
  );

  const posts = await getContestPosts(contestId);
  

  // ✅ posting gate: entered users only (admins always allowed)
  const canPost = isAdmin || (userId ? await hasEnteredContest(contestId, userId) : false);

  const createPostAction = async (formData: FormData) => {
    "use server";

    const body = String(formData.get("body") ?? "").trim();
    if (!body) throw new Error("Post cannot be empty.");

    // Only admins can post as Commish; ignore it otherwise
    const asCommishRequested = formData.get("asCommish") === "on";
    const asCommish = isAdmin && asCommishRequested;

    // ✅ Enforcement lives in createContestPost() too (belt + suspenders)
    await createContestPost({
      contestId,
      body,
      asCommish,
      pathToRevalidate: revalidatePath,
    });
  };

  return (
    <section className={plain ? "space-y-4" : "ft-surface p-5 sm:p-6"}>
      {!plain ? (
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="ft-label text-neutral-500">Discussion</p>
            <h2 className="mt-1 text-base font-bold tracking-tight text-neutral-50">Message board</h2>
          </div>
          <p className="text-xs font-medium tabular-nums text-neutral-500">{posts.length} posts</p>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-neutral-500">{posts.length} posts</p>
        </div>
      )}

      <form action={createPostAction as any} className="mt-4 space-y-2">
        <textarea
          name="body"
          rows={3}
          maxLength={1000}
          disabled={!canPost}
          placeholder={canPost ? "Talk your talk..." : "Enter this contest (100 pts) to post."}
          className={[
            "w-full ft-input min-h-[4.5rem] p-2 text-sm",
            !canPost ? "cursor-not-allowed text-neutral-500" : "",
          ].join(" ")}
        />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isAdmin ? (
              <label className="flex items-center gap-2 text-xs text-neutral-300">
                <input type="checkbox" name="asCommish" />
                Post as Official
              </label>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={!canPost}
            className={[
              "rounded-full px-4 py-2 text-sm font-bold text-neutral-950 transition",
              canPost
                ? "bg-ft-cta shadow-ft-inner hover:brightness-110 active:scale-[0.98] ft-focus-ring"
                : "cursor-not-allowed bg-neutral-800 text-neutral-500",
            ].join(" ")}
          >
            Post
          </button>
        </div>

        {/* ✅ Step 2: helper text when disabled */}
        {!canPost ? (
          <p className="text-xs text-neutral-400">
            You must enter this contest (100 pts) to post on the message board.
          </p>
        ) : null}
      </form>

      <div className="mt-5 space-y-3">
        {posts.length === 0 ? (
          <p className="text-sm text-neutral-400">No messages yet.</p>
        ) : (
          posts.map((p: any) => {
            const pinAction = async (_formData: FormData) => {
  "use server";
  await setPostPinned({
    postId: p.id,
    pinned: !p.isPinned,
    pathToRevalidate: revalidatePath,
  });
};

const hideAction = async (_formData: FormData) => {
  "use server";
  await setPostHidden({
    postId: p.id,
    hidden: !p.isHidden,
    pathToRevalidate: revalidatePath,
  });
};

const removeAction = async (_formData: FormData) => {
  "use server";
  await deleteContestPost({
    postId: p.id,
    pathToRevalidate: revalidatePath,
  });
};

const editAction = async (formData: FormData) => {
  "use server";
  const nextBody = String(formData.get("body") ?? "").trim();
  await editContestPost({
    postId: p.id,
    body: nextBody,
    pathToRevalidate: revalidatePath,
  });
};



            return (
              <div
                key={p.id}
                className={[
                  "rounded-ft border p-3 transition hover:border-white/[0.1]",
                  p.isCommish
                    ? "border-ft-gold/35 bg-ft-gold/[0.06] border-l-[3px] border-l-ft-gold"
                    : "border-white/[0.06] bg-black/35",
                  p.isHidden ? "opacity-50" : "",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold tracking-wide text-neutral-50">
  {p.isCommish ? "FantasyTrack" : p.user.displayName}
</p>

                      {p.isCommish ? (
                        <span className="rounded-full border border-ft-gold/40 bg-ft-gold/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ft-gold">
  Official
</span>
                      ) : null}

                      {p.isPinned ? (
                        <span className="rounded border border-neutral-700 px-2 py-0.5 text-[10px] font-semibold text-neutral-200">
                          PINNED
                        </span>
                      ) : null}

                      {p.isHidden ? (
                        <span className="rounded border border-red-400 px-2 py-0.5 text-[10px] font-semibold text-red-300">
                          HIDDEN
                        </span>
                      ) : null}
                    </div>

                    <p className="mt-1 text-xs text-neutral-400">
                      {formatDateTime(p.createdAt as Date)}
                    </p>
                  </div>

                  {isAdmin ? (
  <PostAdminControls
    initialBody={p.body}
    isPinned={Boolean(p.isPinned)}
    isHidden={Boolean(p.isHidden)}
    pinAction={pinAction as any}
    hideAction={hideAction as any}
    removeAction={removeAction as any}
    editAction={editAction as any}
  />
) : null}
                </div>

                <p className="mt-3 whitespace-pre-wrap text-sm text-neutral-100">{p.body}</p>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}