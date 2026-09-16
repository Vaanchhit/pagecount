"use client";

import { useState, useTransition } from "react";
import { deleteAccount } from "@/app/actions/account";

export default function DeleteAccountButton() {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!confirming) {
    return (
      <button type="button" className="btn btn--quiet" onClick={() => setConfirming(true)}>
        Delete account
      </button>
    );
  }

  return (
    <div className="card wobble-b" style={{ padding: 18 }}>
      <p className="meta mb-md">
        This permanently deletes your account, shelf, reading history, streaks, and badges.
        There is no undo.
      </p>
      {error && <p className="error mb-md">{error}</p>}
      <div className="row sketch-set">
        <button
          type="button"
          className="btn btn--primary"
          disabled={pending}
          onClick={() => start(async () => {
            const res = await deleteAccount();
            if (res?.error) setError(res.error);
          })}
        >
          {pending ? "Deleting" : "Yes, delete everything"}
        </button>
        <button type="button" className="btn btn--quiet" disabled={pending} onClick={() => setConfirming(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}
