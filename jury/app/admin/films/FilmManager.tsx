"use client";

import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

function extractDriveFileId(url: string) {
  const value = url.trim();
  const patterns = [/\/file\/d\/([a-zA-Z0-9_-]+)/, /[?&]id=([a-zA-Z0-9_-]+)/, /\/open\?id=([a-zA-Z0-9_-]+)/];
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
  const [languageFilter, setLanguageFilter] = useState("all");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({ film_code: "", title: "", director: "", duration: "", language: "", drive_url: "" });

  async function loadFilms() {
    const { data, error: loadError } = await supabase
      .from("films")
      .select(
        "id, film_code, title, director, duration, language, video_url, drive_url, drive_file_id, status, created_at"
      )
      .order("created_at", { ascending: false });

    if (loadError) {
      setError(loadError.message);
    } else {
      setFilms(data ?? []);
    }

    setLoading(false);
  }

  useEffect(() => { loadFilms(); }, []);
  const languageCounts = films.reduce<Record<string, number>>(
    (counts, film) => {
      const language =
        typeof film.language === "string"
          ? film.language.trim()
          : "";

      const key = language || "Unknown";

      counts[key] = (counts[key] ?? 0) + 1;

      return counts;
    },
    {}
  );

  const sortedLanguages = Object.entries(languageCounts).sort(
    ([languageA, countA], [languageB, countB]) =>
      countB - countA ||
      languageA.localeCompare(languageB)
  );

  const filteredFilms =
    languageFilter === "all"
      ? films
      : films.filter((film) => {
        const language =
          typeof film.language === "string"
            ? film.language.trim()
            : "";

        return (language || "Unknown") === languageFilter;
      });

  function updateField(name: string, value: string) { setForm((current) => ({ ...current, [name]: value })); }

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
    const { error: insertError } = await supabase.from("films").insert({ film_code: form.film_code.trim(), title: form.title.trim(), director: form.director.trim(), duration: form.duration.trim(), language: form.language.trim(), drive_url: form.drive_url.trim(), drive_file_id: driveFileId });
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
          <div><div className="eyebrow"><span /> FILM MANAGEMENT</div><h1>Add the<br /><em>stories.</em></h1><p>Add submitted films here before assigning them to jury members. Google Drive file IDs are extracted automatically from the film URL.</p></div>
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
          <div className="language-filter">
            <div className="language-filter-label">
              <span>LANGUAGE FILTER</span>
              <small>
                {filteredFilms.length} of {films.length} films
              </small>
            </div>

            <div className="language-filter-list">
              <button
                type="button"
                className={`language-filter-button ${languageFilter === "all" ? "active" : ""
                  }`}
                onClick={() => setLanguageFilter("all")}
              >
                <span>All</span>
                <strong>{films.length}</strong>
              </button>

              {sortedLanguages.map(([language, count]) => (
                <button
                  type="button"
                  className={`language-filter-button ${languageFilter === language ? "active" : ""
                    }`}
                  key={language}
                  onClick={() => setLanguageFilter(language)}
                >
                  <span>{language}</span>
                  <strong>{count}</strong>
                </button>
              ))}
            </div>
          </div>
          {loading ? (
            <div className="empty-state">
              Loading films…
            </div>
          ) : films.length === 0 ? (
            <div className="empty-state">
              <strong>No films added yet.</strong>
              <span>Films added above will appear here.</span>
            </div>
          ) : filteredFilms.length === 0 ? (
            <div className="empty-state">
              <strong>No films in this language.</strong>
              <span>
                Try selecting another language filter.
              </span>
            </div>
          ) : (
            <div className="film-admin-list">
              {filteredFilms.map((film) => (
                <article
                  className="film-admin-row"
                  key={film.id}
                >
                  <div className="film-admin-code">
                    {film.film_code}
                  </div>

                  <div className="film-admin-main">
                    <strong>{film.title}</strong>
                    <span>
                      {film.director} · {film.duration} · {film.language}
                    </span>
                  </div>

                  <div className="film-admin-status">
                    {film.status}
                  </div>

                  <a
                    className="secondary-button admin-watch"
                    href={film.video_url || film.drive_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open film ↗
                  </a>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
      <style jsx>{`
        .admin-wrap {
          width: min(1240px, 90vw);
          margin: 0 auto;
          padding: 75px 0 100px;
        }

        /* -----------------------------------------
          PAGE HEADER
        ----------------------------------------- */

        .admin-heading {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 50px;
          margin-bottom: 45px;
        }

        .admin-heading h1 {
          margin: 15px 0 18px;
          font: 800 clamp(48px, 6vw, 76px) / .95 Poppins, sans-serif;
          letter-spacing: -.055em;
        }

        .admin-heading h1 em {
          font-style: normal;
          background: var(--gradient-main);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }

        .admin-heading p {
          max-width: 610px;
          margin: 0;
          color: var(--text-secondary);
          font-size: 14px;
          line-height: 1.8;
        }

        .admin-count {
          flex: 0 0 150px;
          padding: 22px;
          border: 1px solid var(--glass-border);
          background: var(--glass-bg);
          border-radius: 18px;
        }

        .admin-count span,
        .admin-count small {
          display: block;
          color: var(--text-secondary);
          font-size: 8px;
          letter-spacing: .16em;
        }

        .admin-count strong {
          display: block;
          margin: 5px 0;
          font: 800 40px Poppins, sans-serif;
          background: var(--gradient-main);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }

        /* -----------------------------------------
          PANELS
        ----------------------------------------- */

        .admin-panel {
          margin-top: 18px;
          padding: 28px;
          border: 1px solid var(--glass-border);
          background: linear-gradient(
            145deg,
            rgba(255, 255, 255, .055),
            rgba(255, 255, 255, .025)
          );
          border-radius: 20px;
        }

        .panel-title {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 25px;
        }

        .panel-title > div > span {
          color: var(--text-secondary);
          font-size: 9px;
          font-weight: 700;
          letter-spacing: .16em;
        }

        .panel-title h2 {
          margin: 7px 0 0;
          font: 700 22px Poppins, sans-serif;
        }

        .panel-note {
          color: var(--text-secondary);
          font-size: 10px;
        }

        /* -----------------------------------------
          ADD FILM FORM
        ----------------------------------------- */

        .admin-form {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 17px;
        }

        .admin-form label {
          display: grid;
          gap: 8px;
          color: #eee;
          font-size: 11px;
          font-weight: 700;
        }

        .admin-form input {
          width: 100%;
          border: 1px solid var(--glass-border);
          outline: none;
          color: white;
          background: rgba(255, 255, 255, .045);
          border-radius: 12px;
          padding: 13px 14px;
        }

        .admin-form input:focus {
          border-color: rgba(243, 150, 31, .65);
          background: rgba(255, 255, 255, .065);
        }

        .wide-field {
          grid-column: 1 / -1;
        }

        .form-actions {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          padding-top: 5px;
          color: var(--text-secondary);
          font-size: 10px;
        }

        .form-success {
          border: 1px solid rgba(80, 220, 130, .3);
          background: rgba(80, 220, 130, .08);
          color: #a8efbd;
          padding: 12px 13px;
          border-radius: 10px;
          font-size: 11px;
        }

        /* -----------------------------------------
          FILM LIST
        ----------------------------------------- */

        .film-admin-list {
          border: 1px solid rgba(255, 255, 255, .07);
          border-radius: 15px;
          overflow: hidden;
        }

        .film-admin-row {
          display: grid;
          grid-template-columns: 100px minmax(0, 1fr) 90px 110px;
          gap: 18px;
          align-items: center;
          padding: 17px 18px;
          border-top: 1px solid rgba(255, 255, 255, .07);
        }

        .film-admin-row:first-child {
          border-top: 0;
        }

        .film-admin-code {
          color: #f0a36b;
          font: 700 10px Poppins, sans-serif;
          letter-spacing: .08em;
        }

        .film-admin-main {
          display: grid;
          gap: 5px;
        }

        .film-admin-main strong {
          font: 600 13px Poppins, sans-serif;
        }

        .film-admin-main span {
          color: var(--text-secondary);
          font-size: 10px;
        }

        .film-admin-status {
          color: var(--text-secondary);
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: .12em;
        }

        .admin-watch {
          padding: 9px 12px;
          text-align: center;
        }

        /* -----------------------------------------
          LANGUAGE FILTER
        ----------------------------------------- */

        .language-filter {
          margin-bottom: 22px;
          padding: 16px;
          border: 1px solid rgba(255, 255, 255, .07);
          border-radius: 14px;
          background: rgba(255, 255, 255, .025);
        }

        .language-filter-label {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          margin-bottom: 12px;
        }

        .language-filter-label span {
          color: var(--text-secondary);
          font-size: 8px;
          font-weight: 700;
          letter-spacing: .14em;
        }

        .language-filter-label small {
          color: var(--text-secondary);
          font-size: 9px;
        }

        .language-filter-list {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .language-filter-button {
          display: inline-flex;
          align-items: center;
          gap: 9px;
          padding: 9px 12px;
          border: 1px solid rgba(255, 255, 255, .08);
          border-radius: 999px;
          background: rgba(255, 255, 255, .035);
          color: var(--text-secondary);
          cursor: pointer;
          font: inherit;
          transition:
            background .2s ease,
            border-color .2s ease,
            color .2s ease,
            transform .2s ease;
        }

        .language-filter-button span {
          font-size: 9px;
          font-weight: 600;
        }

        .language-filter-button strong {
          min-width: 18px;
          height: 18px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          background: rgba(255, 255, 255, .08);
          color: #fff;
          font-size: 8px;
        }

        .language-filter-button:hover {
          border-color: rgba(255, 255, 255, .2);
          color: #fff;
          transform: translateY(-1px);
        }

        .language-filter-button.active {
          border-color: rgba(243, 150, 31, .55);
          background: rgba(243, 150, 31, .10);
          color: #fff;
        }

        .language-filter-button.active strong {
          background: rgba(243, 150, 31, .18);
        }

        /* -----------------------------------------
          RESPONSIVE
        ----------------------------------------- */

        @media (max-width: 800px) {
          .admin-heading {
            flex-direction: column;
            align-items: flex-start;
          }

          .admin-form {
            grid-template-columns: 1fr;
          }

          .film-admin-row {
            grid-template-columns: 1fr;
            gap: 8px;
          }

          .admin-watch {
            justify-self: start;
          }

          .form-actions {
            align-items: flex-start;
            flex-direction: column;
          }

          .language-filter-label {
            align-items: flex-start;
            flex-direction: column;
          }
        }
      `}</style>
    </main>
  );
}
