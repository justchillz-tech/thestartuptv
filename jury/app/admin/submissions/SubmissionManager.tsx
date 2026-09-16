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
  cast_crew_file_path: string | null;
  film_url: string | null;
  status: "pending" | "approved" | "rejected";
  rejection_reason: string | null;
  approval_exception: boolean;
  approval_exception_reason: string | null;
  approved_film_id: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
};

function formatDate(value: string | null) {
  if (!value) return "Date unavailable";

  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

type SubmissionManagerProps = {
  role: "admin" | "management";
};
export default function SubmissionManager({
  role,
}: SubmissionManagerProps) {
  const isAdmin = role === "admin";
  const supabase = createClient();

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [approvingException, setApprovingException] = useState(false);
  const [showExceptionForm, setShowExceptionForm] = useState(false);
  const [exceptionReason, setExceptionReason] = useState("");
  const [unrejecting, setUnrejecting] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [selected, setSelected] = useState<Submission | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [unapproving, setUnapproving] = useState(false);

  async function loadSubmissions() {
    setLoading(true);

    const { data, error: loadError } = await supabase
      .from("film_submissions")
      .select(
        "id, submitted_at, participant_email, submitted_email, participant_name, contact_number, organization, title, genre, duration, production_year, director_name, producer_name, language, synopsis, cast_crew, film_url, status, rejection_reason, cast_crew_file_path, approval_exception, approval_exception_reason, approved_film_id, reviewed_by, reviewed_at"
      )
      .order("submitted_at", { ascending: false });

    if (loadError) {
      setError(loadError.message);
    } else {
      setSubmissions((data ?? []) as Submission[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadSubmissions();
  }, []);
  async function openCastCrewDocument(submissionId: string) {
    const newWindow = window.open(
      "about:blank",
      "_blank"
    );

    setError("");

    try {
      const response = await fetch(
        `/api/admin/submissions/attachment?submission_id=${encodeURIComponent(
          submissionId
        )}`
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        newWindow?.close();

        setError(
          result.error ??
          "Unable to open the Cast & Crew document."
        );

        return;
      }

      if (newWindow) {
        newWindow.location.href = result.url;
      } else {
        window.location.href = result.url;
      }
    } catch {
      newWindow?.close();

      setError(
        "Unable to open the Cast & Crew document."
      );
    }
  }

  function toggleSubmission(id: string) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  }

  function toggleAllPending() {
    const pendingIds = submissions
      .filter((submission) => submission.status === "pending")
      .map((submission) => submission.id);

    const allPendingSelected =
      pendingIds.length > 0 &&
      pendingIds.every((id) => selectedIds.includes(id));

    setSelectedIds(allPendingSelected ? [] : pendingIds);
  }

  async function syncSheet() {
    setSyncing(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/admin/submissions/sync", {
        method: "POST",
      });

      const result = await response.json();

      if (!response.ok) {
        setError(
          result.error ?? "Unable to synchronize the response sheet."
        );
      } else {
        setMessage(result.message ?? "Submissions synchronized.");
      }

      setSelectedIds([]);
      await loadSubmissions();
    } catch {
      setError("Unable to synchronize the response sheet.");
    } finally {
      setSyncing(false);
    }
  }

  async function approveFilm() {
    if (!selected) return;

    setApproving(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(
        "/api/admin/submissions/approve",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            submission_id: selected.id,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        setError(result.error ?? "Unable to approve film.");
        return;
      }

      setMessage(
        `Film approved successfully as ${result.film.film_code}.`
      );

      setSelectedIds((current) =>
        current.filter((id) => id !== selected.id)
      );

      await loadSubmissions();

      setSelected({
        ...selected,
        status: "approved",
      });
    } catch {
      setError("Unable to approve film.");
    } finally {
      setApproving(false);
    }
  }
  async function rejectFilm() {
    if (!selected) return;

    const reason = rejectionReason.trim();

    if (!reason) {
      setError("Please provide a rejection reason.");
      return;
    }

    setRejecting(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(
        "/api/admin/submissions/reject",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            submission_id: selected.id,
            rejection_reason: reason,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        setError(
          result.error ?? "Unable to reject submission."
        );
        return;
      }

      setMessage("Submission rejected successfully.");

      setSelectedIds((current) =>
        current.filter((id) => id !== selected.id)
      );

      await loadSubmissions();

      setSelected({
        ...selected,
        status: "rejected",
        rejection_reason: reason,
      });

      setRejectionReason("");
      setShowRejectForm(false);
    } catch {
      setError("Unable to reject submission.");
    } finally {
      setRejecting(false);
    }
  }

  async function approveWithException() {
    if (!selected) return;

    const reason = exceptionReason.trim();

    if (!reason) {
      setError("Please provide an exception reason.");
      return;
    }

    setApprovingException(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(
        "/api/admin/submissions/approve-exception",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            submission_id: selected.id,
            approval_exception_reason: reason,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        setError(
          result.error ??
          "Unable to approve with exception."
        );
        return;
      }

      setMessage(
        "Submission approved with exception."
      );

      setSelectedIds((current) =>
        current.filter((id) => id !== selected.id)
      );

      await loadSubmissions();

      setSelected({
        ...selected,
        status: "approved",
        approval_exception: true,
        approval_exception_reason: reason,
        approved_film_id: result.film?.id ?? null,
      });

      setExceptionReason("");
      setShowExceptionForm(false);
    } catch {
      setError(
        "Unable to approve with exception."
      );
    } finally {
      setApprovingException(false);
    }
  }
  async function unapproveFilm() {
    if (!selected) return;

    const confirmed = window.confirm(
      "Unapprove this film and return the submission to Pending Review?"
    );

    if (!confirmed) return;

    setUnapproving(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(
        "/api/admin/submissions/unapprove",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            submission_id: selected.id,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        setError(
          result.error ?? "Unable to unapprove submission."
        );
        return;
      }

      setMessage(
        "Submission returned to pending review."
      );

      await loadSubmissions();

      setSelected({
        ...selected,
        status: "pending",
        approved_film_id: null,
        reviewed_by: null,
        reviewed_at: null,
        approval_exception: false,
        approval_exception_reason: null,
      });
    } catch {
      setError("Unable to unapprove submission.");
    } finally {
      setUnapproving(false);
    }
  }
  async function unrejectFilm() {
    if (!selected) return;

    const confirmed = window.confirm(
      "Unreject this submission and return it to Pending Review?"
    );

    if (!confirmed) return;

    setUnrejecting(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(
        "/api/admin/submissions/unreject",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            submission_id: selected.id,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        setError(
          result.error ??
          "Unable to unreject submission."
        );
        return;
      }

      setMessage(
        "Submission returned to pending review."
      );

      setSelectedIds((current) =>
        current.filter((id) => id !== selected.id)
      );

      await loadSubmissions();

      setSelected({
        ...selected,
        status: "pending",
        rejection_reason: null,
        approval_exception: false,
        approval_exception_reason: null,
        approved_film_id: null,
        reviewed_by: null,
        reviewed_at: null,

      });
    } catch {
      setError(
        "Unable to unreject submission."
      );
    } finally {
      setUnrejecting(false);
    }
  }

  async function approveSelected() {
    if (selectedIds.length === 0) return;

    setApproving(true);
    setMessage("");
    setError("");

    try {
      const results = await Promise.all(
        selectedIds.map(async (submissionId) => {
          try {
            const response = await fetch(
              "/api/admin/submissions/approve",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  submission_id: submissionId,
                }),
              }
            );

            const result = await response.json();

            return {
              submissionId,
              ok: response.ok,
              error: response.ok
                ? null
                : result.error ?? "Unable to approve film.",
            };
          } catch {
            return {
              submissionId,
              ok: false,
              error: "Unable to connect to approval service.",
            };
          }
        })
      );

      const successful = results.filter((result) => result.ok);
      const failed = results.filter((result) => !result.ok);

      if (successful.length > 0) {
        setMessage(
          `${successful.length} film${successful.length === 1 ? "" : "s"
          } approved successfully.`
        );
      }

      if (failed.length > 0) {
        setError(
          `${failed.length} film${failed.length === 1 ? "" : "s"
          } could not be approved.`
        );
      }

      setSelectedIds([]);

      await loadSubmissions();
    } catch {
      setError("Unable to approve selected films.");
    } finally {
      setApproving(false);
    }
  }

  const pendingSubmissions = submissions.filter(
    (submission) => submission.status === "pending"
  );

  const allPendingSelected =
    pendingSubmissions.length > 0 &&
    pendingSubmissions.every((submission) =>
      selectedIds.includes(submission.id)
    );
  const selectedIsExceptionApproved =
    selected?.status === "approved" &&
    selected.approval_exception;

  return (
    <main className="portal-shell admin-shell">
      <header className="portal-header">
        <a
          href="/dashboard"
          className="brand-lockup compact"
        >
          <div className="brand-mark">STV</div>

          <div>
            <strong>Startup TV</strong>
            <span>JURY PORTAL · ADMIN</span>
          </div>
        </a>

        <a
          href="/dashboard"
          className="back-link"
        >
          ← Jury dashboard
        </a>
      </header>

      <section className="admin-wrap">
        <div className="admin-heading">
          <div>
            <div className="eyebrow">
              <span /> PARTICIPANT SUBMISSIONS
            </div>

            <h1>
              Find the
              <br />
              <em>next story.</em>
            </h1>

            <p>
              Pull participant entries from the festival response
              sheet, review the submitted details and approve only the
              films that should enter the jury system.
            </p>
          </div>

          <div className="admin-count">
            <span>SUBMISSIONS</span>

            <strong>{submissions.length}</strong>

            <small>
              {pendingSubmissions.length} pending review
            </small>
          </div>
        </div>

        {isAdmin && (
          <section className="admin-panel toolbar-panel">
            <div>
              <span className="panel-kicker">
                GOOGLE FORM INTAKE
              </span>

              <h2>Response sheet sync</h2>

              <p>
                Existing and new responses are synchronized without
                creating duplicate submissions.
              </p>
            </div>

            <button
              className="button button-primary"
              onClick={syncSheet}
              disabled={syncing}
            >
              {syncing ? "Syncing…" : "Sync submissions"}{" "}
              <span>↗</span>
            </button>
          </section>
        )}

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
              <span>INBOX</span>
              <h2>Participant submissions</h2>
            </div>

            {isAdmin && (
              <div className="selection-tools">
                <label className="select-all">
                  <input
                    type="checkbox"
                    checked={allPendingSelected}
                    onChange={toggleAllPending}
                    disabled={pendingSubmissions.length === 0}
                  />

                  <span>Select all pending</span>
                </label>

                {selectedIds.length > 0 && (
                  <>
                    <span className="selection-count">
                      {selectedIds.length} selected
                    </span>

                    <button
                      type="button"
                      className="button button-primary bulk-approve-button"
                      onClick={approveSelected}
                      disabled={approving}
                    >
                      {approving
                        ? "Approving…"
                        : `Approve ${selectedIds.length} film${selectedIds.length === 1 ? "" : "s"
                        }`}{" "}
                      <span>↗</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {loading ? (
            <div className="empty-state">
              Loading submissions…
            </div>
          ) : submissions.length === 0 ? (
            <div className="empty-state">
              <strong>
                No submissions synchronized yet.
              </strong>

              <span>
                Click “Sync submissions” to pull the Google Form
                responses.
              </span>
            </div>
          ) : (
            <div className="submission-list">
              {submissions.map((submission) => (
                <article
                  className="submission-row"
                  key={submission.id}
                >
                  {isAdmin && submission.status === "pending" ? (
                    <input
                      className="submission-checkbox"
                      type="checkbox"
                      checked={selectedIds.includes(
                        submission.id
                      )}
                      onChange={() =>
                        toggleSubmission(submission.id)
                      }
                      onClick={(event) =>
                        event.stopPropagation()
                      }
                    />
                  ) : (
                    <span className="submission-checkbox-placeholder" />
                  )}

                  <div className="submission-code">
                    {submission.status.toUpperCase()}
                  </div>

                  <div className="submission-main">
                    <strong>{submission.title}</strong>

                    <span>
                      {submission.participant_name} ·{" "}
                      {submission.organization ||
                        "Independent"}
                    </span>

                    <small>
                      {submission.genre ||
                        "Genre not supplied"}{" "}
                      ·{" "}
                      {submission.language ||
                        "Language not supplied"}{" "}
                      ·{" "}
                      {formatDate(
                        submission.submitted_at
                      )}
                    </small>
                  </div>

                  <div className="submission-status">
                    {submission.status}
                  </div>

                  <button
                    className="secondary-button"
                    onClick={() =>
                      setSelected(submission)
                    }
                  >
                    Review ↗
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>

      {selected && (
        <div
          className="modal-backdrop"
          onClick={() => setSelected(null)}
        >
          <section
            className="submission-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="modal-top">
              <div>
                <span>SUBMISSION REVIEW</span>

                <h2>{selected.title}</h2>
              </div>

              <button
                className="close-button"
                onClick={() => setSelected(null)}
              >
                ×
              </button>
            </div>

            <div className="detail-grid">
              <div>
                <span>Participant</span>
                <strong>
                  {selected.participant_name}
                </strong>
              </div>

              <div>
                <span>Email</span>
                <strong>
                  {selected.participant_email ||
                    selected.submitted_email ||
                    "—"}
                </strong>
              </div>

              <div>
                <span>Contact</span>
                <strong>
                  {selected.contact_number || "—"}
                </strong>
              </div>

              <div>
                <span>Organization</span>
                <strong>
                  {selected.organization || "—"}
                </strong>
              </div>

              <div>
                <span>Director</span>
                <strong>
                  {selected.director_name || "—"}
                </strong>
              </div>

              <div>
                <span>Producer</span>
                <strong>
                  {selected.producer_name || "—"}
                </strong>
              </div>

              <div>
                <span>Genre</span>
                <strong>
                  {selected.genre || "—"}
                </strong>
              </div>

              <div>
                <span>Language</span>
                <strong>
                  {selected.language || "—"}
                </strong>
              </div>

              <div>
                <span>Duration</span>
                <strong>
                  {selected.duration || "—"}
                </strong>
              </div>

              <div>
                <span>Production year</span>
                <strong>
                  {selected.production_year || "—"}
                </strong>
              </div>
            </div>

            <div className="detail-block">
              <span>SYNOPSIS</span>

              <p>
                {selected.synopsis ||
                  "No synopsis supplied."}
              </p>
            </div>

            <div className="detail-block">
              <span>CAST & CREW</span>

              <p>
                {selected.cast_crew ||
                  "No cast and crew details supplied."}
              </p>

              {selected.cast_crew_file_path && (
                <button
                  type="button"
                  className="secondary-button attachment-button"
                  onClick={() =>
                    openCastCrewDocument(selected.id)
                  }
                >
                  View Cast & Crew Document
                </button>
              )}
            </div>

            <div className="modal-actions">
              {selected.film_url && (
                <a
                  className="secondary-button"
                  href={selected.film_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open submitted film ↗
                </a>
              )}

              <span
                className={`modal-status status-${selected.status}`}
              >
                {selected.status}
              </span>
              {isAdmin && selected.status === "pending" && (
                <div className="review-actions">
                  {!showRejectForm && !showExceptionForm ? (
                    <div className="review-button-row">
                      <button
                        type="button"
                        className="reject-button"
                        onClick={() => {
                          setError("");
                          setMessage("");
                          setShowRejectForm(true);
                          setShowExceptionForm(false);
                        }}
                        disabled={
                          approving ||
                          rejecting ||
                          approvingException
                        }
                      >
                        Reject Submission
                      </button>

                      <button
                        type="button"
                        className="exception-button"
                        onClick={() => {
                          setError("");
                          setMessage("");
                          setShowExceptionForm(true);
                          setShowRejectForm(false);
                        }}
                        disabled={
                          approving ||
                          rejecting ||
                          approvingException
                        }
                      >
                        Approve with Exception
                      </button>

                      <button
                        type="button"
                        className="approve-button"
                        onClick={approveFilm}
                        disabled={
                          approving ||
                          rejecting ||
                          approvingException
                        }
                      >
                        {approving
                          ? "Approving..."
                          : "Approve Film"}
                      </button>
                    </div>
                  ) : showRejectForm ? (
                    <div className="reject-panel">
                      <div className="reject-panel-title">
                        REJECTION REASON
                      </div>

                      <textarea
                        value={rejectionReason}
                        onChange={(event) =>
                          setRejectionReason(event.target.value)
                        }
                        placeholder="Enter the reason for rejecting this submission..."
                        maxLength={1000}
                        rows={4}
                        disabled={rejecting}
                      />

                      <div className="reject-panel-footer">
                        <span>
                          {rejectionReason.length}/1000
                        </span>

                        <div className="reject-panel-buttons">
                          <button
                            type="button"
                            className="cancel-button"
                            onClick={() => {
                              setShowRejectForm(false);
                              setRejectionReason("");
                              setError("");
                            }}
                            disabled={rejecting}
                          >
                            Cancel
                          </button>

                          <button
                            type="button"
                            className="reject-confirm-button"
                            onClick={rejectFilm}
                            disabled={
                              rejecting ||
                              !rejectionReason.trim()
                            }
                          >
                            {rejecting
                              ? "Rejecting..."
                              : "Confirm Rejection"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="exception-panel">
                      <div className="exception-panel-title">
                        APPROVAL EXCEPTION
                      </div>

                      <p>
                        This will approve the submission despite
                        missing or invalid normal submission
                        requirements. Please record why the exception
                        is being granted.
                      </p>

                      <textarea
                        value={exceptionReason}
                        onChange={(event) =>
                          setExceptionReason(event.target.value)
                        }
                        placeholder="Enter the reason for approving this submission with an exception..."
                        maxLength={1000}
                        rows={4}
                        disabled={approvingException}
                      />

                      <div className="exception-panel-footer">
                        <span>
                          {exceptionReason.length}/1000
                        </span>

                        <div className="exception-panel-buttons">
                          <button
                            type="button"
                            className="cancel-button"
                            onClick={() => {
                              setShowExceptionForm(false);
                              setExceptionReason("");
                              setError("");
                            }}
                            disabled={approvingException}
                          >
                            Cancel
                          </button>

                          <button
                            type="button"
                            className="exception-confirm-button"
                            onClick={approveWithException}
                            disabled={
                              approvingException ||
                              !exceptionReason.trim()
                            }
                          >
                            {approvingException
                              ? "Approving..."
                              : "Confirm Exception Approval"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {isAdmin && selected.status === "rejected" && (
                <div className="review-actions">
                  <button
                    type="button"
                    className="unreject-button"
                    onClick={unrejectFilm}
                    disabled={unrejecting}
                  >
                    {unrejecting
                      ? "Returning to Review..."
                      : "Unreject Submission"}
                  </button>
                  {selectedIsExceptionApproved && (
                    <div className="exception-info">
                      <div className="exception-badge">
                        APPROVED WITH EXCEPTION
                      </div>

                      {selected.approval_exception_reason && (
                        <div className="exception-note">
                          <strong>Exception reason</strong>
                          <span>
                            {selected.approval_exception_reason}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

              )}
              {isAdmin && selected.status === "approved" && (
                <div className="review-actions">
                  <button
                    type="button"
                    className="unapprove-button"
                    onClick={unapproveFilm}
                    disabled={unapproving}
                  >
                    {unapproving
                      ? "Returning to Review..."
                      : "Unapprove Film"}
                  </button>

                  {selected.approval_exception && (
                    <div className="exception-info">
                      <div className="exception-badge">
                        APPROVED WITH EXCEPTION
                      </div>

                      {selected.approval_exception_reason && (
                        <div className="exception-note">
                          <strong>Exception reason</strong>
                          <span>
                            {selected.approval_exception_reason}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

            </div>

            <small className="approval-note">
              Approval creates the film record and makes the
              submission available for jury assignment.
            </small>
          </section>
        </div>
      )}

      <style jsx>{`
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
          font: 800 clamp(48px, 6vw, 76px) / 0.95
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
          max-width: 650px;
          margin: 0;
          color: var(--text-secondary);
          font-size: 14px;
          line-height: 1.8;
        }

        .admin-count {
          flex: 0 0 170px;
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
          letter-spacing: 0.16em;
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

        .toolbar-panel {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 30px;
        }

        .toolbar-panel h2 {
          margin: 6px 0;
          font: 700 22px Poppins, sans-serif;
        }

        .toolbar-panel p {
          margin: 0;
          color: var(--text-secondary);
          font-size: 11px;
        }

        .panel-kicker {
          color: var(--text-secondary);
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.16em;
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

        .selection-tools {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 14px;
          flex-wrap: wrap;
        }

        .select-all {
          display: flex;
          align-items: center;
          gap: 7px;
          color: var(--text-secondary);
          font-size: 10px;
          cursor: pointer;
          white-space: nowrap;
        }

        .select-all input,
        .submission-checkbox {
          width: 15px;
          height: 15px;
          accent-color: #f3961f;
          cursor: pointer;
        }

        .select-all input:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }

        .selection-count {
          color: #f0a36b;
          font-size: 9px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .bulk-approve-button {
          padding: 9px 14px;
          font-size: 10px;
          white-space: nowrap;
        }

        .submission-list {
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 15px;
          overflow: hidden;
        }

        .submission-row {
          display: grid;
          grid-template-columns:
            24px
            90px
            minmax(0, 1fr)
            80px
            100px;
          gap: 18px;
          align-items: center;
          padding: 18px;
          border-top: 1px solid rgba(255, 255, 255, 0.07);
        }

        .submission-row:first-child {
          border-top: 0;
        }

        .submission-checkbox {
          justify-self: center;
        }

        .submission-checkbox-placeholder {
          width: 15px;
          height: 15px;
          display: block;
        }

        .submission-code {
          font-size: 8px;
          letter-spacing: 0.12em;
          color: #f0a36b;
        }

        .submission-main {
          display: grid;
          gap: 4px;
          min-width: 0;
        }

        .submission-main strong {
          font: 600 14px Poppins, sans-serif;
        }

        .submission-main span,
        .submission-main small {
          color: var(--text-secondary);
          font-size: 10px;
          overflow-wrap: anywhere;
        }

        .submission-status {
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--text-secondary);
        }

        .modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 50;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 30px;
          background: rgba(3, 5, 18, 0.78);
          backdrop-filter: blur(10px);
        }

        .submission-modal {
          width: min(900px, 94vw);
          max-height: 90vh;
          overflow: auto;
          padding: 30px;
          border: 1px solid var(--glass-border);
          border-radius: 22px;
          background: #0b0e1d;
          box-shadow: 0 30px 100px rgba(0, 0, 0, 0.55);
        }

        .modal-top {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          align-items: flex-start;
        }

        .modal-top > div > span,
        .detail-block > span {
          color: var(--text-secondary);
          font-size: 9px;
          letter-spacing: 0.16em;
          font-weight: 700;
        }

        .modal-top h2 {
          margin: 8px 0 25px;
          font: 700 28px Poppins, sans-serif;
        }

        .close-button {
          border: 1px solid var(--glass-border);
          background: rgba(255, 255, 255, 0.04);
          color: white;
          border-radius: 50%;
          width: 34px;
          height: 34px;
          font-size: 20px;
          cursor: pointer;
        }

        .detail-grid {
          display: grid;
          grid-template-columns: repeat(
            2,
            minmax(0, 1fr)
          );
          gap: 12px;
        }

        .detail-grid > div {
          padding: 13px;
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.025);
        }

        .detail-grid span {
          display: block;
          color: var(--text-secondary);
          font-size: 8px;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          margin-bottom: 5px;
        }

        .detail-grid strong {
          font-size: 11px;
          overflow-wrap: anywhere;
        }

        .detail-block {
          margin-top: 14px;
          padding: 15px;
          border-left: 2px solid #f3961f;
          background: rgba(255, 255, 255, 0.025);
        }

        .detail-block p {
          margin: 8px 0 0;
          color: #c7cad8;
          font-size: 11px;
          line-height: 1.7;
          white-space: pre-wrap;
        }

        .modal-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 22px;
        }

        .modal-status {
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: var(--text-secondary);
          margin-right: auto;
        }

        .status-pending {
          color: #f0a36b;
        }

        .status-approved {
          color: #a8efbd;
        }

        .status-rejected {
          color: #ff9b9b;
        }

        .approval-note {
          display: block;
          margin-top: 12px;
          color: var(--text-secondary);
          font-size: 9px;
          text-align: right;
        }

        @media (max-width: 800px) {
          .admin-heading {
            flex-direction: column;
            align-items: flex-start;
          }

          .toolbar-panel {
            align-items: flex-start;
            flex-direction: column;
          }

          .panel-title {
            align-items: flex-start;
            flex-direction: column;
          }

          .selection-tools {
            justify-content: flex-start;
          }

          .submission-row {
            grid-template-columns: 1fr;
            gap: 8px;
          }

          .submission-checkbox,
          .submission-checkbox-placeholder {
            justify-self: start;
          }

          .detail-grid {
            grid-template-columns: 1fr;
          }

          .modal-actions {
            flex-wrap: wrap;
            justify-content: flex-start;
          }

          .approval-note {
            text-align: left;
          }
        }
        .attachment-button {
          margin-top: 14px;
          cursor: pointer;
        }
        .review-actions {
          margin-top: 24px;
        }

        .reject-panel {
          padding: 18px;
          border: 1px solid rgba(255, 92, 92, 0.22);
          border-radius: 16px;
          background: rgba(255, 92, 92, 0.045);
        }

        .reject-panel-title {
          margin-bottom: 10px;
          color: rgba(255, 255, 255, 0.42);
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.16em;
        }

        .reject-panel textarea {
          width: 100%;
          min-height: 110px;
          resize: vertical;
          padding: 13px 14px;
          border: 1px solid rgba(255, 255, 255, 0.10);
          border-radius: 10px;
          outline: none;
          background: rgba(0, 0, 0, 0.20);
          color: #fff;
          font: inherit;
          line-height: 1.5;
          box-sizing: border-box;
        }

        .reject-panel textarea:focus {
          border-color: rgba(239, 106, 55, 0.55);
        }

        .reject-panel textarea::placeholder {
          color: rgba(255, 255, 255, 0.28);
        }

        .reject-panel-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-top: 10px;
        }

        .reject-panel-footer > span {
          color: rgba(255, 255, 255, 0.25);
          font-size: 10px;
        }

        .reject-panel-buttons {
          display: flex;
          gap: 10px;
        }

        .reject-button,
        .approve-button,
        .cancel-button,
        .reject-confirm-button {
          border: 0;
          border-radius: 10px;
          padding: 11px 16px;
          font: inherit;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.2s ease, transform 0.2s ease;
        }

        .reject-button {
          background: rgba(255, 92, 92, 0.10);
          color: #ff8585;
          border: 1px solid rgba(255, 92, 92, 0.22);
        }

        .reject-button:hover {
          background: rgba(255, 92, 92, 0.16);
        }

        .approve-button {
          background: linear-gradient(
            135deg,
            #f3961f,
            #ef6a37
          );
          color: #fff;
        }

        .cancel-button {
          background: rgba(255, 255, 255, 0.06);
          color: rgba(255, 255, 255, 0.65);
        }

        .reject-confirm-button {
          background: #d95353;
          color: #fff;
        }

        .reject-button:disabled,
        .approve-button:disabled,
        .cancel-button:disabled,
        .reject-confirm-button:disabled {
          opacity: 0.45;
          cursor: not-allowed;
          transform: none;
        }
        .unreject-button {
          border: 1px solid rgba(246, 166, 35, 0.28);
          border-radius: 10px;
          padding: 11px 16px;
          background: rgba(246, 166, 35, 0.08);
          color: #f6b94a;
          font: inherit;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.2s ease, background 0.2s ease;
        }

        .unreject-button:hover {
          background: rgba(246, 166, 35, 0.14);
        }

        .unreject-button:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .review-button-row {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .exception-button {
          border: 1px solid rgba(180, 100, 255, 0.28);
          border-radius: 10px;
          padding: 11px 16px;
          background: rgba(180, 100, 255, 0.08);
          color: #d09cff;
          font: inherit;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.2s ease, background 0.2s ease;
        }

        .exception-button:hover {
          background: rgba(180, 100, 255, 0.15);
        }

        .exception-panel {
          padding: 18px;
          border: 1px solid rgba(180, 100, 255, 0.24);
          border-radius: 16px;
          background: rgba(180, 100, 255, 0.045);
        }

        .exception-panel-title {
          margin-bottom: 8px;
          color: #d09cff;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.16em;
        }

        .exception-panel p {
          margin: 0 0 12px;
          color: rgba(255, 255, 255, 0.48);
          font-size: 10px;
          line-height: 1.6;
        }

        .exception-panel textarea {
          width: 100%;
          min-height: 110px;
          resize: vertical;
          padding: 13px 14px;
          border: 1px solid rgba(255, 255, 255, 0.10);
          border-radius: 10px;
          outline: none;
          background: rgba(0, 0, 0, 0.20);
          color: #fff;
          font: inherit;
          line-height: 1.5;
          box-sizing: border-box;
        }

        .exception-panel textarea:focus {
          border-color: rgba(180, 100, 255, 0.55);
        }

        .exception-panel textarea::placeholder {
          color: rgba(255, 255, 255, 0.28);
        }

        .exception-panel-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-top: 10px;
        }

        .exception-panel-footer > span {
          color: rgba(255, 255, 255, 0.25);
          font-size: 10px;
        }

        .exception-panel-buttons {
          display: flex;
          gap: 10px;
        }

        .exception-confirm-button {
          border: 0;
          border-radius: 10px;
          padding: 11px 16px;
          background: linear-gradient(
            135deg,
            #963694,
            #b464ff
          );
          color: #fff;
          font: inherit;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }

        .exception-confirm-button:disabled,
        .exception-button:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
        .exception-info {
          width: 100%;
          margin-top: 12px;
          flex-basis: 100%;
        }

        .exception-badge {
          display: inline-flex;
          align-items: center;
          padding: 6px 9px;
          border: 1px solid rgba(180, 100, 255, 0.25);
          border-radius: 7px;
          background: rgba(180, 100, 255, 0.08);
          color: #d09cff;
          font-size: 8px;
          font-weight: 700;
          letter-spacing: 0.10em;
        }

        .exception-note {
          display: grid;
          gap: 5px;
          margin-top: 10px;
          padding: 12px 14px;
          border-left: 2px solid #963694;
          background: rgba(180, 100, 255, 0.04);
          border-radius: 0 8px 8px 0;
        }

        .exception-note strong {
          color: #d09cff;
          font-size: 9px;
          letter-spacing: 0.10em;
          text-transform: uppercase;
        }

        .exception-note span {
          color: #c7cad8;
          font-size: 10px;
          line-height: 1.6;
          overflow-wrap: anywhere;
        }
      `}</style>
    </main>
  );
}