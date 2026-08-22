"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Submission = {
  id: string;
  submitted_at: string | null;
  participant_email: string | null;
  submitted_email: string | null;
  participant_name: string;
  contact_number: string | null;
  organization: string | null;
  title: string;
  genre: string | null;
  duration: string | null;
  production_year: string | null;
  director_name: string | null;
  producer_name: string | null;
  language: string | null;
  synopsis: string | null;
  cast_crew: string | null;
  film_url: string | null;
  status: "pending" | "approved" | "rejected";
  rejection_reason: string | null;
};

function formatDate(value: string | null) {
  if (!value) return "Date unavailable";
  return new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export default function SubmissionManager() {
  const supabase = createClient();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Submission | null>(null);

  async function loadSubmissions() {
    setLoading(true);
    const { data, error: loadError } = await supabase
      .from("film_submissions")
      .select("id, submitted_at, participant_email, submitted_email, participant_name, contact_number, organization, title, genre, duration, production_year, director_name, producer_name, language, synopsis, cast_crew, film_url, status, rejection_reason")
      .order("submitted_at", { ascending: false });

    if (loadError) setError(loadError.message);
    else setSubmissions((data ?? []) as Submission[]);
    setLoading(false);
  }

  useEffect(() => { loadSubmissions(); }, []);

  async function syncSheet() {
    setSyncing(true);
    setMessage("");
    setError("");
    const response = await fetch("/api/admin/submissions/sync", { method: "POST" });
    const result = await response.json();
    if (!response.ok) setError(result.error ?? "Unable to synchronize the response sheet.");
    else setMessage(result.message ?? "Submissions synchronized.");
    setSyncing(false);
    await loadSubmissions();
  }

  return (
    <main className="portal-shell admin-shell">
      <header className="portal-header">
        <a href="/dashboard" className="brand-lockup compact"><div className="brand-mark">STV</div><div><strong>Startup TV</strong><span>JURY PORTAL · ADMIN</span></div></a>
        <a href="/dashboard" className="back-link">← Jury dashboard</a>
      </header>

      <section className="admin-wrap">
        <div className="admin-heading">
          <div>
            <div className="eyebrow"><span /> PARTICIPANT SUBMISSIONS</div>
            <h1>Find the<br /><em>next story.</em></h1>
            <p>Pull participant entries from the festival response sheet, review the submitted details and approve only the films that should enter the jury system.</p>
          </div>
          <div className="admin-count"><span>SUBMISSIONS</span><strong>{submissions.length}</strong><small>{submissions.filter((item) => item.status === "pending").length} pending review</small></div>
        </div>

        <section className="admin-panel toolbar-panel">
          <div>
            <span className="panel-kicker">GOOGLE FORM INTAKE</span>
            <h2>Response sheet sync</h2>
            <p>Existing and new responses are synchronized without creating duplicate submissions.</p>
          </div>
          <button className="button button-primary" onClick={syncSheet} disabled={syncing}>{syncing ? "Syncing…" : "Sync submissions"} <span>↗</span></button>
        </section>

        {error && <div className="form-error global-message">{error}</div>}
        {message && <div className="form-success global-message">{message}</div>}

        <section className="admin-panel">
          <div className="panel-title"><div><span>INBOX</span><h2>Participant submissions</h2></div><span className="panel-note">Approval comes before jury assignment</span></div>
          {loading ? <div className="empty-state">Loading submissions…</div> : submissions.length === 0 ? (
            <div className="empty-state"><strong>No submissions synchronized yet.</strong><span>Click “Sync submissions” to pull the Google Form responses.</span></div>
          ) : (
            <div className="submission-list">
              {submissions.map((submission) => (
                <article className="submission-row" key={submission.id}>
                  <div className="submission-code">{submission.status.toUpperCase()}</div>
                  <div className="submission-main"><strong>{submission.title}</strong><span>{submission.participant_name} · {submission.organization || "Independent"}</span><small>{submission.genre || "Genre not supplied"} · {submission.language || "Language not supplied"} · {formatDate(submission.submitted_at)}</small></div>
                  <div className="submission-status">{submission.status}</div>
                  <button className="secondary-button" onClick={() => setSelected(submission)}>Review ↗</button>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>

      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <section className="submission-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-top"><div><span>SUBMISSION REVIEW</span><h2>{selected.title}</h2></div><button className="close-button" onClick={() => setSelected(null)}>×</button></div>
            <div className="detail-grid">
              <div><span>Participant</span><strong>{selected.participant_name}</strong></div>
              <div><span>Email</span><strong>{selected.participant_email || selected.submitted_email || "—"}</strong></div>
              <div><span>Contact</span><strong>{selected.contact_number || "—"}</strong></div>
              <div><span>Organization</span><strong>{selected.organization || "—"}</strong></div>
              <div><span>Director</span><strong>{selected.director_name || "—"}</strong></div>
              <div><span>Producer</span><strong>{selected.producer_name || "—"}</strong></div>
              <div><span>Genre</span><strong>{selected.genre || "—"}</strong></div>
              <div><span>Language</span><strong>{selected.language || "—"}</strong></div>
              <div><span>Duration</span><strong>{selected.duration || "—"}</strong></div>
              <div><span>Production year</span><strong>{selected.production_year || "—"}</strong></div>
            </div>
            <div className="detail-block"><span>SYNOPSIS</span><p>{selected.synopsis || "No synopsis supplied."}</p></div>
            <div className="detail-block"><span>CAST & CREW</span><p>{selected.cast_crew || "No cast and crew details supplied."}</p></div>
            <div className="modal-actions">
              {selected.film_url && <a className="secondary-button" href={selected.film_url} target="_blank" rel="noopener noreferrer">Open submitted film ↗</a>}
              <span className={`modal-status status-${selected.status}`}>{selected.status}</span>
              <button className="button button-primary" disabled={selected.status !== "pending"}>Approve film <span>↗</span></button>
            </div>
            <small className="approval-note">Approval will be connected to film creation in the next step. This review screen currently does not alter the submission.</small>
          </section>
        </div>
      )}

      <style jsx>{`
        .admin-wrap{width:min(1240px,90vw);margin:0 auto;padding:75px 0 100px}
        .admin-heading{display:flex;justify-content:space-between;align-items:flex-end;gap:50px;margin-bottom:45px}.admin-heading h1{margin:15px 0 18px;font:800 clamp(48px,6vw,76px)/.95 Poppins,sans-serif;letter-spacing:-.055em}.admin-heading h1 em{font-style:normal;background:var(--gradient-main);-webkit-background-clip:text;background-clip:text;color:transparent}.admin-heading p{max-width:650px;margin:0;color:var(--text-secondary);font-size:14px;line-height:1.8}
        .admin-count{flex:0 0 170px;padding:22px;border:1px solid var(--glass-border);background:var(--glass-bg);border-radius:18px}.admin-count span,.admin-count small{display:block;color:var(--text-secondary);font-size:8px;letter-spacing:.16em}.admin-count strong{display:block;margin:5px 0;font:800 40px Poppins,sans-serif;background:var(--gradient-main);-webkit-background-clip:text;background-clip:text;color:transparent}
        .admin-panel{margin-top:18px;padding:28px;border:1px solid var(--glass-border);background:linear-gradient(145deg,rgba(255,255,255,.055),rgba(255,255,255,.025));border-radius:20px}.toolbar-panel{display:flex;align-items:center;justify-content:space-between;gap:30px}.toolbar-panel h2{margin:6px 0;font:700 22px Poppins,sans-serif}.toolbar-panel p{margin:0;color:var(--text-secondary);font-size:11px}.panel-kicker{color:var(--text-secondary);font-size:9px;font-weight:700;letter-spacing:.16em}.panel-title{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:25px}.panel-title>div>span{color:var(--text-secondary);font-size:9px;font-weight:700;letter-spacing:.16em}.panel-title h2{margin:7px 0 0;font:700 22px Poppins,sans-serif}.panel-note{color:var(--text-secondary);font-size:10px}
        .global-message{margin-top:18px}.form-success{border:1px solid rgba(80,220,130,.3);background:rgba(80,220,130,.08);color:#a8efbd;padding:12px 13px;border-radius:10px;font-size:11px}
        .submission-list{border:1px solid rgba(255,255,255,.07);border-radius:15px;overflow:hidden}.submission-row{display:grid;grid-template-columns:90px minmax(0,1fr) 80px 100px;gap:18px;align-items:center;padding:18px;border-top:1px solid rgba(255,255,255,.07)}.submission-row:first-child{border-top:0}.submission-code{font-size:8px;letter-spacing:.12em;color:#f0a36b}.submission-main{display:grid;gap:4px}.submission-main strong{font:600 14px Poppins,sans-serif}.submission-main span,.submission-main small{color:var(--text-secondary);font-size:10px}.submission-status{font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:var(--text-secondary)}
        .modal-backdrop{position:fixed;inset:0;z-index:50;display:flex;justify-content:center;align-items:center;padding:30px;background:rgba(3,5,18,.78);backdrop-filter:blur(10px)}.submission-modal{width:min(900px,94vw);max-height:90vh;overflow:auto;padding:30px;border:1px solid var(--glass-border);border-radius:22px;background:#0b0e1d;box-shadow:0 30px 100px rgba(0,0,0,.55)}.modal-top{display:flex;justify-content:space-between;gap:20px;align-items:flex-start}.modal-top>div>span,.detail-block>span{color:var(--text-secondary);font-size:9px;letter-spacing:.16em;font-weight:700}.modal-top h2{margin:8px 0 25px;font:700 28px Poppins,sans-serif}.close-button{border:1px solid var(--glass-border);background:rgba(255,255,255,.04);color:white;border-radius:50%;width:34px;height:34px;font-size:20px;cursor:pointer}.detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.detail-grid>div{padding:13px;border:1px solid rgba(255,255,255,.07);border-radius:12px;background:rgba(255,255,255,.025)}.detail-grid span{display:block;color:var(--text-secondary);font-size:8px;text-transform:uppercase;letter-spacing:.12em;margin-bottom:5px}.detail-grid strong{font-size:11px}.detail-block{margin-top:14px;padding:15px;border-left:2px solid #f3961f;background:rgba(255,255,255,.025)}.detail-block p{margin:8px 0 0;color:#c7cad8;font-size:11px;line-height:1.7;white-space:pre-wrap}.modal-actions{display:flex;align-items:center;justify-content:flex-end;gap:10px;margin-top:22px}.modal-status{font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:var(--text-secondary);margin-right:auto}.status-pending{color:#f0a36b}.status-approved{color:#a8efbd}.status-rejected{color:#ff9b9b}.approval-note{display:block;margin-top:12px;color:var(--text-secondary);font-size:9px;text-align:right}
        @media(max-width:800px){.admin-heading{flex-direction:column;align-items:flex-start}.toolbar-panel{align-items:flex-start;flex-direction:column}.submission-row{grid-template-columns:1fr;gap:8px}.detail-grid{grid-template-columns:1fr}.modal-actions{flex-wrap:wrap;justify-content:flex-start}.approval-note{text-align:left}}
      `}</style>
    </main>
  );
}
