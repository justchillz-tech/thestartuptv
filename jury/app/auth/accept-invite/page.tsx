"use client";

import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AcceptInvitePage() {
  const supabase = createClient();

  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadInvitation() {
      // Supabase invitation flow can return the session
      // in the URL hash:
      // #access_token=...&refresh_token=...

      const hash = window.location.hash;

      if (hash.includes("access_token=")) {
        const hashParams = new URLSearchParams(
          hash.substring(1)
        );

        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");

        if (accessToken && refreshToken) {
          const { data, error: sessionError } =
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

          if (!mounted) return;

          if (sessionError || !data.session) {
            setError(
              sessionError?.message ||
              "This invitation link is invalid or has expired. Please ask the festival administrator to send a new invitation."
            );
          } else {
            setEmail(data.session.user.email ?? "");

            // Remove the auth tokens from the browser URL.
            window.history.replaceState(
              {},
              document.title,
              window.location.pathname
            );
          }

          setReady(true);
          return;
        }
      }

      // Fallback: check for an existing Supabase session
      const { data, error: sessionError } =
        await supabase.auth.getSession();

      if (!mounted) return;

      if (sessionError || !data.session) {
        setError(
          "This invitation link is invalid or has expired. Please ask the festival administrator to send a new invitation."
        );
      } else {
        setEmail(data.session.user.email ?? "");
      }

      setReady(true);
    }

    loadInvitation();

    return () => {
      mounted = false;
    };
  }, [supabase]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Your password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setLoading(true);

    const { error: updateError } =
      await supabase.auth.updateUser({
        password,
      });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    window.location.href = "/dashboard";
  }

  return (
    <main className="auth-shell">
      <div className="auth-glow auth-glow-one" />
      <div className="auth-glow auth-glow-two" />

      <section className="auth-card">
        <div className="brand-lockup">
          <div className="brand-mark">STV</div>

          <div>
            <strong>Startup TV</strong>
            <span>SHORT FILM FESTIVAL</span>
          </div>
        </div>

        <div className="auth-heading">
          <div className="eyebrow">
            <span /> JURY PORTAL
          </div>

          <h1>
            Set your
            <br />
            <em>password.</em>
          </h1>

          <p>
            Create your password to activate your jury account
            and access your assigned films.
          </p>
        </div>

        {!ready ? (
          <div className="auth-message">
            Checking your invitation…
          </div>
        ) : error && !email ? (
          <div className="form-error">{error}</div>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form">
            <label>
              Email
              <input
                type="email"
                value={email}
                readOnly
                autoComplete="email"
              />
            </label>

            <label>
              Create Password
              <input
                type="password"
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
                minLength={8}
                required
                autoComplete="new-password"
              />
            </label>

            <label>
              Confirm Password
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) =>
                  setConfirmPassword(e.target.value)
                }
                minLength={8}
                required
                autoComplete="new-password"
              />
            </label>

            {error && (
              <div className="form-error">{error}</div>
            )}

            <button
              className="button button-primary"
              disabled={loading}
            >
              {loading
                ? "Setting password…"
                : "Set Password"}{" "}
              <span>↗</span>
            </button>
          </form>
        )}
      </section>

      <style jsx>{`
        .auth-message {
          padding: 14px;
          border: 1px solid var(--glass-border);
          border-radius: 12px;
          color: var(--text-secondary);
          font-size: 11px;
          text-align: center;
        }
      `}</style>
    </main>
  );
}