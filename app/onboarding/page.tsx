"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateProfile } from "@/app/actions/social";

export default function Onboarding() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [goal, setGoal] = useState(20);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Read from the browser so streaks land on the right day from the very
  // first log. Everything server-side keys off this, never UTC.
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <div className="app auth">
      <div className="auth__inner">
        <h1 className="page-title">Set yourself up</h1>
        <p className="meta mt-sm mb-lg">Two fields and a number.</p>

        <label className="label" htmlFor="u">Username</label>
        <label className="field" htmlFor="u">
          <input id="u" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} placeholder="yuvraj" />
        </label>

        <label className="label mt-md" htmlFor="d">Display name</label>
        <label className="field" htmlFor="d">
          <input id="d" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Yuvraj" />
        </label>

        <label className="label mt-md" htmlFor="g">Daily page goal</label>
        <label className="field" htmlFor="g">
          <input id="g" type="number" className="num" value={goal} onChange={(e) => setGoal(Number(e.target.value))} />
        </label>
        <p className="meta mt-sm">
          This only fills the ring. Your streak survives on a single page, so a light
          day won&apos;t break it.
        </p>

        {error && <p className="error mt-md">{error}</p>}

        <button
          className="btn btn--primary mt-lg" style={{ width: "100%" }}
          disabled={pending || username.length < 3}
          onClick={() => start(async () => {
            const res = await updateProfile({ username, displayName, timezone, dailyPageGoal: goal });
            if (res.error) setError(res.error); else router.push("/library");
          })}
        >
          {pending ? "Saving" : "Start reading"}
        </button>

        <p className="meta mt-md center">Timezone detected: {timezone}</p>
      </div>
    </div>
  );
}
