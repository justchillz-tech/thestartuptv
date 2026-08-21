"use client";

import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

function extractDriveFileId(url: string) {
  const value = url.trim();
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/,
    /\/open\?id=([a-zA-Z0-9_-]+)/,
  ];
  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match) return match[1];
  }
  return "";
}

export default function FilmManager() {
  const supabase = createClient();
  const [films, setFilms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({ film_code: "", title: "", director: "", duration: "", language: "", drive_url: "" });

  async function loadFilms() {
    const { data, error: loadError } = await supabase
      .from("films")
      .select("id, film_code, title, director, duration, language, drive_url, drive_file_id, status, created_at")
      .order("created_at", { ascending: false });
    if (loadError) setError(loadError.message);
    else setFilms(data ?? []);
    setLoading(false);
  }

  useEffect(() => { loadFilms(); }, []);

  function updateField(name: string, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    const driveFileId = extractDriveFileId(form.drive_url);
    if (!driveFileId) {
      setError("Enter a valid Google Drive file URL. Example: https://drive.google.com/file/d/FILE_ID/view");
      return;
    }

    setSaving(true);
    const { error: insertError } = await supabase.from("films").insert({
      film_code: form.film_code.trim(),
      title: form.title.trim(),
      director: form.director.trim(),
      duration: form.duration.trim(),
      language: form.language.trim(),
      drive_url: form.drive_url.trim(),
      drive_file_id: driveFileId,
    });

    if (insertError) {
      setError(insertError.code === "23505" ? "This film code or Google Drive file has already been added." : insertError.message);
      setSaving(false);
      return;
    }

    setForm({ film_code: "", title: "", director: "", duration: "", language: "", drive_url: "" });
    setMessage("Film added successfully.");
    setSaving(false);
    await loadFilms();
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
            <div className="eyebrow"><span /> FILM MANAGEMENT</div>
            <h1>Add the<br /><em>stories.</em></h1>
            <p>Add submitted films here before assigning them to jury members. Google Drive file IDs are extracted automatically from the film URL.</p>
          </div>
          <div className="admin-count"><span>FILMS</span><strong>{films.length}</strong><small>in system</small></div>
        </div>

        <section className="admin-panel">
          <div className="panel-title"><div><span>NEW SUBMISSION</span><h2>Add a film</h2></div><span className="panel-note">All fields required</span></div>
          <form className="admin-form" onSubmit={handleSubmit}>
            <label>Film Code<input value={form.film_code} onChange={(e) => updateField("film_code", e.target.value)} placeholder="STV-001" required /></label>
            <label>Title<input value={form.title} onChange={(e) => updateField("title", e.target.value)} placeholder="Film title" required /></label>
            <label>Director<input value={form.director} onChange={(e) => updateField("director", e.target.value)} placeholder="Director name" required /></label>
            <label>Duration<input value={form.duration} onChange={(e) => updateField("duration", e.target.value)} placeholder="18:30" required /></label>
            <label>Language<input value={form.language} onChange={(e) => updateField("language", e.target.value)} placeholder="English" required /></label>
            <label className="wide-field">Google Drive Film URL<input type="url" value={form.drive_url} onChange={(e) => updateField("drive_url", e.target.value)} placeholder="https://drive.google.com/file/d/.../view" required /></label>
            {error && <div className="form-error wide-field">{error}</div>}
            {message && <div className="form-success wide-field">{message}</div>}
            <div className="wide-field form-actions"><span>Duplicate Drive files are blocked at the database level.</span><button className="button button-primary" disabled={saving}>{saving ? "Adding…" : "Add Film"} <span>↗</span></button></div>
          </form>
        </section>

        <section className="admin-panel">
          <div className="panel-title"><div><span>SUBMISSIONS</span><h2>Films in the system</h2></div></div>
          {loading ? <div className="empty-state">Loading films…</div> : films.length === 0 ? (
            <div className="empty-state"><strong>No films added yet.</strong><span>Films added above will appear here.</span></div>
          ) : (
            <div className="film-admin-list">
              {films.map((film) => (
                <article className="film-admin-row" key={film.id}>
                  <div className="film-admin-code">{film.film_code}</div>
                  <div className="film-admin-main"><strong>{film.title}</strong><span>{film.director} · {film.duration} · {film.language}</span></div>
                  <div className="film-admin-status">{film.status}</div>
                  <a className="secondary-button admin-watch" href={film.drive_url} target="_blank" rel="noopener noreferrer">Open film ↗</a>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
