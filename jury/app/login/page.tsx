"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError("Invalid email or password. Please contact the festival administrator if you need access.");
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
          <div className="eyebrow"><span /> JURY PORTAL</div>
          <h1>Welcome<br /><em>back.</em></h1>
          <p>Sign in to access your assigned films and submit evaluations.</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
          </label>
          {error && <div className="form-error">{error}</div>}
          <button className="button button-primary" disabled={loading}>
            {loading ? "Signing in…" : "Sign In"} <span>↗</span>
          </button>
        </form>
      </section>
    </main>
  );
}
