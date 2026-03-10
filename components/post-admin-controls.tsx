"use client";

import { useEffect, useState } from "react";

export function PostAdminControls(props: {
  initialBody: string;
  isPinned: boolean;
  isHidden: boolean;

  // server actions (wired via <form action={...}>)
  pinAction: (formData: FormData) => Promise<void>;
  hideAction: (formData: FormData) => Promise<void>;
  removeAction: (formData: FormData) => Promise<void>;
  editAction: (formData: FormData) => Promise<void>;
}) {
  const { initialBody, isPinned, isHidden, pinAction, hideAction, removeAction, editAction } = props;

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(initialBody);

  // keep textarea in sync if server re-renders with updated body
  useEffect(() => {
  setDraft(initialBody);
}, [initialBody]);

  return (
    <div className="flex items-center gap-2">
      {!isEditing ? (
        <>
          <form action={pinAction} className="inline">
            <button
              type="submit"
              className="text-xs font-medium text-track-800 hover:underline"
            >
              {isPinned ? "Unpin" : "Pin"}
            </button>
          </form>

          <form action={hideAction} className="inline">
            <button
              type="submit"
              className="text-xs font-medium text-track-800 hover:underline"
            >
              {isHidden ? "Unhide" : "Hide"}
            </button>
          </form>

          <button
            type="button"
            className="text-xs font-medium text-track-800 hover:underline"
            onClick={() => {
              setDraft(initialBody);
              setIsEditing(true);
            }}
          >
            Edit
          </button>

          <form
            action={removeAction}
            className="inline"
            onSubmit={(e) => {
              if (!confirm("Remove this post? (Soft delete)")) e.preventDefault();
            }}
          >
            <button
              type="submit"
              className="text-xs font-medium text-red-700 hover:underline"
            >
              Remove
            </button>
          </form>
        </>
      ) : (
        <div className="w-full space-y-2">
          <textarea
            name="body"
            rows={4}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="w-full rounded-md border border-track-200 p-2 text-sm outline-none focus:ring-2 focus:ring-track-300"
            maxLength={1000}
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              className="rounded-md border border-track-200 px-3 py-1 text-xs font-medium text-track-800 hover:bg-track-50"
              onClick={() => setIsEditing(false)}
            >
              Cancel
            </button>

            <form
              action={editAction}
              onSubmit={(e) => {
                const next = draft.trim();
                if (!next) e.preventDefault();
              }}
            >
              {/* keep form value in sync */}
              <input type="hidden" name="body" value={draft} />
              <button
                type="submit"
                className="rounded-md bg-track-900 px-3 py-1 text-xs font-medium text-white hover:bg-track-800"
                onClick={() => {
                  // optimistic close; server will re-render if success
                  if (draft.trim()) setIsEditing(false);
                }}
              >
                Save
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}