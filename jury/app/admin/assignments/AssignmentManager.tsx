"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Film = {
  id: string;
  film_code: string;
  title: string;
  director: string;
  duration: string;
  language: string;
  status: string;
};

type Jury = {
  id: string;
  name: string;
  email: string;
  role: string;
};

type Assignment = {
  id: string;
  jury_id: string;
  film_id: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  films: Film | Film[];
  juries: Jury | Jury[];
};

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export default function AssignmentManager() {
  const supabase = createClient();

  const [films, setFilms] = useState<Film[]>([]);
  const [juries, setJuries] = useState<Jury[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  const [juryId, setJuryId] = useState("");
  const [selectedFilmIds, setSelectedFilmIds] = useState<string[]>(
    []
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [unassigningId, setUnassigningId] = useState<string | null>(
    null
  );

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");

    const [
      filmsResult,
      juriesResult,
      assignmentsResult,
    ] = await Promise.all([
      supabase
        .from("films")
        .select(
          "id, film_code, title, director, duration, language, status"
        )
        .order("created_at", { ascending: false }),

      supabase
        .from("juries")
        .select("id, name, email, role")
        .eq("role", "jury")
        .order("created_at", { ascending: true }),

      supabase
        .from("assignments")
        .select(
          "id, jury_id, film_id, status, created_at, completed_at, films(id, film_code, title, director, duration, language, status), juries(id, name, email, role)"
        )
        .order("created_at", { ascending: false }),
    ]);

    const firstError =
      filmsResult.error ??
      juriesResult.error ??
      assignmentsResult.error;

    if (firstError) {
      setError(firstError.message);
    } else {
      setFilms(filmsResult.data ?? []);
      setJuries(juriesResult.data ?? []);
      setAssignments(
        (assignmentsResult.data as Assignment[]) ?? []
      );
    }

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  /*
   * A film is globally unavailable once it has an assignment.
   */
  const assignedFilmIds = useMemo(
    () => new Set(assignments.map((assignment) => assignment.film_id)),
    [assignments]
  );

  const availableFilms = useMemo(
    () =>
      films.filter(
        (film) => !assignedFilmIds.has(film.id)
      ),
    [films, assignedFilmIds]
  );

  /*
   * Current assignments for the selected jury.
   */
  const selectedJuryAssignments = useMemo(
    () =>
      juryId
        ? assignments.filter(
          (assignment) => assignment.jury_id === juryId
        )
        : [],
    [assignments, juryId]
  );

  const allAvailableSelected =
    availableFilms.length > 0 &&
    availableFilms.every((film) =>
      selectedFilmIds.includes(film.id)
    );

  function toggleFilm(filmId: string) {
    setSelectedFilmIds((current) =>
      current.includes(filmId)
        ? current.filter((id) => id !== filmId)
        : [...current, filmId]
    );
  }

  function toggleAllFilms() {
    if (allAvailableSelected) {
      setSelectedFilmIds([]);
    } else {
      setSelectedFilmIds(
        availableFilms.map((film) => film.id)
      );
    }
  }

  function handleJuryChange(value: string) {
    setJuryId(value);
    setSelectedFilmIds([]);
    setError("");
    setMessage("");
  }

  async function handleAssign() {
    if (!juryId) {
      setError("Select a jury member first.");
      return;
    }

    if (selectedFilmIds.length === 0) {
      setError("Select at least one film.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const rows = selectedFilmIds.map((filmId) => ({
        film_id: filmId,
        jury_id: juryId,
      }));

      const { error: insertError } = await supabase
        .from("assignments")
        .insert(rows);

      if (insertError) {
        if (insertError.code === "23505") {
          setError(
            "One or more selected films have already been assigned. Refreshing the available films."
          );
        } else {
          setError(insertError.message);
        }

        await loadData();
        setSelectedFilmIds([]);
        return;
      }

      const assignedCount = selectedFilmIds.length;

      setSelectedFilmIds([]);

      setMessage(
        `${assignedCount} film${assignedCount === 1 ? "" : "s"
        } assigned successfully.`
      );

      await loadData();
    } catch {
      setError("Unable to assign the selected films.");
    } finally {
      setSaving(false);
    }
  }

  async function removeAssignment(
    assignment: Assignment
  ) {
    const film = one(assignment.films);

    const confirmed = window.confirm(
      `Unassign "${film?.title ?? "this film"}" from this jury member?`
    );

    if (!confirmed) return;

    setUnassigningId(assignment.id);
    setError("");
    setMessage("");

    try {
      const { error: deleteError } = await supabase
        .from("assignments")
        .delete()
        .eq("id", assignment.id);

      if (deleteError) {
        setError(deleteError.message);
        return;
      }

      setMessage(
        `"${film?.title ?? "Film"}" has been unassigned.`
      );

      await loadData();
    } catch {
      setError("Unable to remove the assignment.");
    } finally {
      setUnassigningId(null);
    }
  }

  return (
    <main className="portal-shell admin-shell">
      <header className="portal-header">
        <Link
          href="/dashboard"
          className="brand-lockup compact"
        >
          <div className="brand-mark">STV</div>

          <div>
            <strong>Startup TV</strong>
            <span>JURY PORTAL · ADMIN</span>
          </div>
        </Link>

        <div className="admin-nav">
          <Link href="/admin/films">Films</Link>
          <Link href="/admin/juries">Jury</Link>
          <Link
            href="/admin/assignments"
            className="active"
          >
            Assignments
          </Link>
          <Link
            href="/dashboard"
            className="back-link"
          >
            Dashboard →
          </Link>
        </div>
      </header>

      <section className="admin-wrap">
        <div className="admin-heading">
          <div>
            <div className="eyebrow">
              <span /> ASSIGNMENT MANAGEMENT
            </div>

            <h1>
              Put the stories
              <br />
              <em>in the right hands.</em>
            </h1>

            <p>
              Assign each approved film to one jury member.
              Once a film is assigned, it is removed from the
              available pool until the assignment is removed.
            </p>
          </div>

          <div className="stats-row">
            <div className="admin-count">
              <span>FILMS</span>
              <strong>{films.length}</strong>
              <small>in system</small>
            </div>

            <div className="admin-count">
              <span>AVAILABLE</span>
              <strong>{availableFilms.length}</strong>
              <small>unassigned</small>
            </div>

            <div className="admin-count">
              <span>ASSIGNMENTS</span>
              <strong>{assignments.length}</strong>
              <small>total</small>
            </div>
          </div>
        </div>

        {error && (
          <div className="form-error global-message">
            {error}
          </div>
        )}

        {message && (
          <div className="form-success global-message">
            {message}
          </div>
        )}

        <section className="admin-panel">
          <div className="panel-title">
            <div>
              <span>NEW ASSIGNMENT</span>
              <h2>Assign films to a juror</h2>
            </div>

            <span className="panel-note">
              Multiple films · one juror
            </span>
          </div>

          <div className="assignment-form">
            <label className="wide-field">
              Jury Member

              <select
                value={juryId}
                onChange={(event) =>
                  handleJuryChange(event.target.value)
                }
              >
                <option value="">
                  Select a jury member
                </option>

                {juries.map((jury) => (
                  <option
                    key={jury.id}
                    value={jury.id}
                  >
                    {jury.name} · {jury.email}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="film-selector">
            <div className="film-selector-header">
              <div>
                <span>AVAILABLE FILMS</span>

                <strong>
                  {availableFilms.length} film
                  {availableFilms.length === 1
                    ? ""
                    : "s"} available
                </strong>
              </div>

              <label className="select-all">
                <input
                  type="checkbox"
                  checked={allAvailableSelected}
                  onChange={toggleAllFilms}
                  disabled={
                    !juryId ||
                    availableFilms.length === 0
                  }
                />

                <span>Select all</span>
              </label>
            </div>

            {!juryId ? (
              <div className="selection-empty">
                Select a jury member to begin assigning films.
              </div>
            ) : availableFilms.length === 0 ? (
              <div className="selection-empty">
                <strong>
                  No films are currently available.
                </strong>

                <span>
                  All approved films have already been assigned.
                </span>
              </div>
            ) : (
              <div className="film-selection-list">
                {availableFilms.map((film) => (
                  <label
                    className={`film-selection-row ${selectedFilmIds.includes(film.id)
                        ? "selected"
                        : ""
                      }`}
                    key={film.id}
                  >
                    <input
                      type="checkbox"
                      checked={selectedFilmIds.includes(
                        film.id
                      )}
                      onChange={() =>
                        toggleFilm(film.id)
                      }
                    />

                    <div className="film-selection-main">
                      <span>{film.film_code}</span>
                      <strong>{film.title}</strong>

                      <small>
                        {film.director} ·{" "}
                        {film.duration} ·{" "}
                        {film.language}
                      </small>
                    </div>
                  </label>
                ))}
              </div>
            )}

            <div className="assignment-actions">
              <span>
                {selectedFilmIds.length > 0
                  ? `${selectedFilmIds.length} film${selectedFilmIds.length === 1
                    ? ""
                    : "s"
                  } selected`
                  : "Select films to assign"}
              </span>

              <button
                type="button"
                className="button button-primary"
                onClick={handleAssign}
                disabled={
                  saving ||
                  !juryId ||
                  selectedFilmIds.length === 0
                }
              >
                {saving
                  ? "Assigning…"
                  : `Assign ${selectedFilmIds.length || ""
                  } film${selectedFilmIds.length === 1
                    ? ""
                    : "s"
                  }`}{" "}
                <span>↗</span>
              </button>
            </div>
          </div>
        </section>

        <section className="admin-panel">
          <div className="panel-title">
            <div>
              <span>CURRENT ASSIGNMENTS</span>

              <h2>
                {juryId
                  ? `Assignments for ${juries.find(
                    (jury) => jury.id === juryId
                  )?.name ?? "selected juror"
                  }`
                  : "All jury assignments"}
              </h2>
            </div>

            <span className="panel-note">
              {juryId
                ? `${selectedJuryAssignments.length} assignment${selectedJuryAssignments.length === 1
                  ? ""
                  : "s"
                }`
                : `${assignments.length} total`}
            </span>
          </div>

          {loading ? (
            <div className="empty-state">
              Loading assignments…
            </div>
          ) : assignments.length === 0 ? (
            <div className="empty-state">
              <strong>No assignments yet.</strong>

              <span>
                Select a jury member and assign the first films
                above.
              </span>
            </div>
          ) : juryId && selectedJuryAssignments.length === 0 ? (
            <div className="empty-state">
              <strong>
                No films assigned to this juror.
              </strong>

              <span>
                Select films above to create assignments.
              </span>
            </div>
          ) : (
            <div className="assignment-list">
              {(juryId
                ? selectedJuryAssignments
                : assignments
              ).map((assignment) => {
                const film = one(assignment.films);
                const jury = one(assignment.juries);

                return (
                  <article
                    className="assignment-row"
                    key={assignment.id}
                  >
                    <div className="assignment-film">
                      <span>
                        {film?.film_code ?? "FILM"}
                      </span>

                      <strong>
                        {film?.title ?? "Unknown film"}
                      </strong>

                      <small>
                        {film?.director ?? ""} ·{" "}
                        {film?.duration ?? ""} ·{" "}
                        {film?.language ?? ""}
                      </small>
                    </div>

                    <div className="assignment-jury">
                      <div className="jury-avatar">
                        {jury?.name
                          ?.slice(0, 1)
                          .toUpperCase() ?? "J"}
                      </div>

                      <div>
                        <strong>
                          {jury?.name ?? "Unknown juror"}
                        </strong>

                        <small>
                          {jury?.email ?? ""}
                        </small>
                      </div>
                    </div>

                    <div
                      className={`assignment-status ${assignment.status
                        }`}
                    >
                      {assignment.status ===
                        "completed"
                        ? "✓ COMPLETED"
                        : "● PENDING"}
                    </div>

                    <button
                      className="remove-button"
                      type="button"
                      onClick={() =>
                        removeAssignment(assignment)
                      }
                      disabled={
                        unassigningId === assignment.id
                      }
                    >
                      {unassigningId === assignment.id
                        ? "Removing…"
                        : "Unassign"}
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </section>

      <style jsx>{`
        .admin-nav {
          display: flex;
          align-items: center;
          gap: 20px;
        }

        .admin-nav a {
          color: var(--text-secondary);
          font-size: 10px;
          font-weight: 600;
        }

        .admin-nav a:hover,
        .admin-nav a.active {
          color: white;
        }

        .admin-nav .back-link {
          margin-left: 5px;
        }

        .admin-wrap {
          width: min(1240px, 90vw);
          margin: 0 auto;
          padding: 75px 0 100px;
        }

        .admin-heading {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 50px;
          margin-bottom: 45px;
        }

        .admin-heading h1 {
          margin: 15px 0 18px;
          font: 800 clamp(44px, 5.5vw, 72px) / 0.95
            Poppins, sans-serif;
          letter-spacing: -0.055em;
        }

        .admin-heading h1 em {
          font-style: normal;
          background: var(--gradient-main);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }

        .admin-heading p {
          max-width: 620px;
          margin: 0;
          color: var(--text-secondary);
          font-size: 14px;
          line-height: 1.8;
        }

        .stats-row {
          display: flex;
          gap: 12px;
        }

        .admin-count {
          min-width: 120px;
          padding: 18px;
          border: 1px solid var(--glass-border);
          background: var(--glass-bg);
          border-radius: 18px;
        }

        .admin-count span,
        .admin-count small {
          display: block;
          color: var(--text-secondary);
          font-size: 8px;
          letter-spacing: 0.16em;
        }

        .admin-count strong {
          display: block;
          margin: 5px 0;
          font: 800 34px Poppins, sans-serif;
          background: var(--gradient-main);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }

        .admin-panel {
          margin-top: 18px;
          padding: 28px;
          border: 1px solid var(--glass-border);
          background: linear-gradient(
            145deg,
            rgba(255, 255, 255, 0.055),
            rgba(255, 255, 255, 0.025)
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
          letter-spacing: 0.16em;
        }

        .panel-title h2 {
          margin: 7px 0 0;
          font: 700 22px Poppins, sans-serif;
        }

        .panel-note {
          color: var(--text-secondary);
          font-size: 10px;
        }

        .assignment-form {
          display: grid;
          grid-template-columns: repeat(
            2,
            minmax(0, 1fr)
          );
          gap: 17px;
        }

        .assignment-form label {
          display: grid;
          gap: 8px;
          color: #eee;
          font-size: 11px;
          font-weight: 700;
        }

        .assignment-form select {
          width: 100%;
          border: 1px solid var(--glass-border);
          outline: none;
          color: white;
          background: #10162d;
          border-radius: 12px;
          padding: 13px 14px;
        }

        .assignment-form select:focus {
          border-color: rgba(243, 150, 31, 0.65);
        }

        .wide-field {
          grid-column: 1 / -1;
        }

        .film-selector {
          margin-top: 25px;
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 15px;
          overflow: hidden;
        }

        .film-selector-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 17px 18px;
          border-bottom: 1px solid
            rgba(255, 255, 255, 0.07);
        }

        .film-selector-header > div {
          display: grid;
          gap: 5px;
        }

        .film-selector-header span {
          color: var(--text-secondary);
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.14em;
        }

        .film-selector-header strong {
          font: 600 13px Poppins, sans-serif;
        }

        .select-all {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--text-secondary);
          font-size: 10px;
          cursor: pointer;
          white-space: nowrap;
        }

        .select-all input,
        .film-selection-row input {
          width: 15px;
          height: 15px;
          accent-color: #f3961f;
          cursor: pointer;
        }

        .select-all input:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        .film-selection-list {
          max-height: 390px;
          overflow-y: auto;
        }

        .film-selection-row {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 15px 18px;
          border-top: 1px solid
            rgba(255, 255, 255, 0.06);
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .film-selection-row:first-child {
          border-top: 0;
        }

        .film-selection-row:hover,
        .film-selection-row.selected {
          background: rgba(255, 255, 255, 0.035);
        }

        .film-selection-main {
          display: grid;
          gap: 3px;
          min-width: 0;
        }

        .film-selection-main span {
          color: #f0a36b;
          font: 700 8px Poppins, sans-serif;
          letter-spacing: 0.1em;
        }

        .film-selection-main strong {
          font: 600 13px Poppins, sans-serif;
        }

        .film-selection-main small {
          color: var(--text-secondary);
          font-size: 9px;
          overflow-wrap: anywhere;
        }

        .selection-empty {
          padding: 45px 20px;
          display: grid;
          gap: 7px;
          text-align: center;
          color: var(--text-secondary);
          font-size: 10px;
        }

        .selection-empty strong {
          color: white;
          font: 600 15px Poppins, sans-serif;
        }

        .assignment-actions {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          padding: 17px 18px;
          border-top: 1px solid
            rgba(255, 255, 255, 0.07);
          color: var(--text-secondary);
          font-size: 10px;
        }

        .global-message {
          margin-top: 18px;
        }

        .form-success {
          border: 1px solid rgba(80, 220, 130, 0.3);
          background: rgba(80, 220, 130, 0.08);
          color: #a8efbd;
          padding: 12px 13px;
          border-radius: 10px;
          font-size: 11px;
        }

        .form-error {
          border: 1px solid rgba(240, 90, 70, 0.35);
          background: rgba(240, 90, 70, 0.08);
          color: #ffb0a5;
          padding: 12px 13px;
          border-radius: 10px;
          font-size: 11px;
        }

        .assignment-list {
          border: 1px solid
            rgba(255, 255, 255, 0.07);
          border-radius: 15px;
          overflow: hidden;
        }

        .assignment-row {
          display: grid;
          grid-template-columns:
            minmax(0, 1.5fr)
            minmax(220px, 1fr)
            105px
            80px;
          gap: 18px;
          align-items: center;
          padding: 17px 18px;
          border-top: 1px solid
            rgba(255, 255, 255, 0.07);
        }

        .assignment-row:first-child {
          border-top: 0;
        }

        .assignment-film,
        .assignment-jury {
          display: grid;
          gap: 4px;
        }

        .assignment-film span {
          color: #f0a36b;
          font: 700 9px Poppins, sans-serif;
          letter-spacing: 0.1em;
        }

        .assignment-film strong {
          font: 600 13px Poppins, sans-serif;
        }

        .assignment-film small,
        .assignment-jury small {
          color: var(--text-secondary);
          font-size: 9px;
        }

        .assignment-jury {
          display: flex;
          align-items: center;
          gap: 11px;
        }

        .assignment-jury > div:last-child {
          display: grid;
          gap: 4px;
        }

        .jury-avatar {
          width: 34px;
          height: 34px;
          flex: 0 0 34px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          background: var(--gradient-main);
          font: 700 11px Poppins, sans-serif;
        }

        .assignment-jury strong {
          font: 600 12px Poppins, sans-serif;
        }

        .assignment-status {
          font-size: 8px;
          letter-spacing: 0.1em;
          color: #f0a36b;
          text-align: right;
        }

        .assignment-status.completed {
          color: #9de8b2;
        }

        .remove-button {
          border: 0;
          background: transparent;
          color: var(--text-secondary);
          font-size: 9px;
          text-align: right;
          cursor: pointer;
        }

        .remove-button:hover:not(:disabled) {
          color: #ffb19c;
        }

        .remove-button:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }

        .empty-state {
          padding: 55px;
          display: grid;
          gap: 8px;
          text-align: center;
          color: var(--text-secondary);
        }

        .empty-state strong {
          color: white;
          font: 600 18px Poppins, sans-serif;
        }

        @media (max-width: 900px) {
          .admin-heading {
            flex-direction: column;
            align-items: flex-start;
          }

          .stats-row {
            width: 100%;
          }

          .admin-count {
            flex: 1;
          }

          .assignment-row {
            grid-template-columns: 1fr 1fr;
          }

          .assignment-status,
          .remove-button {
            text-align: left;
          }
        }

        @media (max-width: 650px) {
          .portal-header {
            height: auto;
            min-height: 82px;
            padding: 16px 20px;
            gap: 15px;
            flex-wrap: wrap;
          }

          .admin-nav {
            gap: 12px;
            flex-wrap: wrap;
          }

          .admin-wrap {
            width: 92vw;
            padding-top: 55px;
          }

          .assignment-form {
            grid-template-columns: 1fr;
          }

          .stats-row {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
          }

          .admin-count {
            min-width: 0;
            padding: 14px;
          }

          .admin-count strong {
            font-size: 27px;
          }

          .panel-title {
            align-items: flex-start;
            flex-direction: column;
          }

          .film-selector-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .assignment-actions {
            align-items: flex-start;
            flex-direction: column;
          }

          .assignment-row {
            grid-template-columns: 1fr;
          }

          .assignment-status,
          .remove-button {
            text-align: left;
          }
        }
      `}</style>
    </main>
  );
}