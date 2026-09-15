"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Marketing mode: no .app wrapper, so headings and button labels take the
// display face. Copy avoids capital I — every capital in that face is a
// swash and "I" is drawn like a "J".
export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function emailLink() {
    setBusy(true); setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    });
    setBusy(false);
    if (error) setError("That didn't send. Check the address and try again.");
    else setSent(true);
  }

  async function google() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback` },
    });
  }

  return (
    <div className="auth">
      <div className="auth__inner">
        <span className="tag">Reading log</span>

        <h1 className="hero-title" style={{ fontSize: "clamp(2rem, 6vw, 2.75rem)", margin: "18px 0 14px" }}>
          Read more, together.
        </h1>

        <p className="body-lg mb-lg">
          Log the pages you read, keep a daily streak going, and see what your
          friends have open right now.
        </p>

        {sent ? (
          <p className="card">Check your email — there&apos;s a sign-in link waiting.</p>
        ) : (
          <div className="stack-sm">
            <button className="btn" style={{ width: "100%" }} onClick={google}>
              Continue with Google
            </button>

            <p className="rule">or</p>

            <label className="field">
              <input
                type="email" value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && emailLink()}
                placeholder="you@email.com" aria-label="Email address"
              />
            </label>

            <button
              className="btn btn--primary" style={{ width: "100%" }}
              onClick={emailLink} disabled={busy || !email.includes("@")}
            >
              {busy ? "Sending" : "Email me a link"}
            </button>

            {error && <p className="error">{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
